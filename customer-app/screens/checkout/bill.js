/**
 * Bill maths for the checkout screen.
 *
 * The fees come from the server (GET /settings/store → `fees`), never from constants here.
 * `estimateBill` mirrors backend orders/pricing.ts `calculateBill` and is only an instant
 * preview while POST /orders/quote is in flight; the quote is the bill the customer pays
 * (`billFromQuote`). With no fees loaded there is no estimate at all (null), never a guess.
 */

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

const round2 = (v) => Math.round(v * 100) / 100;

const withExtras = (bill, items) => {
    const mrpSavings = mrpSavingsOf(items);
    return {
        ...bill,
        mrpSavings,
        savings: mrpSavings + (bill.discount || 0),
        freeDeliveryGap: Math.max(0, Math.ceil(bill.freeDeliveryThreshold - bill.itemTotal)),
    };
};

/** Instant preview from the settings fees (same formula as the server). Null without fees. */
export const estimateBill = (itemTotal = 0, items = [], fees = null) => {
    if (!fees) return null;
    const total = round2(itemTotal);
    const deliveryFee = total >= fees.freeDeliveryThreshold ? 0 : fees.deliveryFee;
    const packagingFee = fees.packagingFee;
    const discount = Math.round(total * fees.discountRate);
    return withExtras(
        {
            itemTotal: total,
            deliveryFee,
            packagingFee,
            discount,
            grandTotal: round2(total + deliveryFee + packagingFee - discount),
            freeDeliveryThreshold: fees.freeDeliveryThreshold,
            discountRate: fees.discountRate,
            standardDeliveryFee: fees.deliveryFee,
        },
        items,
    );
};

/** The authoritative bill from POST /orders/quote. */
export const billFromQuote = (quote, items = [], fees = null) =>
    withExtras(
        {
            itemTotal: Number(quote.itemTotal) || 0,
            deliveryFee: Number(quote.deliveryFee) || 0,
            packagingFee: Number(quote.packagingFee) || 0,
            discount: Number(quote.discount) || 0,
            grandTotal: Number(quote.totalAmount) || 0,
            freeDeliveryThreshold: Number(quote.freeDeliveryThreshold) || fees?.freeDeliveryThreshold || 0,
            discountRate: fees?.discountRate ?? null,
            standardDeliveryFee: fees?.deliveryFee ?? null,
        },
        items,
    );
