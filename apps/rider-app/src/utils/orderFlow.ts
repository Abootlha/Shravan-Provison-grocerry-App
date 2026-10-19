import type { Coordinates, Order, OrderStatus } from '../types/order';
import type { IconName, PillTone } from '../components/ui';

export type Leg = 'store' | 'customer';

export type StageInfo = {
  /** Big headline for the delivery screen and home card. */
  title: string;
  hint: string;
  leg: Leg;
  pill: { label: string; tone: PillTone; icon: IconName };
};

export const stageOf = (order: Order): StageInfo => {
  switch (order.status) {
    case 'confirmed':
      return {
        title: 'New order request',
        hint: 'Accept to start this delivery.',
        leg: 'store',
        pill: { label: 'New request', tone: 'brand', icon: 'bell-ring' },
      };
    case 'assigned':
      return {
        title: 'Go to the store',
        hint: 'The store is packing this order. Pick it up once it is ready.',
        leg: 'store',
        pill: { label: 'Packing', tone: 'warning', icon: 'package-variant' },
      };
    case 'packed':
      return {
        title: 'Pick up the order',
        hint: 'The order is packed. Check the items and confirm pickup at the counter.',
        leg: 'store',
        pill: { label: 'Ready for pickup', tone: 'success', icon: 'package-variant-closed-check' },
      };
    case 'picked_up':
      return {
        title: 'Start the delivery',
        hint: 'Order collected. Start the trip to the customer.',
        leg: 'customer',
        pill: { label: 'Picked up', tone: 'brand', icon: 'bag-checked' },
      };
    case 'out_for_delivery':
      return {
        title: 'Deliver to customer',
        hint: 'Ask the customer for the 4-digit delivery code.',
        leg: 'customer',
        pill: { label: 'On the way', tone: 'brand', icon: 'moped' },
      };
    case 'delivered':
      return {
        title: 'Delivered',
        hint: 'This order is complete.',
        leg: 'customer',
        pill: { label: 'Delivered', tone: 'success', icon: 'check-circle' },
      };
    case 'cancelled':
    default:
      return {
        title: 'Cancelled',
        hint: 'This order was cancelled.',
        leg: 'customer',
        pill: { label: 'Cancelled', tone: 'danger', icon: 'close-circle' },
      };
  }
};

export const destinationOf = (
  order: Order
): { leg: Leg; name: string; address: string; coords: Coordinates | null; phone: string } => {
  const leg = stageOf(order).leg;
  if (leg === 'store') {
    return {
      leg,
      name: order.pickup.name,
      address: order.pickup.address.full,
      coords: order.pickup.address.coordinates,
      phone: order.pickup.phone,
    };
  }
  return {
    leg,
    name: order.delivery.receiverName || order.delivery.name,
    address: order.delivery.address.full,
    coords: order.delivery.address.coordinates,
    phone: order.delivery.receiverPhone || order.delivery.phone,
  };
};

export const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'assigned', label: 'Accepted' },
  { status: 'packed', label: 'Packed' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'out_for_delivery', label: 'On the way' },
  { status: 'delivered', label: 'Delivered' },
];

export const stepIndex = (status: OrderStatus): number => {
  if (status === 'confirmed') return -1;
  if (status === 'cancelled') return -1;
  return STEPS.findIndex((step) => step.status === status);
};

export const stepTime = (order: Order, status: OrderStatus): string | undefined =>
  ({
    assigned: order.acceptedAt,
    packed: order.packedAt,
    picked_up: order.pickedUpAt,
    out_for_delivery: order.outForDeliveryAt,
    delivered: order.deliveredAt,
    confirmed: undefined,
    cancelled: order.cancelledAt,
  })[status];

/** Cash the rider must collect at the door; 0 for prepaid orders. */
export const cashToCollect = (order: Order): number =>
  order.paymentMethod === 'COD' && order.paymentStatus !== 'COMPLETED' ? order.totalAmount : 0;

/** What this delivery pays the rider, on the same basis as /riders/me/metrics. */
export const riderEarning = (order: Order): number => (order.deliveryFee || 0) + (order.tip || 0);

export const itemCount = (order: Order): number => order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

export const addressDetails = (order: Order): string => {
  const a = order.delivery.address;
  return [a.houseNo, a.floor && `Floor ${a.floor}`].filter(Boolean).join(' · ');
};
