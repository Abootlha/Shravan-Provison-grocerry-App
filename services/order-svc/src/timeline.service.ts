import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { TimelineEntry } from './order.schema';
import { OrderStatus } from './interfaces/order.interface';

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async addTimelineEntry(
    orderId: string,
    status: OrderStatus,
    changedBy?: Types.ObjectId,
    note?: string,
  ): Promise<void> {
    const entry: TimelineEntry = {
      status,
      timestamp: new Date(),
      changedBy,
      note,
    };

    await this.orderModel.updateOne(
      { orderId },
      { $push: { timeline: entry } },
    );

    this.logger.log(`Timeline entry added for order ${orderId}: ${status}`);
  }

  async getTimeline(orderId: string): Promise<TimelineEntry[]> {
    const order = await this.orderModel.findOne({ orderId }).select('timeline');
    return order?.timeline ?? [];
  }
}
