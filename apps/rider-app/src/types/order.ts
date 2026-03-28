export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  full: string;
  coordinates: Coordinates;
  landmark?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

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
  };
  items: OrderItem[];
  totalAmount: number;
  deliveryFee: number;
  tip?: number;
  estimatedDistance?: number;
  estimatedTime?: number;
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

export interface AvailableOrder extends Order {
  distance?: number;
  expiresAt?: string;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  location?: Coordinates;
}

export interface NewOrderAssignment {
  order: AvailableOrder;
  notification: {
    title: string;
    body: string;
  };
}
