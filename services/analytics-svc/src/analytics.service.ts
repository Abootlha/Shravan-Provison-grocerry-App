import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderEvent, IOrderEvent } from './schemas/order-event.schema';
import { DailyAnalytics, IDailyAnalytics } from './schemas/daily-analytics.schema';
import { RedisService } from './redis.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(OrderEvent.name) private orderEventModel: Model<OrderEvent>,
    @InjectModel(DailyAnalytics.name) private dailyAnalyticsModel: Model<DailyAnalytics>,
    private readonly redisService: RedisService,
  ) {}

  async trackOrderEvent(event: IOrderEvent): Promise<void> {
    const orderEvent = new this.orderEventModel(event);
    await orderEvent.save();

    await this.updateDailyMetrics(event);
    await this.invalidateCache();
  }

  async trackRiderEvent(event: any): Promise<void> {
    const riderEvent = new this.orderEventModel({
      type: event.eventType,
      data: event,
      timestamp: new Date(),
    });
    await riderEvent.save();

    await this.updateRiderMetrics(event);
    await this.invalidateCache();
  }

  private async updateDailyMetrics(event: IOrderEvent): Promise<void> {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const existing = await this.dailyAnalyticsModel.findOne({ date });

    if (existing) {
      if (event.type === 'order.completed') {
        existing.totalOrders += 1;
        existing.completedOrders += 1;
        existing.revenue += event.data?.amount || 0;
      } else if (event.type === 'order.cancelled') {
        existing.cancelledOrders += 1;
      }
      await existing.save();
    } else {
      await this.dailyAnalyticsModel.create({
        date,
        totalOrders: event.type === 'order.completed' ? 1 : 0,
        completedOrders: event.type === 'order.completed' ? 1 : 0,
        cancelledOrders: event.type === 'order.cancelled' ? 1 : 0,
        revenue: event.type === 'order.completed' ? (event.data?.amount || 0) : 0,
      });
    }
  }

  private async updateRiderMetrics(event: any): Promise<void> {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const existing = await this.dailyAnalyticsModel.findOne({ date });

    if (existing) {
      if (event.eventType === 'delivery.completed') {
        existing.deliveriesCompleted += 1;
      } else if (event.eventType === 'cancellation') {
        existing.cancellations += 1;
      }
      await existing.save();
    }
  }

  private async invalidateCache(): Promise<void> {
    const keys = await this.redisService.keys('metrics:*');
    for (const key of keys) {
      await this.redisService.del(key);
    }
  }

  async getDailyMetrics(date: Date): Promise<IDailyAnalytics | null> {
    const cacheKey = `metrics:daily:${date.toISOString().split('T')[0]}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = await this.dailyAnalyticsModel.findOne({
      date: new Date(date.setHours(0, 0, 0, 0)),
    });

    if (metrics) {
      await this.redisService.set(cacheKey, JSON.stringify(metrics), 300);
    }

    return metrics;
  }
}
