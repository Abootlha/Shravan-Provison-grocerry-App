import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ASSIGNED = 'ASSIGNED',
  PACKED = 'PACKED',
  PICKED_UP = 'PICKED_UP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

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

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  price!: number;

  @Prop()
  image?: string;
}

@Schema({ _id: false })
export class TimelineEntry {
  @Prop({ type: String, enum: OrderStatus, required: true })
  status!: OrderStatus;

  @Prop({ type: Date, required: true })
  timestamp!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedBy!: Types.ObjectId;
}

export const TimelineEntrySchema = SchemaFactory.createForClass(TimelineEntry);

@Schema({ _id: false })
export class DeliveryAddress {
  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  pincode!: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  coordinates!: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  orderId!: string; // e.g., "ORD-2024-001"

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [OrderItem], required: true })
  items!: OrderItem[];

  @Prop({ required: true })
  itemTotal!: number;

  @Prop({ default: 0 })
  deliveryFee!: number;

  @Prop({ default: 0 })
  packagingFee!: number;

  @Prop({ default: 0 })
  discount!: number;

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ type: DeliveryAddress, required: true })
  deliveryAddress!: DeliveryAddress;

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    index: true,
  })
  orderStatus!: OrderStatus;

  @Prop({ type: [TimelineEntry], default: [] })
  timeline!: TimelineEntry[];

  @Prop({ type: Types.ObjectId, ref: 'Rider', index: true })
  riderId?: Types.ObjectId;

  @Prop()
  deliveryInstructions?: string;

  @Prop()
  estimatedDeliveryTime?: Date;

  @Prop()
  actualDeliveryTime?: Date;

  @Prop()
  cancellationReason?: string;

  @Prop({ required: true })
  deliveryOtp!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes for efficient queries
OrderSchema.index({ orderStatus: 1, createdAt: 1 }); // Compound index for stale order queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

// Pre-save hook for referential integrity validation
OrderSchema.pre('save', async function () {
  const order = this as OrderDocument;
  const UserModel = this.db.model('User');

  // Validate userId references existing User
  if (order.userId) {
    const user = (await UserModel.findById(order.userId).lean()) as {
      role?: string;
    } | null;
    if (!user) {
      throw new Error(
        `Invalid userId: User with ID ${order.userId} does not exist`,
      );
    }
  }

  // Validate riderId references existing Rider
  if (order.riderId) {
    const RiderModel = this.db.model('Rider');
    const rider = (await RiderModel.findById(order.riderId).lean()) as {
      _id?: string;
    } | null;
    if (!rider) {
      throw new Error(
        `Invalid riderId: Rider with ID ${order.riderId} does not exist`,
      );
    }
  }
});

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};
