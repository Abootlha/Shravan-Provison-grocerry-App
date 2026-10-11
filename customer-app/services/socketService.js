import { io } from 'socket.io-client';
import { store } from '../store';
import { TRACKING_URL } from './config';
import {
    setConnectionStatus,
    updateOrderStatus,
    updateRiderLocation,
    updateETA,
    setError,
} from '../store/slices/orderTrackingSlice';

class SocketService {
    constructor() {
        this.socket = null;
        this.currentOrderId = null;
        this.joinedOrderId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectionDelay = 1000;
        this.reconnectionDelayMax = 10000;
    }

    getTrackingWsUrl() {
        return TRACKING_URL;
    }

    connect(token) {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            if (this.currentOrderId && this.socket.connected) {
                this.joinOrderRoom(this.currentOrderId);
            }
            return;
        }

        if (this.socket && !this.socket.connected) {
            this.socket.auth = { token };
            this.socket.connect();
            return;
        }

        const socketUrl = this.getTrackingWsUrl();

        store.dispatch(setConnectionStatus('connecting'));

        // Mock mode (dev, or EXPO_PUBLIC_PERF_MOCK profiling builds) plays back fake
        // tracking events (mocks/mockSocket.js). Keep the condition inline; see services/api.js.
        const createSocket = (__DEV__ && process.env.EXPO_PUBLIC_MOCK_API === '1') || process.env.EXPO_PUBLIC_PERF_MOCK === '1'
            ? require('../mocks').createMockSocket
            : io;

        this.socket = createSocket(socketUrl, {
            auth: {
                token: token,
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: this.reconnectionDelay,
            reconnectionDelayMax: this.reconnectionDelayMax,
            reconnectionAttempts: this.maxReconnectAttempts,
            pingTimeout: 20000,
            pingInterval: 10000,
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            store.dispatch(setConnectionStatus('connected'));
            this.reconnectAttempts = 0;
            this.joinedOrderId = null;

            if (this.currentOrderId) {
                this.joinOrderRoom(this.currentOrderId);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            store.dispatch(setConnectionStatus('disconnected'));
        });

        this.socket.on('connect_error', (error) => {
            console.warn('Socket connection warning:', error.message);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                store.dispatch(setConnectionStatus('disconnected'));
                store.dispatch(setError('Failed to connect to tracking server'));
            } else {
                store.dispatch(setConnectionStatus('reconnecting'));
            }
        });

        // Reconnection events are emitted by the Manager (socket.io), not the Socket.
        const manager = this.socket.io;
        manager.on('reconnect', (attemptNumber) => {
            if (__DEV__) console.log('Socket reconnected after', attemptNumber, 'attempts');
            store.dispatch(setConnectionStatus('connected'));
            this.reconnectAttempts = 0;
            // The server forgot our rooms; join again (emits are buffered until connected).
            this.joinedOrderId = null;
            if (this.currentOrderId) {
                this.joinOrderRoom(this.currentOrderId);
            }
        });

        manager.on('reconnect_attempt', (attemptNumber) => {
            if (__DEV__) console.log('Socket reconnection attempt:', attemptNumber);
            store.dispatch(setConnectionStatus('reconnecting'));
        });

        manager.on('reconnect_failed', () => {
            console.warn('Socket reconnection failed');
            store.dispatch(setConnectionStatus('disconnected'));
            store.dispatch(setError('Failed to reconnect to tracking server'));
        });

        this.socket.on('orderStatusUpdate', (data) => {
            if (__DEV__) console.log('Order status update received:', data);
            if (this.currentOrderId && data.orderId && data.orderId !== this.currentOrderId) {
                return;
            }
            store.dispatch(updateOrderStatus({
                status: data.status,
                timeline: data.timeline,
                estimatedDeliveryTime: data.estimatedDeliveryTime,
                rider: data.rider,
                order: data.order,
                tracking: data.order?.tracking || null,
            }));
        });

        this.socket.on('riderLocationUpdate', (data) => {
            if (__DEV__) console.log('Rider location update received:', data);
            if (this.currentOrderId && data.orderId && data.orderId !== this.currentOrderId) {
                return;
            }
            store.dispatch(updateRiderLocation({
                location: {
                    latitude: data.location?.latitude ?? data.lat,
                    longitude: data.location?.longitude ?? data.lng,
                    heading: data.location?.heading ?? data.heading,
                    speed: data.location?.speed ?? data.speed,
                },
                timestamp: data.timestamp,
                tracking: data.tracking || data.order?.tracking || null,
            }));
        });

        this.socket.on('etaUpdate', (data) => {
            if (__DEV__) console.log('ETA update received:', data);
            if (this.currentOrderId && data.orderId && data.orderId !== this.currentOrderId) {
                return;
            }
            store.dispatch(updateETA({
                estimatedDeliveryTime: data.estimatedDeliveryTime || data.eta,
                durationMinutes: data.durationMinutes,
                distanceRemaining: data.distanceRemaining,
                tracking: data.tracking || data.order?.tracking || null,
            }));
        });

        this.socket.on('orderAssigned', (data) => {
            if (__DEV__) console.log('Order assigned to rider:', data);
            if (this.currentOrderId && data.orderId && data.orderId !== this.currentOrderId) {
                return;
            }
            store.dispatch(updateOrderStatus({
                status: 'ASSIGNED',
                rider: data.rider,
                order: data.order,
                tracking: data.order?.tracking || null,
            }));
        });

        this.socket.on('error', (error) => {
            console.warn('Socket error:', error);
            store.dispatch(setError(error.message || 'Socket error occurred'));
        });

        this.socket.on('joinedOrderRoom', (data) => {
            console.log('Joined order room:', data);
            this.joinedOrderId = data.orderId;
        });

        this.socket.on('exception', (error) => {
            console.warn('Socket exception:', error);
            const message = typeof error === 'string' ? error : error?.message || 'Realtime connection error';
            store.dispatch(setError(message));
        });
    }

