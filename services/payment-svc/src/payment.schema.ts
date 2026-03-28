import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentMethod {
  COD = 'COD',
  UPI = 'UPI',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ unique: true, sparse: true })
  paymentId: string;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ required: true, enum: Object.values(PaymentMethod) })
  method: PaymentMethod;

  @Prop({ required: true, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop()
  transactionId?: string;

  @Prop()
  razorpayOrderId?: string;

  @Prop()
  razorpayPaymentId?: string;

  @Prop()
  razorpaySignature?: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ razorpayOrderId: 1 });
PaymentSchema.index({ razorpayPaymentId: 1 });
