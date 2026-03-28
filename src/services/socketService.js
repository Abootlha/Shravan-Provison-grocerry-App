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
        this.maxReconnectAttempts = 5;
    }

    getSocketUrl() {
        const LOCAL_IP = '192.168.1.7';

        if (!__DEV__) {
            return 'https://api.shravankirana.com';
        }

        if (Platform.OS === 'web') {
            return 'http://localhost:3000';
        } else if (Platform.OS === 'ios') {
            return `http://${LOCAL_IP}:3000`;
        } else {
            return `http://${LOCAL_IP}:3000`;
        }
    }

    connect(token) {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }

        const socketUrl = this.getSocketUrl();

        store.dispatch(setConnectionStatus('connecting'));

        this.socket = io(`${socketUrl}/tracking`, {
            auth: {
                token: token,
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts,
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            store.dispatch(setConnectionStatus('connected'));
            this.reconnectAttempts = 0;

            // Re-join order room if we were tracking an order
            if (this.currentOrderId) {
                this.joinOrderRoom(this.currentOrderId);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            store.dispatch(setConnectionStatus('disconnected'));
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
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

        // Order tracking events
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
            }));
        });

        // Error events
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

        console.log('Leaving order room:', orderId);

        this.socket.emit('leaveOrderRoom', { orderId }, (response) => {
            if (response?.error) {
                console.error('Failed to leave order room:', response.error);
            } else {
                console.log('Successfully left order room:', orderId);
                if (this.currentOrderId === orderId) {
                    this.currentOrderId = null;
                }
            }
        });
    }

    disconnect() {
        if (this.socket) {
            console.log('Disconnecting socket');

            // Leave current order room before disconnecting
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

// Export singleton instance
export default new SocketService();
