import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderEvent } from './schemas/order-event.schema';
import { DailyAnalytics } from './schemas/daily-analytics.schema';
import { RedisService } from './redis.service';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(OrderEvent.name) private orderEventModel: Model<OrderEvent>,
    @InjectModel(DailyAnalytics.name) private dailyAnalyticsModel: Model<DailyAnalytics>,
    private readonly redisService: RedisService,
  ) {}

  async getRiderPerformanceMetrics(startDate: Date, endDate: Date): Promise<any[]> {
    const cacheKey = `report:riderPerformance:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'delivery.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: '$data.riderId',
        deliveriesCompleted: { $sum: 1 },
        totalDeliveryTime: { $sum: '$data.deliveryTimeMinutes' },
        avgDeliveryTime: { $avg: '$data.deliveryTimeMinutes' },
      } },
      { $lookup: { from: 'riders', localField: '_id', foreignField: '_id', as: 'rider' } },
      { $unwind: { path: '$rider', preserveNullAndEmptyArrays: true } },
      { $project: { riderId: '$_id', deliveriesCompleted: 1, avgDeliveryTime: 1, riderName: '$rider.name' } },
      { $sort: { deliveriesCompleted: -1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getTopProducts(startDate: Date, endDate: Date, limit: number = 10): Promise<any[]> {
    const cacheKey = `report:topProducts:${startDate.toISOString()}:${endDate.toISOString()}:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$data.items' },
      { $group: { _id: '$data.items.productId', quantity: { $sum: '$data.items.quantity' }, revenue: { $sum: { $multiply: ['$data.items.quantity', '$data.items.price'] } } } },
      { $sort: { quantity: -1 } },
      { $limit: limit },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getCustomerRetention(startDate: Date, endDate: Date): Promise<any> {
    const cacheKey = `report:customerRetention:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const orders = await this.orderEventModel.distinct('data.customerId', { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } });
    const totalCustomers = orders.length;

    const returningCustomers = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$data.customerId', orderCount: { $sum: 1 } } },
      { $match: { orderCount: { $gt: 1 } } },
      { $count: 'count' },
    ]);

    const returning = returningCustomers.length > 0 ? returningCustomers[0].count : 0;
    const retentionRate = totalCustomers > 0 ? (returning / totalCustomers) * 100 : 0;

    const result = { totalCustomers, returningCustomers: returning, retentionRate };
    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getDailySummary(date: Date): Promise<any> {
    const cacheKey = `report:dailySummary:${date.toISOString().split('T')[0]}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const summary = await this.dailyAnalyticsModel.findOne({
      date: new Date(date.setHours(0, 0, 0, 0)),
    });

    await this.redisService.set(cacheKey, JSON.stringify(summary), 300);
    return summary;
  }
}
