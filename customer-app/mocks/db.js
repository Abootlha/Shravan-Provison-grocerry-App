// In-memory mock database. On web, user-created data (profile edits, addresses,
// orders placed in mock mode, cart) is persisted to localStorage so it survives
// the full-page reload of the web payment redirect.
import { storeSettings, user as seedUser, addresses as seedAddresses, rider } from './fixtures/account';
import { buildSeedOrders, buildTimeline } from './fixtures/orders';
import { buildRoute, routeLength, bearing } from './geo';

const STORAGE_KEY = 'shravan.mockApi.v1';
const TRIP_MS = 60 * 1000; // rider covers the route in 60s (30 points, 2s ticks)
const ETA_START_MIN = 8;
const ROUTE_POINTS = 30;

// Created (non-seed) orders: CONFIRMED -> PACKED -> OUT_FOR_DELIVERY timings.
const PACKED_AFTER_MS = 12 * 1000;
const DISPATCH_AFTER_MS = 24 * 1000;

const storage = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch {
        // blocked storage (private mode, sandboxed iframe)
    }
    return null;
})();

const load = () => {
    try {
        const raw = storage?.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const saved = load() || {};

export const db = {
    profile: { ...seedUser, ...(saved.profile || {}) },
    addresses: saved.addresses || seedAddresses.map((a) => ({ ...a })),
    orders: [...(saved.createdOrders || []), ...buildSeedOrders(Date.now())],
    cart: saved.cart || [],
    settings: storeSettings,
    rider,
};

export const persist = () => {
    try {
        storage?.setItem(STORAGE_KEY, JSON.stringify({
            profile: db.profile,
            addresses: db.addresses,
            createdOrders: db.orders.filter((o) => o._mock?.created),
            cart: db.cart,
        }));
    } catch {
        // ignore quota / blocked storage
    }
};

export const resetMockDb = () => {
    try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};

export const findOrder = (id) => db.orders.find((o) => o._id === id || o.orderId === id) || null;

const storePoint = () => ({ latitude: storeSettings.location.latitude, longitude: storeSettings.location.longitude });

const destinationOf = (order) => {
    const c = order.deliveryAddress?.coordinates?.coordinates;
    return c ? { latitude: c[1], longitude: c[0] } : storePoint();
};

const routes = new Map();
const routeFor = (order) => {
    if (!routes.has(order._id)) routes.set(order._id, buildRoute(storePoint(), destinationOf(order), ROUTE_POINTS));
    return routes.get(order._id);
};

/**
 * Advances time-driven state (status progression, payment confirmation) and
 * returns the order with its current live tracking snapshot. Mutates `order`.
 */
export const tick = (order, now = Date.now()) => {
    const meta = order._mock || (order._mock = {});

    if (meta.created) {
        const isPaid = order.paymentMethod === 'COD' || order.paymentStatus === 'COMPLETED';
        if (isPaid && !meta.confirmedAt) meta.confirmedAt = now;
        if (meta.confirmedAt && order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'DELIVERED') {
            const elapsed = now - meta.confirmedAt;
            let status = 'CONFIRMED';
            if (elapsed >= DISPATCH_AFTER_MS) status = 'OUT_FOR_DELIVERY';
            else if (elapsed >= PACKED_AFTER_MS) status = 'PACKED';
            if (status === 'OUT_FOR_DELIVERY' && elapsed - DISPATCH_AFTER_MS >= TRIP_MS) status = 'DELIVERED';
            if (status !== order.orderStatus) {
                order.orderStatus = status;
                order.timeline = buildTimeline(status, meta.confirmedAt - 1000, 12 * 1000);
                order.updatedAt = new Date(now).toISOString();
                if (status !== 'CONFIRMED') order.riderId = rider._id;
                if (status === 'OUT_FOR_DELIVERY') meta.outForDeliveryAt = meta.confirmedAt + DISPATCH_AFTER_MS;
                if (status === 'DELIVERED') {
                    order.actualDeliveryTime = new Date(now).toISOString();
                    if (order.paymentMethod === 'COD') order.paymentStatus = 'COMPLETED';
                }
                persist();
            }
        }
    }
    return order;
};

/** Rider position + ETA for an order, or null when no rider is moving. */
export const liveTracking = (order, now = Date.now()) => {
    tick(order, now);
    const status = order.orderStatus;
    const meta = order._mock || {};
    const activeLeg = ['ASSIGNED', 'PACKED'].includes(status)
        ? 'to_store'
        : ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status) ? 'to_customer' : null;

    if (!activeLeg || !order.riderId) {
        return {
            activeLeg,
            riderLocation: null,
            routeCoordinates: [],
            estimatedDeliveryTime: order.estimatedDeliveryTime || null,
            durationMinutes: null,
            distanceRemaining: null,
            lastLocationUpdateAt: null,
        };
    }

    if (activeLeg === 'to_store') {
        // Rider waiting at the store while the order is packed.
        const store = storePoint();
        const eta = new Date(now + (ETA_START_MIN + 2) * 60000).toISOString();
        return {
            activeLeg,
            riderLocation: { ...store, heading: 0, speed: 0 },
            routeCoordinates: [],
            estimatedDeliveryTime: eta,
            durationMinutes: 1,
            distanceRemaining: 0,
            lastLocationUpdateAt: new Date(now).toISOString(),
        };
    }

    const route = routeFor(order);
    const startedAt = meta.outForDeliveryAt || now;
    const elapsed = Math.max(0, now - startedAt);
    const progress = meta.loop ? (elapsed % TRIP_MS) / TRIP_MS : Math.min(0.999, elapsed / TRIP_MS);
    const idx = Math.min(route.length - 2, Math.floor(progress * (route.length - 1)));
    const here = route[idx];
    const next = route[idx + 1];
    const remaining = route.slice(idx);
    // Looping demo order: keep the ETA in the 8..6 min range so it always reads
    // "about 8 min" instead of jumping from 1 back to 8 each lap.
    const durationMinutes = meta.loop
        ? Math.round(ETA_START_MIN - progress * 2)
        : Math.max(1, Math.ceil(ETA_START_MIN * (1 - progress)));
    const eta = new Date(now + durationMinutes * 60000).toISOString();

    return {
        activeLeg,
        riderLocation: { latitude: here.latitude, longitude: here.longitude, heading: Math.round(bearing(here, next)), speed: 6.5 },
        routeCoordinates: remaining,
        estimatedDeliveryTime: eta,
        durationMinutes,
        distanceRemaining: Math.round(routeLength(remaining)),
        lastLocationUpdateAt: new Date(now).toISOString(),
    };
};
