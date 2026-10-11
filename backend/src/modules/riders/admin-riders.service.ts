import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rider, RiderDocument, RiderStatus } from './schemas/rider.schema';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { SessionRevokerService } from '../auth/session-revoker.service';
import { AdminUpdateRiderDto } from './dto/admin-rider.dto';

/** Orders a rider is (or is about to be) working on. */
export const RIDER_ACTIVE_ORDER_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.PACKED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

export interface RiderStats {
  deliveredCount: number;
  cancelledCount: number;
  activeOrderCount: number;
  deliveredToday: number;
  lastDeliveredAt: Date | null;
}

const EMPTY_STATS: RiderStats = {
  deliveredCount: 0,
  cancelledCount: 0,
  activeOrderCount: 0,
  deliveredToday: 0,
  lastDeliveredAt: null,
};

export const normalizeRiderPhone = (phone: string): string => {
  const compact = phone.replace(/\s/g, '');
  return compact.startsWith('+91') ? compact : `+91${compact}`;
};

@Injectable()
export class AdminRidersService {
  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly sessionRevoker: SessionRevokerService,
  ) {}

  /** Per-rider order counts from the orders collection (one aggregation). */
  private async statsFor(
    riderIds: Types.ObjectId[],
    now = new Date(),
  ): Promise<Map<string, RiderStats>> {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await this.orderModel.aggregate([
      { $match: { riderId: { $in: riderIds } } },
      {
        $group: {
          _id: '$riderId',
          deliveredCount: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', OrderStatus.DELIVERED] }, 1, 0],
            },
          },
          cancelledCount: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', OrderStatus.CANCELLED] }, 1, 0],
            },
          },
          activeOrderCount: {
            $sum: {
              $cond: [
                { $in: ['$orderStatus', RIDER_ACTIVE_ORDER_STATUSES] },
                1,
                0,
              ],
            },
          },
          deliveredToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$orderStatus', OrderStatus.DELIVERED] },
                    { $gte: ['$actualDeliveryTime', startOfDay] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          lastDeliveredAt: {
            $max: {
              $cond: [
                { $eq: ['$orderStatus', OrderStatus.DELIVERED] },
                '$actualDeliveryTime',
                null,
              ],
            },
          },
        },
      },
    ]);
    const map = new Map<string, RiderStats>();
    for (const row of rows) {
      map.set(String(row._id), {
        deliveredCount: row.deliveredCount ?? 0,
        cancelledCount: row.cancelledCount ?? 0,
        activeOrderCount: row.activeOrderCount ?? 0,
        deliveredToday: row.deliveredToday ?? 0,
        lastDeliveredAt: row.lastDeliveredAt ?? null,
      });
    }
    return map;
  }

  async list(filter: { status?: string; isActive?: boolean } = {}) {
    const query: Record<string, any> = {};
    if (filter.status) query.status = filter.status;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;

    const riders = await this.riderModel
      .find(query)
      .select('-password')
      .sort({ isActive: -1, name: 1 })
      .lean()
      .exec();
    const stats = await this.statsFor(riders.map((r) => r._id));

    // Summary over all riders (not only the filtered page).
    const all = await this.riderModel
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            available: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      '$isActive',
                      { $eq: ['$status', RiderStatus.AVAILABLE] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            busy: {
              $sum: { $cond: [{ $eq: ['$status', RiderStatus.BUSY] }, 1, 0] },
            },
          },
        },
      ])
      .exec();
    const s = all[0] || { total: 0, active: 0, available: 0, busy: 0 };

    return {
      riders: riders.map((rider) => ({
        ...rider,
        stats: stats.get(String(rider._id)) || { ...EMPTY_STATS },
      })),
      summary: {
        total: s.total,
        active: s.active,
        inactive: s.total - s.active,
        available: s.available,
        busy: s.busy,
      },
    };
  }

  async get(id: string) {
    const rider = await this.riderModel
      .findById(id)
      .select('-password')
      .lean()
      .exec();
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  async stats(id: string) {
    const rider = await this.get(id);
    const stats = (await this.statsFor([rider._id])).get(String(rider._id)) || {
      ...EMPTY_STATS,
    };
    const activeOrders = await this.orderModel
      .find({
        riderId: rider._id,
        orderStatus: { $in: RIDER_ACTIVE_ORDER_STATUSES },
      })
      .select('orderId orderStatus totalAmount createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return { riderId: String(rider._id), ...stats, activeOrders };
  }

  async update(id: string, dto: AdminUpdateRiderDto) {
    const $set: Record<string, any> = {};
    if (dto.name !== undefined) $set.name = dto.name.trim();
    if (dto.vehicleType !== undefined) $set.vehicleType = dto.vehicleType;
    if (dto.phone !== undefined) {
      const phone = normalizeRiderPhone(dto.phone);
      const taken = await this.riderModel.exists({
        _id: { $ne: new Types.ObjectId(id) },
        phone: { $in: [phone, phone.replace(/^\+91/, '')] },
      });
      if (taken) {
        throw new ConflictException('Phone number already used by a rider');
      }
      $set.phone = phone;
    }
    if (Object.keys($set).length === 0) {
      throw new BadRequestException('Nothing to update');
    }
    const rider = await this.riderModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .select('-password')
      .lean()
      .exec();
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  /**
   * Deactivated riders cannot log in (password, OTP, refresh) and are never
   * auto- or manually assigned. Their sessions are ended immediately.
   */
  async setActive(id: string, isActive: boolean) {
    const rider = await this.get(id);
    if (!isActive) {
      const busy = await this.orderModel.exists({
        riderId: rider._id,
        orderStatus: { $in: RIDER_ACTIVE_ORDER_STATUSES },
      });
      if (busy) {
        throw new ConflictException(
          'Rider has an active order. Reassign or finish it before deactivating.',
        );
      }
    }
    const updated = await this.riderModel
      .findByIdAndUpdate(
        id,
        {
          $set: isActive
            ? { isActive: true }
            : { isActive: false, status: RiderStatus.OFFLINE },
        },
        { new: true },
      )
      .select('-password')
      .lean()
      .exec();
    if (!isActive) {
      await this.sessionRevoker.revokeAll(id, 'rider');
    }
    return updated;
  }
}
