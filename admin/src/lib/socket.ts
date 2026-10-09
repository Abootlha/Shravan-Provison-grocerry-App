import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from './config';

const SOCKET_URL = getSocketUrl();

class SocketClient {
    private socket: Socket | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();

    connect(token: string) {
        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        this.setupListeners();

        return this.socket;
    }

    private setupListeners() {
        if (!this.socket) return;

        this.socket.on('orderStatusChanged', (data: any) => {
            this.notifyListeners('orderStatusChanged', data);
        });

        this.socket.on('riderLocationBatch', (data: any) => {
            this.notifyListeners('riderLocationBatch', data);
        });

        this.socket.on('newOrderCreated', (data: any) => {
            this.notifyListeners('newOrderCreated', data);
        });

        this.socket.on('riderStatusChanged', (data: any) => {
            this.notifyListeners('riderStatusChanged', data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event: string, callback: (data: any) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: string, callback: (data: any) => void) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(callback);
        }
    }

    private notifyListeners(event: string, data: any) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => callback(data));
        }
    }

    getSocket() {
        return this.socket;
    }

    isConnected() {
        return this.socket?.connected || false;
    }
}

export const socketClient = new SocketClient();
export default socketClient;