    joinOrderRoom(orderId) {
        console.log('Joining order room:', orderId);
        const previousOrderId = this.currentOrderId;
        this.currentOrderId = orderId;

        if (!this.socket?.connected) {
            // Expected on first mount: the room is joined from the connect handler.
            if (__DEV__) console.log('Order room queued: socket not connected yet (joins on connect)');
            return;
        }

        if (previousOrderId && previousOrderId !== orderId && this.joinedOrderId === previousOrderId) {
            this.socket.emit('leaveOrderRoom', { orderId: previousOrderId });
            this.joinedOrderId = null;
        }

        if (this.joinedOrderId === orderId) {
            return;
        }

        this.socket.emit('joinOrderRoom', { orderId });
    }

    leaveOrderRoom(orderId) {
        if (!this.socket?.connected) {
            return;
        }

        const targetOrderId = orderId || this.currentOrderId;
        if (!targetOrderId) return;

        console.log('Leaving order room:', targetOrderId);

        this.socket.emit('leaveOrderRoom', { orderId: targetOrderId });
        if (this.currentOrderId === targetOrderId) {
            this.currentOrderId = null;
        }
        if (this.joinedOrderId === targetOrderId) {
            this.joinedOrderId = null;
        }
    }

    disconnect() {
        if (this.socket) {
            console.log('Disconnecting socket');

            if (this.currentOrderId) {
                this.leaveOrderRoom(this.currentOrderId);
            }

            this.socket.io?.off?.('reconnect');
            this.socket.io?.off?.('reconnect_attempt');
            this.socket.io?.off?.('reconnect_failed');
            this.socket.removeAllListeners?.();
            this.socket.disconnect();
            this.socket = null;
            this.currentOrderId = null;
            this.joinedOrderId = null;
            this.reconnectAttempts = 0;

            store.dispatch(setConnectionStatus('disconnected'));
        }
    }

    isConnected() {
        return this.socket?.connected || false;
    }
}

export default new SocketService();
