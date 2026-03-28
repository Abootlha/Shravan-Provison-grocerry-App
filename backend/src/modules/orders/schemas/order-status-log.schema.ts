import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from './order.schema';

export type OrderStatusLogDocument = OrderStatusLog & Document;

@Schema({ timestamps: true })
export class OrderStatusLog {
    @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
    orderId!: Types.ObjectId;

    @Prop({ type: String, enum: OrderStatus })
    previousStatus?: OrderStatus;

    @Prop({ type: String, enum: OrderStatus, required: true })
    newStatus!: OrderStatus;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    changedBy!: Types.ObjectId;

    @Prop()
    note?: string;
}

export const OrderStatusLogSchema = SchemaFactory.createForClass(OrderStatusLog);

// Index for efficient lookup
OrderStatusLogSchema.index({ orderId: 1, createdAt: -1 });
