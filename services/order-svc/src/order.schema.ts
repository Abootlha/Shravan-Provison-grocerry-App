import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ _id: false })
export class DeliveryAddress {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] })
  coordinates: { type: string; coordinates: [number, number] };

  @Prop()
  instructions?: string;
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop()
  image?: string;
}

@Schema({ _id: false })
export class TimelineEntry {
  @Prop({ required: true })
  status: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ type: Types.ObjectId })
  changedBy?: Types.ObjectId;

  @Prop()
  note?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ unique: true, sparse: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rider' })
  riderId?: Types.ObjectId;

  @Prop({ type: [OrderItem], default: [] })
  items: OrderItem[];

  @Prop({ required: true, min: 0, default: 0 })
  itemTotal: number;

  @Prop({ required: true, min: 0, default: 0 })
  deliveryFee: number;

  @Prop({ required: true, min: 0, default: 0 })
  packagingFee: number;

  @Prop({ required: true, min: 0, default: 0 })
  discount: number;

  @Prop({ required: true, min: 0, default: 0 })
  totalAmount: number;

  @Prop({ type: DeliveryAddress, required: true })
  deliveryAddress: DeliveryAddress;

  @Prop({ required: true, enum: ['COD', 'UPI', 'CARD'] })
  paymentMethod: string;

  @Prop({ required: true, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' })
  paymentStatus: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'CONFIRMED', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  })
  orderStatus: string;

  @Prop()
  cancellationReason?: string;

  @Prop({ type: [TimelineEntry], default: [] })
  timeline: TimelineEntry[];

  @Prop()
  estimatedDeliveryTime?: Date;

  @Prop()
  actualDeliveryTime?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ 'deliveryAddress.coordinates': '2dsphere' });
OrderSchema.index({ userId: 1 });
OrderSchema.index({ riderId: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ orderId: 1 });
