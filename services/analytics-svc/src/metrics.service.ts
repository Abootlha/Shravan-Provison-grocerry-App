import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderEvent, IOrderEvent } from './schemas/order-event.schema';
import { DailyAnalytics } from './schemas/daily-analytics.schema';
import { RedisService } from './redis.service';

@Injectable()
export class MetricsService {
  constructor(
    @InjectModel(OrderEvent.name) private orderEventModel: Model<OrderEvent>,
    private readonly redisService: RedisService,
  ) {}

  async getOrderVolumeByDay(startDate: Date, endDate: Date): Promise<any[]> {
    const cacheKey = `metrics:orderVolume:day:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.created', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getOrderVolumeByHour(date: Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const cacheKey = `metrics:orderVolume:hour:${date.toISOString().split('T')[0]}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.created', timestamp: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getRevenueByDay(startDate: Date, endDate: Date): Promise<any[]> {
    const cacheKey = `metrics:revenue:day:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, revenue: { $sum: '$data.amount' } } },
      { $sort: { _id: 1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getRevenueByWeek(startDate: Date, endDate: Date): Promise<any[]> {
    const cacheKey = `metrics:revenue:week:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { year: { $isoWeekYear: '$timestamp' }, week: { $isoWeek: '$timestamp' } }, revenue: { $sum: '$data.amount' } } },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getRevenueByMonth(startDate: Date, endDate: Date): Promise<any[]> {
    const cacheKey = `metrics:revenue:month:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } }, revenue: { $sum: '$data.amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async getAverageOrderValue(startDate: Date, endDate: Date): Promise<number> {
    const cacheKey = `metrics:avgOrderValue:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return parseFloat(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'order.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, avgValue: { $avg: '$data.amount' } } },
    ]);

    const avgValue = result.length > 0 ? result[0].avgValue : 0;
    await this.redisService.set(cacheKey, avgValue.toString(), 300);
    return avgValue;
  }

  async getAverageDeliveryTime(startDate: Date, endDate: Date): Promise<number> {
    const cacheKey = `metrics:avgDeliveryTime:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return parseFloat(cached);

    const result = await this.orderEventModel.aggregate([
      { $match: { type: 'delivery.completed', timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, avgTime: { $avg: '$data.deliveryTimeMinutes' } } },
    ]);

    const avgTime = result.length > 0 ? result[0].avgTime : 0;
    await this.redisService.set(cacheKey, avgTime.toString(), 300);
    return avgTime;
  }
}
