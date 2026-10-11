// Stand-in for socket.io-client's `io()` in mock mode. Implements the subset of
// the Socket API that services/socketService.js uses and plays back the same
// server events as backend/src/sockets/tracking.gateway.ts:
// joinedOrderRoom, riderLocationUpdate, etaUpdate, orderStatusUpdate.
import { findOrder } from './db';
import { trackingOrderView } from './router';

const TICK_MS = 2000;

class Emitter {
    constructor() { this.handlers = {}; }

    on(event, fn) {
        (this.handlers[event] = this.handlers[event] || []).push(fn);
        return this;
    }

    off(event, fn) {
        if (!fn) delete this.handlers[event];
        else this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== fn);
        return this;
    }

    removeAllListeners() { this.handlers = {}; return this; }

    fire(event, ...args) {
        (this.handlers[event] || []).slice().forEach((h) => {
            try { h(...args); } catch (e) { console.warn('[mock socket] handler error', e); }
        });
    }
}

class MockSocket extends Emitter {
    constructor(url, opts = {}) {
        super();
        this.url = url;
        this.auth = opts.auth;
        this.connected = false;
        this.id = null;
        this.io = new Emitter(); // Manager: reconnect events (never fired here)
        this.rooms = new Map(); // orderId -> { timer, lastStatus }
        this.connect();
    }

    connect() {
        if (this.connected) return this;
        setTimeout(() => {
            this.connected = true;
            this.id = `mock-${Math.random().toString(36).slice(2, 10)}`;
            this.fire('connect');
        }, 150);
        return this;
    }

    emit(event, payload) {
        const orderId = payload?.orderId;
        if (event === 'joinOrderRoom' && orderId) this.join(orderId);
        if (event === 'leaveOrderRoom' && orderId) this.leave(orderId);
        return this;
    }

    join(orderId) {
        if (this.rooms.has(orderId)) return;
        const room = { timer: null, lastStatus: null };
        this.rooms.set(orderId, room);
        setTimeout(() => this.fire('joinedOrderRoom', { orderId, roomName: `order_${orderId}` }), 50);
        room.timer = setInterval(() => this.pushUpdates(orderId, room), TICK_MS);
    }

    pushUpdates(orderId, room) {
        const raw = findOrder(orderId);
        if (!raw) return;
        const order = trackingOrderView(raw, { includeDeliveryOtp: false });
        const { tracking } = order;

        if (room.lastStatus && room.lastStatus !== order.orderStatus) {
            this.fire('orderStatusUpdate', {
                orderId,
                status: order.orderStatus,
                paymentStatus: order.paymentStatus,
                timeline: order.timeline,
                estimatedDeliveryTime: order.estimatedDeliveryTime,
                order,
                rider: order.rider,
                tracking,
            });
        }
        room.lastStatus = order.orderStatus;

        if (!tracking?.riderLocation) return;
        const now = new Date().toISOString();
        this.fire('riderLocationUpdate', {
            orderId,
            riderId: order.rider?.id,
            location: tracking.riderLocation,
            timestamp: now,
            tracking,
            order,
        });
        this.fire('etaUpdate', {
            orderId,
            estimatedDeliveryTime: tracking.estimatedDeliveryTime,
            durationMinutes: tracking.durationMinutes,
            distanceRemaining: tracking.distanceRemaining,
            tracking,
            order,
        });
    }

    leave(orderId) {
        const room = this.rooms.get(orderId);
        if (room) clearInterval(room.timer);
        this.rooms.delete(orderId);
    }

    disconnect() {
        Array.from(this.rooms.keys()).forEach((id) => this.leave(id));
        const was = this.connected;
        this.connected = false;
        if (was) this.fire('disconnect', 'io client disconnect');
        return this;
    }
}

export const createMockSocket = (url, opts) => new MockSocket(url, opts);
