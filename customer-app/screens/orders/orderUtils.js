/**
 * Shared order helpers for tracking, history, details and the ActiveOrderBar.
 * Pure functions only — no React, no Redux.
 */
import { addToCart, incrementQuantity } from '../../store/slices/cartSlice';

export const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'];
export const LIVE_STATUSES = ['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'];
export const OTP_STATUSES = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'];

export const getOrderId = (order) => order?._id || order?.id || order?.orderId;
export const isActiveOrder = (order) => ACTIVE_STATUSES.includes(String(order?.orderStatus || '').toUpperCase());

/**
 * Status → chip tone + bilingual label. Tones (see StatusChip in OrderParts):
 *   pending  sunken, secondary ink  · live / night  sunken, ink (preparing / on the way / at the door)
 *   success  green tint (delivered)  · muted  sunken, muted ink (cancelled)
 * Neutral by default; green only for the finished, successful state.
 */
const STATUS_META = {
    PENDING: { tone: 'pending', icon: 'clock-outline', en: 'Placed', hi: 'दिया गया' },
    CONFIRMED: { tone: 'live', icon: 'check', en: 'Confirmed', hi: 'पुष्टि हुई' },
    ASSIGNED: { tone: 'live', icon: 'account-check-outline', en: 'Rider assigned', hi: 'राइडर तय' },
    PACKED: { tone: 'live', icon: 'package-variant-closed', en: 'Packed', hi: 'पैक हुआ' },
    PICKED_UP: { tone: 'live', icon: 'moped', en: 'Picked up', hi: 'उठाया गया' },
    OUT_FOR_DELIVERY: { tone: 'live', icon: 'moped', en: 'Arriving', hi: 'आ रहा है' },
    ARRIVED: { tone: 'night', icon: 'home-variant', en: 'At your door', hi: 'दरवाज़े पर' },
    DELIVERED: { tone: 'success', icon: 'check-circle', en: 'Delivered', hi: 'डिलीवर हुआ' },
    CANCELLED: { tone: 'muted', icon: 'close-circle-outline', en: 'Cancelled', hi: 'रद्द' },
};

export const getStatusMeta = (status, isHi = false) => {
    const meta = STATUS_META[String(status || '').toUpperCase()] || { tone: 'pending', icon: 'information-outline', en: status || '—', hi: status || '—' };
    return { tone: meta.tone, icon: meta.icon, label: isHi ? meta.hi : meta.en };
};

/** Four customer-facing steps: Placed → Packed → On the way → Delivered. */
export const getStepIndex = (status) => {
    switch (String(status || '').toUpperCase()) {
        case 'PACKED':
            return 1;
        case 'PICKED_UP':
        case 'OUT_FOR_DELIVERY':
        case 'ARRIVED':
            return 2;
        case 'DELIVERED':
            return 3;
        case 'CANCELLED':
            return -1;
        default:
            return 0;
    }
};

/**
 * Best ETA in whole minutes, or null. Order of trust: live tracking minutes from the socket,
 * the route duration, then the stored estimatedDeliveryTime timestamp.
 */
export const getEtaMinutes = ({ order, durationRemaining, routeInfo } = {}) => {
    if (Number.isFinite(durationRemaining)) return Math.max(1, Math.round(durationRemaining));
    const tracked = order?.tracking?.durationMinutes;
    if (Number.isFinite(tracked)) return Math.max(1, Math.round(tracked));
    if (Number.isFinite(routeInfo?.durationValue)) return Math.max(1, Math.round(routeInfo.durationValue / 60));
    const eta = order?.estimatedDeliveryTime ? new Date(order.estimatedDeliveryTime).getTime() : NaN;
    if (Number.isFinite(eta)) return Math.max(1, Math.ceil((eta - Date.now()) / 60000));
    return null;
};

export const countItems = (order) => order?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

export const formatMoney = (value, decimals = 0) => {
    const n = Number(value || 0);
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export const formatOrderDate = (iso, isHi = false) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const locale = isHi ? 'hi-IN' : 'en-IN';
    const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    return `${date}, ${time}`;
};

export const formatTime = (iso, isHi = false) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(isHi ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
};

export const shortOrderCode = (order) => {
    const code = order?.orderId || getOrderId(order) || '';
    return String(code).slice(-8).toUpperCase();
};

export const getBill = (order) => {
    const itemTotal = order?.itemTotal ?? order?.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0) ?? 0;
    const deliveryFee = order?.deliveryFee ?? 0;
    const packagingFee = order?.packagingFee ?? 0;
    const discount = order?.discount ?? 0;
    const totalAmount = order?.totalAmount ?? itemTotal + deliveryFee + packagingFee - discount;
    return { itemTotal, deliveryFee, packagingFee, discount, totalAmount };
};

export const getAddressText = (order) => {
    const a = order?.deliveryAddress;
    if (!a) return '';
    const line = a.address || a.addressLine || '';
    return [line, a.city, a.pincode].filter(Boolean).join(', ');
};

export const getRider = (order) => {
    const rider = order?.rider || (typeof order?.riderId === 'object' ? order.riderId : null);
    if (!rider) return null;
    return {
        name: rider.name || null,
        phone: rider.phone || null,
        rating: rider.rating || null,
        vehicle: [rider.vehicleType, rider.vehicleNumber].filter(Boolean).join(' · '),
        vehicleType: rider.vehicleType || null,
        vehicleNumber: rider.vehicleNumber || null,
    };
};

export const initialsOf = (name = '') =>
    String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0] || '')
        .join('')
        .toUpperCase() || '?';

const PAYMENT_LABELS = { UPI: 'UPI', COD: 'Cash on delivery', CARD: 'Card', ONLINE: 'Paid online', WALLET: 'Wallet' };
export const paymentLabel = (method, isHi = false) => {
    if (isHi && String(method).toUpperCase() === 'COD') return 'कैश ऑन डिलीवरी';
    return PAYMENT_LABELS[String(method || '').toUpperCase()] || method || '—';
};

/** Adds every line of a past order to the local cart. Returns the number of units added. */
export const reorderToCart = (dispatch, order, cartItems = []) => {
    let units = 0;
    (order?.items || []).forEach((line) => {
        const id = line.productId?._id || line.productId || line._id || line.id;
        if (!id || !line.quantity) return;
        const product = typeof line.productId === 'object' ? line.productId : {};
        const exists = cartItems.some((c) => c.id === id);
        if (!exists) {
            dispatch(addToCart({ ...product, id, _id: id, name: line.name, price: line.price, image: line.image || product.image }));
        } else {
            dispatch(incrementQuantity(id));
        }
        for (let i = 1; i < line.quantity; i += 1) dispatch(incrementQuantity(id));
        units += line.quantity;
    });
    return units;
};
