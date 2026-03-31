import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import type { RiderLocation } from '../types/rider';
import type { NewOrderAssignment, OrderStatusUpdate } from '../types/order';

type SocketEventHandler = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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
  }

  disconnect(): void {
    this.stopLocationUpdates();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, handler: SocketEventHandler): void {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: SocketEventHandler): void {
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
}

export const socketService = new SocketService();
