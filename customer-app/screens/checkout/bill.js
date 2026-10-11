/**
 * Bill maths for the checkout screen. Mirrors OrdersService.createOrder on the
 * backend, which recomputes these values from catalogue prices and is what PayU
 * actually charges. Keep the two in sync so the amount on the "Slide to pay"
 * bar is the amount the customer pays.
 */
export const FREE_DELIVERY_AT = 200;
export const DELIVERY_FEE = 25;
export const PACKAGING_FEE = 5;
export const DISCOUNT_RATE = 0.05;

export const computeBill = (itemTotal = 0) => {
    const deliveryFee = itemTotal >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
    const packagingFee = PACKAGING_FEE;
    const discount = Math.round(itemTotal * DISCOUNT_RATE);
    const grandTotal = Math.max(0, itemTotal + deliveryFee + packagingFee - discount);
    const savings = discount + (deliveryFee === 0 ? DELIVERY_FEE : 0);
    return {
        itemTotal,
        deliveryFee,
        packagingFee,
        discount,
        grandTotal,
        savings,
        freeDeliveryGap: Math.max(0, FREE_DELIVERY_AT - itemTotal),
    };
};
