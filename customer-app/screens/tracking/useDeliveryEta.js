/**
 * The tracking headline's minutes. Derived only from the server's delivery time
 * (order.estimatedDeliveryTime, kept live by etaUpdate / tracking events) and re-read every
 * 15s so it counts down between socket events.
 *
 * It never counts UP silently: small jitter (+1 min) is held at the lowest number already
 * shown; a real slip (2+ min later than shown) shows the new number WITH a reason line
 * ("Your rider is taking a longer route" style), picked from the order status.
 *
 *   const { minutes, delayNote } = useDeliveryEta(order, status, isHi);
 */
import { useEffect, useRef, useState } from 'react';
import { getEtaMinutes } from '../orders/orderUtils';

const TICK_MS = 15000;
const JITTER_MIN = 1;

const delayReason = (status, isHi) => {
    switch (status) {
        case 'PICKED_UP':
        case 'OUT_FOR_DELIVERY':
            return isHi ? 'डिलीवरी पार्टनर लंबे रास्ते से आ रहे हैं, इसलिए थोड़ी देर लगेगी' : 'Your rider is taking a longer route, so it’s running a little late';
        case 'ASSIGNED':
        case 'PACKED':
            return isHi ? 'डिलीवरी पार्टनर को स्टोर पहुँचने में थोड़ी देर लग रही है' : 'Your rider is taking a little longer to reach the store';
        default:
            return isHi ? 'स्टोर पर ऑर्डर ज़्यादा हैं, पैकिंग में थोड़ी देर लग रही है' : 'The store is busy, so packing is taking a little longer';
    }
};

export function useDeliveryEta(order, status, isHi) {
    // The interval only forces a re-render; the clock is read fresh each render, so a server
    // time that just arrived ("now + 10 min") reads 10, not 11 against a stale timestamp.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
        return () => clearInterval(id);
    }, []);

    const raw = getEtaMinutes({ order, now: Date.now() });
    const orderKey = order?._id || order?.orderId || null;
    const lowest = useRef({ key: null, value: null });
    if (lowest.current.key !== orderKey) lowest.current = { key: orderKey, value: null };

    if (!Number.isFinite(raw)) return { minutes: null, delayNote: null };
    const low = lowest.current.value;
    if (low == null || raw <= low) {
        lowest.current.value = raw;
        return { minutes: raw, delayNote: null };
    }
    if (raw - low <= JITTER_MIN) return { minutes: low, delayNote: null };
    // A real slip: show the honest number and say why (until it's back near what we promised).
    return { minutes: raw, delayNote: delayReason(status, isHi) };
}

export default useDeliveryEta;
