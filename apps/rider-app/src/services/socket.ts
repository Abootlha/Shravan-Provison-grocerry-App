import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import type { RiderLocation } from '../types/rider';
import type { NewOrderAssignment, OrderStatusUpdate } from '../types/order';

type SocketEventHandler = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private riderId: string = '';
  private listeners = new Map<string, Set<SocketEventHandler>>();

  connect(token: string, riderId?: string): void {
    if (this.socket?.connected) {
      return;
    }

    if (riderId) {
      this.riderId = riderId;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      // Auto-join rider room to receive order assignments
      if (this.riderId) {
        this.socket?.emit('joinRiderRoom', { riderId: this.riderId });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      // Re-join rider room on reconnect
      if (this.riderId) {
        this.socket?.emit('joinRiderRoom', { riderId: this.riderId });
      }
      this.attachStoredListeners();
    });

    this.attachStoredListeners();
  }

  setRiderId(riderId: string): void {
    this.riderId = riderId;
    if (this.socket?.connected) {
      this.socket.emit('joinRiderRoom', { riderId });
    }
  }

  disconnect(): void {
    this.stopLocationUpdates();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, handler: SocketEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: SocketEventHandler): void {
    if (handler) {
      this.listeners.get(event)?.delete(handler);
    } else {
      this.listeners.delete(event);
    }
    if (handler) {
      this.socket?.off(event, handler);
    } else {
      this.socket?.off(event);
    }
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  onNewOrderAssignment(handler: (data: NewOrderAssignment) => void): void {
    this.socket?.on('newOrderAssignment', handler);
  }

  offNewOrderAssignment(handler?: (data: NewOrderAssignment) => void): void {
    if (handler) {
      this.socket?.off('newOrderAssignment', handler);
    } else {
      this.socket?.off('newOrderAssignment');
    }
  }

  onOrderStatusUpdate(handler: (data: OrderStatusUpdate) => void): void {
    this.socket?.on('orderStatusUpdate', handler);
  }

  offOrderStatusUpdate(handler?: (data: OrderStatusUpdate) => void): void {
    if (handler) {
      this.socket?.off('orderStatusUpdate', handler);
    } else {
      this.socket?.off('orderStatusUpdate');
    }
  }

  sendLocationUpdate(location: RiderLocation): void {
    this.emit('riderLocationUpdate', location);
  }

  startLocationUpdates(
    getLocation: () => { latitude: number; longitude: number; heading?: number; speed?: number } | null
  ): void {
    if (this.locationUpdateInterval) {
      return;
    }

    this.locationUpdateInterval = setInterval(() => {
      const location = getLocation();
      if (location) {
        this.sendLocationUpdate({
          riderId: '',
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: new Date().toISOString(),
        });
      }
    }, 3000);
  }

  stopLocationUpdates(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private attachStoredListeners(): void {
    if (!this.socket) {
      return;
    }

    for (const [event, handlers] of this.listeners.entries()) {
      for (const handler of handlers) {
        this.socket.off(event, handler);
        this.socket.on(event, handler);
      }
    }
  }
}

export const socketService = new SocketService();
