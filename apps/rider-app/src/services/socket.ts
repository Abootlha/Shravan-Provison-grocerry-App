import { io, Socket } from 'socket.io-client';
import { LOCATION_UPDATE_INTERVAL, SOCKET_URL } from '../utils/constants';
import type { RiderLocation } from '../types/rider';
import type { NewOrderAssignment, OrderStatusUpdate } from '../types/order';

type SocketEventHandler = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private locationUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private riderId: string = '';
  private listeners = new Map<string, Set<SocketEventHandler>>();

  private token: string | null = null;
  private refCount = 0;

  /** Register a consumer; the socket stays open while at least one consumer holds it. */
  retain(): void {
    this.refCount += 1;
  }

  /** Drop a consumer; the socket is closed when the last consumer releases it. */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      this.disconnect();
    }
  }

  connect(token: string, riderId?: string): void {
    if (riderId) {
      this.riderId = riderId;
    }

    if (this.socket) {
      if (this.token === token) {
        // Same session: reuse the existing socket (connected or still reconnecting).
        if (riderId && this.socket.connected) {
          this.joinRooms();
        }
        return;
      }
      // Token changed (refresh or new login): dispose the old socket before creating a new one.
      this.disposeSocket();
    }

    this.token = token;
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    this.socket = socket;

    let initialConnectHandled = false;
    socket.on('connect', () => {
      if (__DEV__) console.log('Socket connected:', socket.id);
      // Reconnects re-join via the manager 'reconnect' handler below.
      if (!initialConnectHandled) {
        initialConnectHandled = true;
        this.joinRooms();
      }
    });

    socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // 'reconnect' is emitted by the Manager (socket.io), not by the Socket.
    socket.io.on('reconnect', (attemptNumber) => {
      if (__DEV__) console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.joinRooms();
    });

    this.attachStoredListeners();
  }

  private joinRooms(): void {
    if (this.riderId) {
      this.socket?.emit('joinRiderRoom', { riderId: this.riderId });
    }
  }

  private disposeSocket(): void {
    if (!this.socket) {
      return;
    }
    this.socket.io.off('reconnect');
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.token = null;
  }

  setRiderId(riderId: string): void {
    this.riderId = riderId;
    if (this.socket?.connected) {
      this.socket.emit('joinRiderRoom', { riderId });
    }
  }

  disconnect(): void {
    this.stopLocationUpdates();
    this.disposeSocket();
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
    this.on('newOrderAssignment', handler as SocketEventHandler);
  }

  offNewOrderAssignment(handler?: (data: NewOrderAssignment) => void): void {
    if (handler) {
      this.off('newOrderAssignment', handler as SocketEventHandler);
    } else {
      this.off('newOrderAssignment');
    }
  }

  onOrderStatusUpdate(handler: (data: OrderStatusUpdate) => void): void {
    this.on('orderStatusUpdate', handler as SocketEventHandler);
  }

  offOrderStatusUpdate(handler?: (data: OrderStatusUpdate) => void): void {
    if (handler) {
      this.off('orderStatusUpdate', handler as SocketEventHandler);
    } else {
      this.off('orderStatusUpdate');
    }
  }

  onOrderPacked(handler: (data: { orderId: string; status: string; order?: unknown }) => void): void {
    this.on('orderPacked', handler as SocketEventHandler);
  }

  offOrderPacked(handler?: (data: { orderId: string; status: string; order?: unknown }) => void): void {
    if (handler) {
      this.off('orderPacked', handler as SocketEventHandler);
    } else {
      this.off('orderPacked');
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
    }, LOCATION_UPDATE_INTERVAL);
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
