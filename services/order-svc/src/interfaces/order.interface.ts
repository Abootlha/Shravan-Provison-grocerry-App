export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PACKED = 'PACKED',
  ASSIGNED = 'ASSIGNED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  COD = 'COD',
  UPI = 'UPI',
  CARD = 'CARD',
}

export interface DeliveryAddress {
  label: string;
  street: string;
  city: string;
  postalCode: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number];
  };
  instructions?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface TimelineEntry {
  status: OrderStatus;
  timestamp: Date;
  changedBy?: string;
  note?: string;
}

export interface OrderResponse {
  id: string;
  orderId: string;
  userId: string;
  riderId?: string;
  items: OrderItem[];
  itemTotal: number;
  deliveryFee: number;
  packagingFee: number;
  discount: number;
  totalAmount: number;
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  cancellationReason?: string;
  timeline: TimelineEntry[];
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}
