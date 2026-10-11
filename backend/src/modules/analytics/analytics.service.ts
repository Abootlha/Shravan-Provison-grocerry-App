import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import dayjs from 'dayjs';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { RedisService } from '../../common/utils/redis.service';
import { ConfigService } from '@nestjs/config';

export interface DailyReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
}

export interface WeeklyReport {
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  dailyBreakdown: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async getDailyReport(date?: string): Promise<DailyReport> {
    const targetDate = date || dayjs().format('YYYY-MM-DD');

    // Check Redis cache
    const cacheKey = RedisService.Keys.analyticsDaily(targetDate);
    const cached = await this.redisService.getJSON<DailyReport>(cacheKey);
    if (cached) return cached;

    const startOfDay = dayjs(targetDate).startOf('day').toDate();
    const endOfDay = dayjs(targetDate).endOf('day').toDate();

    const aggregation = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          orderStatus: { $ne: OrderStatus.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Get orders by status
    const statusAggregation = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const ordersByStatus: Record<string, number> = {};
    statusAggregation.forEach((item) => {
      ordersByStatus[item._id] = item.count;
    });

    const result: DailyReport = {
      date: targetDate,
      totalOrders: aggregation[0]?.totalOrders || 0,
      totalRevenue: aggregation[0]?.totalRevenue || 0,
      averageOrderValue: Math.round(aggregation[0]?.avgOrderValue || 0),
      ordersByStatus,
    };

    // Cache for 10 minutes
    const ttl = this.configService.get<number>('cache.ttl.analytics') || 600;
    await this.redisService.setJSON(cacheKey, result, ttl);

    return result;
  }

  async getWeeklyReport(startDate?: string): Promise<WeeklyReport> {
    const weekStart = startDate
      ? dayjs(startDate).startOf('week')
      : dayjs().startOf('week');
    const weekEnd = weekStart.endOf('week');

    const cacheKey = RedisService.Keys.analyticsWeekly(
      weekStart.format('YYYY-MM-DD'),
    );
    const cached = await this.redisService.getJSON<WeeklyReport>(cacheKey);
    if (cached) return cached;

    // Daily breakdown
    const dailyAggregation = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart.toDate(), $lte: weekEnd.toDate() },
          orderStatus: { $ne: OrderStatus.CANCELLED },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Total aggregation
    const totalAggregation = await this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: weekStart.toDate(), $lte: weekEnd.toDate() },
          orderStatus: { $ne: OrderStatus.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    const result: WeeklyReport = {
      startDate: weekStart.format('YYYY-MM-DD'),
      endDate: weekEnd.format('YYYY-MM-DD'),
      totalOrders: totalAggregation[0]?.totalOrders || 0,
      totalRevenue: totalAggregation[0]?.totalRevenue || 0,
      averageOrderValue: Math.round(totalAggregation[0]?.avgOrderValue || 0),
      dailyBreakdown: dailyAggregation.map((day) => ({
        date: day._id,
        orders: day.orders,
        revenue: day.revenue,
      })),
    };

    const ttl = this.configService.get<number>('cache.ttl.analytics') || 600;
    await this.redisService.setJSON(cacheKey, result, ttl);

    return result;
  }

  async getTopProducts(limit = 10): Promise<any[]> {
    return this.orderModel.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          // Legacy items store productId as a string; group both forms together.
          _id: { $toString: '$items.productId' },
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: {
            $sum: { $multiply: ['$items.price', '$items.quantity'] },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
    ]);
  }

  /**
   * Revenue per category for orders created in [startDate, endDate],
   * excluding cancelled orders. Line revenue is price x quantity as charged.
   *
   * Order items written before the schema fix hold productId as a string,
   * and some catalogue rows hold categoryId as a string, so both joins
   * compare ObjectIds after converting either side.
   */
  async getRevenueByCategory(startDate: Date, endDate: Date): Promise<any[]> {
    if (
      !(startDate instanceof Date) ||
      !(endDate instanceof Date) ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new BadRequestException(
        'startDate and endDate must be valid ISO dates',
      );
    }
    const toObjectId = (input: string) => ({
      $convert: { input, to: 'objectId', onError: null, onNull: null },
    });

    return this.orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: { $ne: OrderStatus.CANCELLED },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          let: { productId: toObjectId('$items.productId') },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$productId'] } } },
            { $project: { categoryId: 1 } },
          ],
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          let: { categoryId: toObjectId('$product.categoryId') },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } },
            { $project: { name: 1 } },
          ],
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          categoryName: { $first: '$category.name' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          itemsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
  }
}
