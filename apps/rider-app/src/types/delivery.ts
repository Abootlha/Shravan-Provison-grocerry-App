/** One completed delivery (GET /riders/me/deliveries). */
export type DeliveryPeriod = 'today' | 'week' | 'month';

export interface RiderDelivery {
  id: string;
  orderNumber: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  /** Accepted (or picked up) to delivered, minutes. */
  tripMinutes: number | null;
  customerName: string;
  address: { full: string; city: string; pincode: string; landmark?: string };
  items: { name: string; quantity: number; price: number; image?: string }[];
  itemCount: number;
  totalAmount: number;
  paymentMethod: string;
  /** Cash collected at the door (COD), else 0. */
  cashCollected: number;
  earning: { deliveryFee: number; tip: number; total: number };
}

export interface DeliveriesPage {
  deliveries: RiderDelivery[];
  page: number;
  totalPages: number;
  totals: { deliveries: number; earnings: number; cashCollected: number };
}
