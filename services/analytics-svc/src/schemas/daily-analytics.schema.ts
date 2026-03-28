import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyAnalyticsDocument = DailyAnalytics & Document;

export interface IDailyAnalytics {
  date: Date;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  deliveriesCompleted: number;
  cancellations: number;
}

@Schema({ timestamps: true })
export class DailyAnalytics {
  @Prop({ required: true, unique: true })
  date: Date;

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  completedOrders: number;

  @Prop({ default: 0 })
  cancelledOrders: number;

  @Prop({ default: 0 })
  revenue: number;

  @Prop({ default: 0 })
  deliveriesCompleted: number;

  @Prop({ default: 0 })
  cancellations: number;
}

export const DailyAnalyticsSchema = SchemaFactory.createForClass(DailyAnalytics);
DailyAnalyticsSchema.index({ date: 1 }, { unique: true });
