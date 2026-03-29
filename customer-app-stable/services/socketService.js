import { io } from 'socket.io-client';
import { Platform } from 'react-native';
import { store } from '../store';
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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectionDelay = 1000;
        this.reconnectionDelayMax = 10000;
    }

    getTrackingWsUrl() {
        const LOCAL_IP = '192.168.1.7';

        if (!__DEV__) {
            return 'wss://api.shravankirana.com/tracking';
        }

        if (Platform.OS === 'web') {
            return 'ws://localhost:3008/tracking';
        } else if (Platform.OS === 'ios') {
            return `ws://${LOCAL_IP}:3008/tracking`;
        } else {
            return `ws://${LOCAL_IP}:3008/tracking`;
        }
    }

    connect(token) {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }

        const socketUrl = this.getTrackingWsUrl();

        store.dispatch(setConnectionStatus('connecting'));

        this.socket = io(socketUrl, {
            auth: {
                token: token,
            },
            transports: ['websocket'],
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

            if (this.currentOrderId) {
                this.joinOrderRoom(this.currentOrderId);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            store.dispatch(setConnectionStatus('disconnected'));
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                store.dispatch(setConnectionStatus('disconnected'));
                store.dispatch(setError('Failed to connect to tracking server'));
            } else {
                store.dispatch(setConnectionStatus('reconnecting'));
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            store.dispatch(setConnectionStatus('connected'));
            this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Socket reconnection attempt:', attemptNumber);
            store.dispatch(setConnectionStatus('reconnecting'));
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Socket reconnection failed');
            store.dispatch(setConnectionStatus('disconnected'));
            store.dispatch(setError('Failed to reconnect to tracking server'));
        });

        this.socket.on('orderStatusUpdate', (data) => {
            console.log('Order status update received:', data);
            store.dispatch(updateOrderStatus({
                status: data.status,
                timeline: data.timeline,
                estimatedDeliveryTime: data.estimatedDeliveryTime,
            }));
        });

        this.socket.on('riderLocationUpdate', (data) => {
            console.log('Rider location update received:', data);
            store.dispatch(updateRiderLocation({
                location: data.location,
                timestamp: data.timestamp,
            }));
        });

        this.socket.on('etaUpdate', (data) => {
            console.log('ETA update received:', data);
            store.dispatch(updateETA({
                estimatedDeliveryTime: data.estimatedDeliveryTime,
                durationMinutes: data.durationMinutes,
                distanceRemaining: data.distanceRemaining,
            }));
        });

        this.socket.on('orderAssigned', (data) => {
            console.log('Order assigned to rider:', data);
            if (data.rider) {
                store.dispatch(updateOrderStatus({
                    status: 'ASSIGNED',
                    rider: data.rider,
                }));
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            store.dispatch(setError(error.message || 'Socket error occurred'));
        });
    }

    joinOrderRoom(orderId) {
        console.log('Joining order room:', orderId);
        this.currentOrderId = orderId;

        if (!this.socket?.connected) {
            console.warn('Cannot join order room: socket not connected (will join upon connection)');
            return;
        }

        this.socket.emit('joinOrderRoom', { orderId }, (response) => {
            if (response?.error) {
                console.error('Failed to join order room:', response.error);
                store.dispatch(setError(response.error));
            } else {
                console.log('Successfully joined order room:', orderId);
            }
        });
    }

    leaveOrderRoom(orderId) {
        if (!this.socket?.connected) {
            return;
        }

        const targetOrderId = orderId || this.currentOrderId;
        if (!targetOrderId) return;

        console.log('Leaving order room:', targetOrderId);

        this.socket.emit('leaveOrderRoom', { orderId: targetOrderId }, (response) => {
            if (response?.error) {
                console.error('Failed to leave order room:', response.error);
            } else {
                console.log('Successfully left order room:', targetOrderId);
                if (this.currentOrderId === targetOrderId) {
                    this.currentOrderId = null;
                }
            }
        });
    }

    disconnect() {
        if (this.socket) {
            console.log('Disconnecting socket');

            if (this.currentOrderId) {
                this.leaveOrderRoom(this.currentOrderId);
            }

            this.socket.disconnect();
            this.socket = null;
            this.currentOrderId = null;
            this.reconnectAttempts = 0;

            store.dispatch(setConnectionStatus('disconnected'));
        }
    }

    isConnected() {
        return this.socket?.connected || false;
    }
}

export default new SocketService();
