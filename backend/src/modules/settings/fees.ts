/** Checkout fees. Defaults match the values that used to be hard-coded. */
export interface StoreFeesValues {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  packagingFee: number;
  /** Fraction of the item total, e.g. 0.05 = 5%. */
  discountRate: number;
}

export const DEFAULT_FEES: Readonly<StoreFeesValues> = Object.freeze({
  deliveryFee: 25,
  freeDeliveryThreshold: 200,
  packagingFee: 5,
  discountRate: 0.05,
});

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

/** Settings documents created before fees existed fall back to the defaults. */
export function resolveFees(
  fees?: Partial<StoreFeesValues> | null,
): StoreFeesValues {
  return {
    deliveryFee: finiteOr(fees?.deliveryFee, DEFAULT_FEES.deliveryFee),
    freeDeliveryThreshold: finiteOr(
      fees?.freeDeliveryThreshold,
      DEFAULT_FEES.freeDeliveryThreshold,
    ),
    packagingFee: finiteOr(fees?.packagingFee, DEFAULT_FEES.packagingFee),
    discountRate: finiteOr(fees?.discountRate, DEFAULT_FEES.discountRate),
  };
}
