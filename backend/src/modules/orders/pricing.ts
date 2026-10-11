import { StoreFeesValues } from '../settings/fees';

export interface OrderBill {
  itemTotal: number;
  deliveryFee: number;
  packagingFee: number;
  discount: number;
  totalAmount: number;
  freeDeliveryThreshold: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The single bill calculation used by both POST /orders and POST /orders/quote.
 * With the default fees this reproduces the previous hard-coded rules:
 * free delivery from ₹200, ₹25 delivery, ₹5 packaging, 5% discount (rounded).
 */
export function calculateBill(
  itemTotal: number,
  fees: StoreFeesValues,
): OrderBill {
  const total = round2(itemTotal);
  const deliveryFee =
    total >= fees.freeDeliveryThreshold ? 0 : fees.deliveryFee;
  const packagingFee = fees.packagingFee;
  const discount = Math.round(total * fees.discountRate);
  return {
    itemTotal: total,
    deliveryFee,
    packagingFee,
    discount,
    totalAmount: round2(total + deliveryFee + packagingFee - discount),
    freeDeliveryThreshold: fees.freeDeliveryThreshold,
  };
}
