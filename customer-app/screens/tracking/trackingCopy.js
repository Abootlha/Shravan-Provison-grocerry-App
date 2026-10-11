/**
 * Status-specific copy for the tracking header. `eta` true means the big line is
 * "Arriving in N minutes" (the screen's one mixed-weight Headline, number in violet); otherwise `title` is shown.
 */
export const getHeaderCopy = (status, isHi, { activeLeg, riderName } = {}) => {
    const s = String(status || '').toUpperCase();
    const rider = riderName || (isHi ? 'डिलीवरी पार्टनर' : 'Your delivery partner');
    switch (s) {
        case 'PENDING':
            return {
                micro: isHi ? 'ऑर्डर मिल गया' : 'Order received',
                title: isHi ? 'स्टोर की पुष्टि का इंतज़ार' : 'Waiting for the store to confirm',
                sub: isHi ? 'इसमें आमतौर पर कुछ ही सेकंड लगते हैं' : 'This usually takes a few seconds',
            };
        case 'CONFIRMED':
            return {
                micro: isHi ? 'ऑर्डर कन्फर्म हुआ' : 'Order confirmed',
                eta: true,
                sub: isHi ? 'स्टोर आपका सामान चुन रहा है' : 'The store is picking your items',
            };
        case 'ASSIGNED':
            return {
                micro: isHi ? 'डिलीवरी पार्टनर तय' : 'Delivery partner assigned',
                eta: true,
                sub: activeLeg === 'to_store'
                    ? isHi ? `${rider} स्टोर जा रहे हैं` : `${rider} is heading to the store`
                    : isHi ? 'आपका ऑर्डर पैक हो रहा है' : 'Your order is being packed',
            };
        case 'PACKED':
            return {
                micro: isHi ? 'ऑर्डर पैक हो गया' : 'Order packed',
                eta: true,
                sub: isHi ? 'जल्द ही रवाना होगा' : 'Leaving the store shortly',
            };
        case 'PICKED_UP':
            return {
                micro: isHi ? 'स्टोर से निकल गया' : 'Picked up from the store',
                eta: true,
                sub: isHi ? `${rider} आपके पास आ रहे हैं` : `${rider} is on the way to you`,
            };
        case 'OUT_FOR_DELIVERY':
            return {
                micro: isHi ? 'ऑर्डर रास्ते में है' : 'Order is on the way',
                eta: true,
                sub: isHi ? `${rider} आपके पास आ रहे हैं` : `${rider} is on the way to you`,
            };
        case 'ARRIVED':
            return {
                micro: isHi ? 'पहुँच गया' : 'Arrived',
                title: isHi ? 'आपका ऑर्डर दरवाज़े पर है' : 'Your order is at your door',
                sub: isHi ? 'डिलीवरी पार्टनर को OTP बताएँ' : 'Share the OTP with your delivery partner',
            };
        case 'DELIVERED':
            return {
                micro: isHi ? 'डिलीवर हो गया' : 'Delivered',
                title: isHi ? 'मज़े से खाइए' : 'Enjoy your order',
                sub: null,
            };
        case 'CANCELLED':
            return {
                micro: isHi ? 'ऑर्डर रद्द' : 'Order cancelled',
                title: isHi ? 'यह ऑर्डर रद्द हो गया' : 'This order was cancelled',
                sub: isHi ? 'अगर पैसे कटे हैं तो वे वापस आ जाएँगे' : 'Any amount paid will be refunded',
            };
        default:
            return { micro: isHi ? 'ऑर्डर' : 'Order', title: isHi ? 'ऑर्डर अपडेट हो रहा है' : 'Updating your order', sub: null };
    }
};

export const STEP_LABELS = {
    en: ['Placed', 'Packed', 'On the way', 'Delivered'],
    hi: ['ऑर्डर', 'पैक', 'रास्ते में', 'डिलीवर'],
};
