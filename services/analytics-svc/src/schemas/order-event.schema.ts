import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderEventDocument = OrderEvent & Document;

export interface IOrderEvent {
  type: string;
  data?: any;
  timestamp: Date;
}

@Schema({ timestamps: true })
export class OrderEvent {
  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  data: any;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;
}

export const OrderEventSchema = SchemaFactory.createForClass(OrderEvent);
OrderEventSchema.index({ type: 1, timestamp: 1 });
OrderEventSchema.index({ 'data.customerId': 1 });
OrderEventSchema.index({ 'data.riderId': 1 });
