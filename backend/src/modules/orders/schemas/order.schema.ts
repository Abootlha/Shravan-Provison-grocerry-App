import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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
  /** Added later: older net-banking orders were recorded as CARD and stay so. */
  NETBANKING = 'NETBANKING',
}

/**
 * PayU payment category (`pg`) for each online method, used when the client doesn't name one.
 * NETBANKING → 'NB' (PayU then asks for the bank on its hosted page).
 */
export const PAYU_PG_FOR_METHOD: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.UPI]: 'UPI',
  [PaymentMethod.CARD]: 'CC',
  [PaymentMethod.NETBANKING]: 'NB',
  [PaymentMethod.WALLET]: 'CASH',
};

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Schema({ _id: false })
export class OrderItem {
  // Schema.Types.ObjectId, not Types.ObjectId: with mongoose 9 the latter
  // resolves to Mixed, which stored productId as a string and broke joins.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  price!: number;

  @Prop()
  image?: string;

  /** Pack-size variant this line sold (absent for products without variants). */
  @Prop()
  variantSku?: string;

  /** Snapshots at order time: SKU, pack label and MRP of what was sold. */
  @Prop()
  sku?: string;

  @Prop()
  unit?: string;

  @Prop()
  mrp?: number;

  /** The variant was the product's default pack (its stock is mirrored on the product). */
  @Prop()
  mirrorsTopLevel?: boolean;
}

@Schema({ _id: false })
export class TimelineEntry {
  @Prop({ type: String, enum: OrderStatus, required: true })
  status!: OrderStatus;

  @Prop({ type: Date, required: true })
  timestamp!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedBy!: Types.ObjectId;

  /** Where the rider was when recording PICKED_UP / DELIVERED. */
  @Prop({
    type: { latitude: Number, longitude: Number, accuracy: Number },
    _id: false,
  })
  location?: { latitude: number; longitude: number; accuracy?: number };

  /** e.g. "rider_rejected: <reason>" when a rider hands the order back. */
  @Prop()
  note?: string;
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

  /** When the current rider was offered the order (CONFIRMED + riderId). */
  @Prop({ type: Date })
  riderOfferedAt?: Date;

  @Prop()
  deliveryInstructions?: string;

  @Prop()
  estimatedDeliveryTime?: Date;

  @Prop()
  actualDeliveryTime?: Date;

  @Prop()
  cancellationReason?: string;

  // Never returned by default queries: only the owning customer may see it.
  @Prop({ required: true, select: false })
  deliveryOtp!: string;

  @Prop({ default: 0 })
  deliveryOtpAttempts!: number;

  // Set atomically by the request that releases reserved stock, so a
  // double-cancel can never return the same stock twice.
  @Prop({ default: false })
  stockReleased!: boolean;

  // PayU transaction id, only set when orderId exceeds PayU's 25-char limit.
  @Prop({ index: true, sparse: true })
  payuTxnId?: string;

  @Prop()
  mihpayid?: string;

  @Prop()
  paymentConfirmedAt?: Date;

  // Flags orders that need a human (refund for a paid-then-cancelled order,
  // goods cancelled after leaving the store, etc.).
  @Prop({ default: false })
  requiresManualReview!: boolean;

  @Prop()
  manualReviewReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes for efficient queries
OrderSchema.index({ orderStatus: 1, createdAt: 1 }); // Compound index for stale order queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
// Admin order filters and rider stats / active-order lookups.
OrderSchema.index({ riderId: 1, orderStatus: 1, updatedAt: -1 });
// Offer-expiry sweep: CONFIRMED orders waiting on a rider's answer.
OrderSchema.index({ orderStatus: 1, riderOfferedAt: 1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentMethod: 1, createdAt: -1 });
OrderSchema.index({ requiresManualReview: 1, createdAt: -1 });

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
        `Invalid userId: User with ID ${String(order.userId)} does not exist`,
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
        `Invalid riderId: Rider with ID ${String(order.riderId)} does not exist`,
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
