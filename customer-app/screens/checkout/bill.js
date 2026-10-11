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

/** MRP savings on the cart lines: sum of (mrp - price) * quantity, only where the item has a real MRP above its price. */
export const mrpSavingsOf = (items = []) =>
    Math.round(
        items.reduce((sum, item) => {
            const price = Number(item?.price) || 0;
            const mrp = Number(item?.originalPrice) || Number(item?.mrp) || Number(item?.pricing?.mrp) || 0;
            const qty = Number(item?.quantity) || 0;
            return mrp > price ? sum + (mrp - price) * qty : sum;
        }, 0),
    );

/**
 * `items` (optional): the cart lines, used only for the "You saved ₹X" figure
 * (MRP savings + store discount). Delivery and totals depend on itemTotal alone.
 */
export const computeBill = (itemTotal = 0, items = []) => {
    const deliveryFee = itemTotal >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
    const packagingFee = PACKAGING_FEE;
    const discount = Math.round(itemTotal * DISCOUNT_RATE);
    const grandTotal = Math.max(0, itemTotal + deliveryFee + packagingFee - discount);
    const mrpSavings = mrpSavingsOf(items);
    const savings = mrpSavings + discount;
    return {
        itemTotal,
        deliveryFee,
        packagingFee,
        discount,
        mrpSavings,
        grandTotal,
        savings,
        freeDeliveryGap: Math.max(0, FREE_DELIVERY_AT - itemTotal),
    };
};
