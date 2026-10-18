export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  full: string;
  /** null when the backend sent no usable coordinates. Never 0,0 as a placeholder. */
  coordinates: Coordinates | null;
  type?: string;
  houseNo?: string;
  floor?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

export type OrderStatus =
  'confirmed' | 'assigned' | 'packed' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type PaymentMethod = 'COD' | 'UPI' | 'CARD' | 'WALLET';

export interface TimelineEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  pickup: {
    address: Address;
    name: string;
    phone: string;
  };
  delivery: {
    address: Address;
    name: string;
    phone: string;
    /** Person receiving the order when it is not the account holder. */
    receiverName?: string;
    receiverPhone?: string;
    instructions?: string;
  };
  items: OrderItem[];
  itemTotal?: number;
  totalAmount: number;
  deliveryFee: number;
  packagingFee?: number;
  discount?: number;
  tip: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  timeline: TimelineEntry[];
  createdAt?: string;
  acceptedAt?: string;
  packedAt?: string;
  pickedUpAt?: string;
  outForDeliveryAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  estimatedDeliveryTime?: string;
  /** Route for the active leg, computed by the backend (may be empty). */
  routeCoordinates: Coordinates[];
  activeLeg?: 'to_store' | 'to_customer' | null;
  distanceRemainingMeters?: number;
  durationMinutes?: number;
}

/** Why an order left this rider's hands while a screen still showed it. */
export interface EndedOrder {
  orderId: string;
  orderNumber?: string;
  kind: 'cancelled' | 'unassigned';
  reason: string | null;
  /** True when this rider caused it (rejected/released), so no alert is needed. */
  self: boolean;
  at: string;
}
