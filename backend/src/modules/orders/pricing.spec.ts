import * as fc from 'fast-check';
import { calculateBill } from './pricing';
import { DEFAULT_FEES } from '../settings/fees';

describe('calculateBill', () => {
  // The rules that were hard-coded in OrdersService before fees moved to settings.
  const legacy = (itemTotal: number) => {
    const deliveryFee = itemTotal >= 200 ? 0 : 25;
    const packagingFee = 5;
    const discount = Math.round(itemTotal * 0.05);
    return {
      deliveryFee,
      packagingFee,
      discount,
      totalAmount: itemTotal + deliveryFee + packagingFee - discount,
    };
  };

  it('matches the previous hard-coded rules with the default fees', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), (itemTotal) => {
        expect(calculateBill(itemTotal, DEFAULT_FEES)).toEqual({
          itemTotal,
          freeDeliveryThreshold: 200,
          ...legacy(itemTotal),
        });
      }),
    );
  });

  it('uses the configured fees', () => {
    expect(
      calculateBill(150, {
        deliveryFee: 40,
        freeDeliveryThreshold: 100,
        packagingFee: 0,
        discountRate: 0,
      }),
    ).toEqual({
      itemTotal: 150,
      deliveryFee: 0,
      packagingFee: 0,
      discount: 0,
      totalAmount: 150,
      freeDeliveryThreshold: 100,
    });
  });
});
