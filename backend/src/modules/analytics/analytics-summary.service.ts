import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import {
  ACTIVE_STATUS_FILTER,
  DEFAULT_REORDER_LEVEL,
  Product,
  ProductDocument,
} from '../products/schemas/product.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_TIMEZONE,
  addDays,
  isValidTimezone,
  localDateString,
  startOfLocalDay,
} from '../settings/store-hours';

export const MAX_SUMMARY_DAYS = 366;
const DEFAULT_SUMMARY_DAYS = 7;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface AnalyticsSummary {
  range: { from: string; to: string; timezone: string };
  /** Sum of totalAmount of non-cancelled orders created in the range. */
  revenue: number;
  /** Non-cancelled orders created in the range. */
  orders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  /** Every OrderStatus value, including zeros. */
  ordersByStatus: Record<OrderStatus, number>;
  /** Current catalogue state (not range-bound). */
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  newCustomers: number;
  timeseries: { date: string; orders: number; revenue: number }[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const toYmd = (value: string, timezone: string): string =>
  YMD.test(value) ? value : localDateString(new Date(value), timezone);

@Injectable()
export class AnalyticsSummaryService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Inclusive local-date range in the store timezone. Defaults to the last
   * 7 days including today.
   */
  resolveRange(
    timezone: string,
    from?: string,
    to?: string,
    now: Date = new Date(),
  ) {
    const toYmdValue = to
      ? toYmd(to, timezone)
      : localDateString(now, timezone);
    const fromYmd = from
      ? toYmd(from, timezone)
      : addDays(toYmdValue, -(DEFAULT_SUMMARY_DAYS - 1));
    if (fromYmd > toYmdValue) {
      throw new BadRequestException('from must be on or before to');
    }
    const days: string[] = [];
    for (let d = fromYmd; d <= toYmdValue; d = addDays(d, 1)) {
      days.push(d);
      if (days.length > MAX_SUMMARY_DAYS) {
        throw new BadRequestException(
          `The range cannot be longer than ${MAX_SUMMARY_DAYS} days`,
        );
      }
    }
    return {
      from: fromYmd,
      to: toYmdValue,
      start: startOfLocalDay(fromYmd, timezone),
      end: startOfLocalDay(addDays(toYmdValue, 1), timezone),
      days,
    };
  }

  async getSummary(from?: string, to?: string): Promise<AnalyticsSummary> {
    const settings = await this.settingsService.getStoreSettings();
    const timezone =
      settings.timezone && isValidTimezone(settings.timezone)
        ? settings.timezone
        : DEFAULT_TIMEZONE;
    const range = this.resolveRange(timezone, from, to);
    const createdInRange = { createdAt: { $gte: range.start, $lt: range.end } };
    const notCancelled = { orderStatus: { $ne: OrderStatus.CANCELLED } };

    const [orderFacets, activeProducts, outOfStock, lowStock, newCustomers] =
      await Promise.all([
        this.orderModel
          .aggregate([
            { $match: createdInRange },
            {
              $facet: {
                byStatus: [
                  { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
                ],
                totals: [
                  { $match: notCancelled },
                  {
                    $group: {
                      _id: null,
                      orders: { $sum: 1 },
                      revenue: { $sum: '$totalAmount' },
                    },
                  },
                ],
                daily: [
                  { $match: notCancelled },
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$createdAt',
                          timezone,
                        },
                      },
                      orders: { $sum: 1 },
                      revenue: { $sum: '$totalAmount' },
                    },
                  },
                ],
              },
            },
          ])
          .exec(),
        this.productModel.countDocuments(ACTIVE_STATUS_FILTER).exec(),
        this.productModel
          .countDocuments({ ...ACTIVE_STATUS_FILTER, stock: { $lte: 0 } })
          .exec(),
        this.productModel
          .countDocuments({
            ...ACTIVE_STATUS_FILTER,
            stock: { $gt: 0 },
            $expr: {
              $lte: [
                '$stock',
                { $ifNull: ['$reorderLevel', DEFAULT_REORDER_LEVEL] },
              ],
            },
          })
          .exec(),
        this.userModel
          .countDocuments({ role: UserRole.CUSTOMER, ...createdInRange })
          .exec(),
      ]);

    const facets = orderFacets[0] || { byStatus: [], totals: [], daily: [] };
    const ordersByStatus = Object.fromEntries(
      Object.values(OrderStatus).map((s) => [s, 0]),
    ) as Record<OrderStatus, number>;
    for (const row of facets.byStatus) {
      if (row._id in ordersByStatus) {
        ordersByStatus[row._id as OrderStatus] = row.count;
      }
    }

    const orders = facets.totals[0]?.orders ?? 0;
    const revenue = round2(facets.totals[0]?.revenue ?? 0);
    const daily = new Map<string, { orders: number; revenue: number }>(
      facets.daily.map((row: any) => [
        row._id,
        { orders: row.orders, revenue: row.revenue },
      ]),
    );

    return {
      range: { from: range.from, to: range.to, timezone },
      revenue,
      orders,
      cancelledOrders: ordersByStatus[OrderStatus.CANCELLED],
      averageOrderValue: orders ? round2(revenue / orders) : 0,
      ordersByStatus,
      activeProducts,
      outOfStock,
      lowStock,
      newCustomers,
      timeseries: range.days.map((date) => ({
        date,
        orders: daily.get(date)?.orders ?? 0,
        revenue: round2(daily.get(date)?.revenue ?? 0),
      })),
    };
  }
}
