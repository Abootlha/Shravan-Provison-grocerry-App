import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
    PLACED = 'PLACED',
    CONFIRMED = 'CONFIRMED',
    PACKED = 'PACKED',
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
    productId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    quantity: number;

    @Prop({ required: true })
    price: number;

    @Prop()
    image: string;
}

@Schema({ _id: false })
export class DeliveryAddress {
    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    address: string;

    @Prop({ required: true })
    city: string;

    @Prop({ required: true })
    pincode: string;
}

@Schema({ timestamps: true })
export class Order {
    @Prop({ required: true, unique: true, index: true })
    orderId: string; // e.g., "ORD-2024-001"

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: [OrderItem], required: true })
    items: OrderItem[];

    @Prop({ required: true })
    itemTotal: number;

    @Prop({ default: 0 })
    deliveryFee: number;

    @Prop({ default: 0 })
    packagingFee: number;

    @Prop({ default: 0 })
    discount: number;

    @Prop({ required: true })
    totalAmount: number;

    @Prop({ type: DeliveryAddress, required: true })
    deliveryAddress: DeliveryAddress;

    @Prop({ type: String, enum: PaymentMethod, required: true })
    paymentMethod: PaymentMethod;

    @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
    paymentStatus: PaymentStatus;

    @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PLACED, index: true })
    orderStatus: OrderStatus;

    @Prop()
    deliveryInstructions: string;

    @Prop()
    estimatedDeliveryTime: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes for efficient queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
    [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY],
    [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
};
