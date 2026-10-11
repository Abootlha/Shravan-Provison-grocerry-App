import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { escapeRegex, pageMeta } from '../../common/dto/query-transforms';
import { AdminCustomersQueryDto } from './dto/admin-customers.dto';

/** Per-customer order stats computed from the orders collection. */
const ORDER_STATS_LOOKUP: PipelineStage.Lookup = {
  $lookup: {
    from: 'orders',
    let: { uid: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$userId', '$$uid'] } } },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          deliveredCount: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', OrderStatus.DELIVERED] }, 1, 0],
            },
          },
          // Money actually spent: delivered orders only.
          totalSpent: {
            $sum: {
              $cond: [
                { $eq: ['$orderStatus', OrderStatus.DELIVERED] },
                '$totalAmount',
                0,
              ],
            },
          },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
    ],
    as: 'orderStats',
  },
};

const FLATTEN_STATS: PipelineStage[] = [
  {
    $addFields: {
      orderCount: {
        $ifNull: [{ $arrayElemAt: ['$orderStats.orderCount', 0] }, 0],
      },
      deliveredCount: {
        $ifNull: [{ $arrayElemAt: ['$orderStats.deliveredCount', 0] }, 0],
      },
      totalSpent: {
        $ifNull: [{ $arrayElemAt: ['$orderStats.totalSpent', 0] }, 0],
      },
      lastOrderAt: {
        $ifNull: [{ $arrayElemAt: ['$orderStats.lastOrderAt', 0] }, null],
      },
    },
  },
  {
    $project: {
      orderStats: 0,
      password: 0,
      refreshToken: 0,
      currentLocation: 0,
      isAvailable: 0,
      isOnline: 0,
      lastLocationUpdate: 0,
    },
  },
];

const STATS_SORTS = new Set(['orderCount', 'totalSpent', 'lastOrderAt']);

@Injectable()
export class AdminCustomersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  buildMatch(q?: string): Record<string, any> {
    const match: Record<string, any> = { role: UserRole.CUSTOMER };
    const term = q?.trim();
    if (term) {
      const regex = { $regex: escapeRegex(term), $options: 'i' };
      match.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }
    return match;
  }

  async list(query: AdminCustomersQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const match = this.buildMatch(query.q);

    const sortKey = query.sort || '-createdAt';
    const field = sortKey.replace(/^-/, '');
    const sort: Record<string, 1 | -1> = {
      [field]: sortKey.startsWith('-') ? -1 : 1,
      _id: 1,
    };
    const page$ = [{ $skip: (page - 1) * limit }, { $limit: limit }];

    // Sorting by an order stat needs the stats first; otherwise paginate
    // users first and only look up orders for the page.
    const pipeline: PipelineStage[] = STATS_SORTS.has(field)
      ? [
          { $match: match },
          ORDER_STATS_LOOKUP,
          ...FLATTEN_STATS,
          { $sort: sort },
          ...page$,
        ]
      : [
          { $match: match },
          { $sort: sort },
          ...page$,
          ORDER_STATS_LOOKUP,
          ...FLATTEN_STATS,
        ];

    const [customers, total] = await Promise.all([
      this.userModel.aggregate(pipeline).exec(),
      this.userModel.countDocuments(match).exec(),
    ]);

    return { customers, ...pageMeta(total, page, limit) };
  }

  async get(id: string) {
    const [customer] = await this.userModel
      .aggregate([
        {
          $match: {
            _id: new Types.ObjectId(id),
            role: UserRole.CUSTOMER,
          },
        },
        ORDER_STATS_LOOKUP,
        ...FLATTEN_STATS,
      ])
      .exec();
    if (!customer) throw new NotFoundException('Customer not found');

    const recentOrders = await this.orderModel
      .find({ userId: customer._id })
      .select(
        'orderId orderStatus paymentStatus paymentMethod totalAmount items createdAt deliveryAddress.address deliveryAddress.city',
      )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .exec();

    return {
      customer,
      addresses: customer.addresses ?? [],
      recentOrders: recentOrders.map((order: any) => ({
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        createdAt: order.createdAt,
        deliveryAddress: order.deliveryAddress,
      })),
    };
  }
}
