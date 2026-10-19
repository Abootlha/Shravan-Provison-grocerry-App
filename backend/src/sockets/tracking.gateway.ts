import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UseGuards,
  Inject,
  forwardRef,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsJwtGuard } from '../modules/auth/guards/ws-jwt.guard';
import { OrdersService } from '../modules/orders/orders.service';
import { RidersService } from '../modules/riders/riders.service';
import { isStaffRole, UserRole } from '../modules/users/schemas/user.schema';
import { RedisService } from '../common/utils/redis.service';
import {
  SocketAuthError,
  SocketUser,
  extractSocketToken,
  rejectSocket,
  verifySocketToken,
} from './socket-auth';

/** Why a rider lost an order (sent with `orderUnassigned`). */
export type RiderUnassignReason = 'admin_unassigned' | 'rider_rejected';

// setTimeout overflows above this (~24.8 days).
const MAX_TIMER_MS = 2_147_483_647;

interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

interface JoinOrderRoomPayload {
  orderId: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private readonly locationBroadcastTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingLocationBroadcasts = new Map<
    string,
    {
      orderId: string;
      location: {
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
      };
      riderId: string;
      order?: any;
    }
  >();
  private readonly LOCATION_BROADCAST_THROTTLE_MS = 2000;

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    @Inject(forwardRef(() => RidersService))
    private ridersService: RidersService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  /**
   * Authenticates every connection during the handshake. A rejected client
   * gets `connect_error` with message 'unauthorized' and
   * `data: { code, message }`. Rooms are shared across instances by
   * RedisIoAdapter (see main.ts), not configured here.
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (error: unknown) => next(this.toConnectError(error)),
      );
    });
  }

  private async authenticate(client: Socket): Promise<SocketUser> {
    const user = await verifySocketToken(
      this.jwtService,
      this.redisService,
      extractSocketToken(client),
    );
    client.data.user = user;
    return user;
  }

  private toConnectError(error: unknown): Error {
    if (error instanceof SocketAuthError) {
      this.logger.warn(`Rejected socket handshake: ${error.code}`);
      return Object.assign(new Error(error.message), {
        data: error.toPayload(),
      });
    }
    this.logger.error(
      `Socket handshake auth failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Not an auth problem (e.g. Redis down): do not make clients refresh.
    return Object.assign(new Error('auth_unavailable'), {
      data: { code: 'AUTH_UNAVAILABLE', message: 'Please retry shortly' },
    });
  }

  /**
   * Runs after the handshake middleware. Riders are put in their own room
   * right away so assignment/cancel events cannot be missed between
   * connecting and emitting joinRiderRoom.
   */
  async handleConnection(client: Socket): Promise<void> {
    let user = client.data?.user as SocketUser | undefined;
    if (!user) {
      // Middleware not installed (should not happen): authenticate here.
      try {
        user = await this.authenticate(client);
      } catch (error) {
        if (error instanceof SocketAuthError) {
          rejectSocket(client, error);
        } else {
          client.disconnect(true);
        }
        return;
      }
    }

    this.scheduleTokenExpiry(client, user);

    if (user.role === (UserRole.RIDER as string)) {
      await client.join(this.getRiderRoomName(user.userId));
    }
    this.logger.log(`Client connected: ${client.id} (${user.role})`);
  }

  /** Closes the socket when its access token expires, with auth_error. */
  private scheduleTokenExpiry(client: Socket, user: SocketUser): void {
    if (typeof user.exp !== 'number') return;
    const ms = user.exp * 1000 - Date.now();
    if (ms > MAX_TIMER_MS) return;
    const timer = setTimeout(
      () =>
        rejectSocket(
          client,
          new SocketAuthError('TOKEN_EXPIRED', 'Access token expired'),
        ),
      Math.max(ms, 0),
    );
    timer.unref?.();
    client.data.authExpiryTimer = timer;
  }

  /**
   * Handle rider joining their personal room for order notifications
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRiderRoom')
  handleJoinRiderRoom(@ConnectedSocket() client: Socket): void {
    const user = this.getUserFromSocket(client);
    if (!user) {
      throw new WsException('Unauthorized');
    }

    const roomName = this.getRiderRoomName(user.userId);
    client.join(roomName);
    this.logger.log(`Rider ${user.userId} joined room ${roomName}`);
    const ack = { riderId: user.userId, roomName };
    client.emit('joinedRiderRoom', ack);
    client.emit('room.joined', { ...ack, type: 'rider' });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    if (client.data?.authExpiryTimer) {
      clearTimeout(client.data.authExpiryTimer);
      client.data.authExpiryTimer = undefined;
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Get user info from authenticated socket
   */
  private getUserFromSocket(client: Socket): { userId: string; role: string } {
    return client.data.user;
  }

  /**
   * Generate room name for order
   */
  private getOrderRoomName(orderId: string): string {
    return `order_${orderId}`;
  }

  private extractEntityId(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (
      typeof value.toString === 'function' &&
      value.constructor?.name === 'ObjectId'
    ) {
      return value.toString();
    }
    if (value._id) {
      return typeof value._id === 'string'
        ? value._id
        : value._id?.toString?.() || null;
    }
    if (value.id) {
      return typeof value.id === 'string'
        ? value.id
        : value.id?.toString?.() || null;
    }
    return value?.toString?.() || null;
  }

  /**
   * Socket payloads go to everyone in the order room (customer, rider, admin),
   * so never include the delivery OTP in them.
   */
  private stripSensitive(order: any): any {
    if (!order || typeof order !== 'object') return order;
    const rest = { ...order };
    delete rest.deliveryOtp;
    delete rest.deliveryOtpAttempts;
    return rest;
  }

  /**
   * Removes riders from an order room when they are no longer the assigned
   * rider (e.g. after reassignment), so they stop receiving its updates.
   */
  async evictUnassignedRiders(
    orderId: string,
    currentRiderId: string | null,
  ): Promise<void> {
    try {
      const roomName = this.getOrderRoomName(orderId);
      const room = this.server?.in?.(roomName);
      if (!room || typeof room.fetchSockets !== 'function') return;

      const sockets = await room.fetchSockets();
      for (const socket of sockets) {
        const user = socket.data?.user;
        if (user?.role === 'rider' && user.userId !== currentRiderId) {
          socket.leave(roomName);
          this.logger.log(
            `Removed rider ${user.userId} from ${roomName} (no longer assigned)`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to evict stale riders from order ${orderId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Generate room name for user
   */
  private getUserRoomName(userId: string): string {
    return `user_${userId}`;
  }

  /**
   * Generate room name for rider
   */
  private getRiderRoomName(riderId: string): string {
    return `rider_${riderId}`;
  }

  /**
   * Handle join order room request
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinOrderRoom')
  async handleJoinOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinOrderRoomPayload,
  ): Promise<void> {
    const { orderId } = payload;
    const user = this.getUserFromSocket(client);

    if (!user) {
      throw new WsException('Unauthorized: User not authenticated');
    }

    // Fetch order to validate access
    const order = await this.ordersService.findById(orderId);
    if (!order) {
      throw new WsException('Order not found');
    }

    // Check authorization
    const orderOwnerId = this.extractEntityId(order.userId);
    const assignedRiderId = this.extractEntityId(order.riderId);
    const isOwner = orderOwnerId === user.userId;
    const isAdmin = isStaffRole(user.role);
    const isAssignedRider = assignedRiderId === user.userId;

    if (!isOwner && !isAdmin && !isAssignedRider) {
      this.logger.warn({
        message: 'Unauthorized room access attempt',
        userId: user.userId,
        userRole: user.role,
        resource: `order_${orderId}`,
        timestamp: new Date().toISOString(),
        socketId: client.id,
      });
      throw new WsException(
        'Unauthorized: You do not have access to this order',
      );
    }

    // Join the room
    const roomName = this.getOrderRoomName(orderId);
    client.join(roomName);
    this.logger.log(
      `Client ${client.id} (user ${user.userId}) joined room ${roomName}`,
    );

    // Send acknowledgment
    const ack = { orderId, roomName };
    client.emit('joinedOrderRoom', ack);
    client.emit('room.joined', { ...ack, type: 'order' });
  }

  /**
   * Handle leave order room request
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveOrderRoom')
  handleLeaveOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinOrderRoomPayload,
  ): void {
    const { orderId } = payload;
    const roomName = this.getOrderRoomName(orderId);

    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room ${roomName}`);

    // Send acknowledgment
    const ack = { orderId, roomName };
    client.emit('leftOrderRoom', ack);
    client.emit('room.left', { ...ack, type: 'order' });
  }

  /**
   * Handle rider location update
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('riderLocationUpdate')
  async handleRiderLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationUpdatePayload,
  ): Promise<void> {
    const user = this.getUserFromSocket(client);

    if (!user) {
      throw new WsException('Unauthorized: User not authenticated');
    }

    if (user.role !== 'rider') {
      throw new WsException('Only riders can send location updates');
    }

    const latitude = Number(payload?.latitude);
    const longitude = Number(payload?.longitude);
    // 0 is a valid coordinate, so check for finiteness and range only.
    if (
      payload?.latitude == null ||
      payload?.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new WsException(
        'Invalid location data: latitude and longitude are required',
      );
    }

    try {
      // Saves, throttles and broadcasts to every active order room.
      const result = await this.ridersService.updateLocation(user.userId, {
        latitude,
        longitude,
        accuracy: optionalNumber(payload.accuracy),
        heading: optionalNumber(payload.heading),
        speed: optionalNumber(payload.speed),
      });

      client.emit('locationUpdateAck', {
        success: true,
        throttled: result.throttled,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Location update failed for rider ${user.userId}: ${(error as Error).message}`,
      );
      const message =
        error instanceof HttpException
          ? error.message
          : 'Failed to update location';
      throw new WsException(message);
    }
  }

  /**
   * Broadcast order status update to order room
   */
  broadcastOrderStatusUpdate(orderId: string, order: any): void {
    const roomName = `order_${orderId}`;
    const safeOrder = this.stripSensitive(order);
    const payload = {
      orderId,
      status: order.orderStatus,
      paymentStatus: order.paymentStatus,
      timeline: order.timeline,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      order: safeOrder,
      rider: order.rider || null,
      tracking: order.tracking || null,
    };
    const currentRiderId =
      order.rider?.id || this.extractEntityId(order.riderId) || null;
    void this.evictUnassignedRiders(orderId, currentRiderId);
    // The assigned rider gets it even when not in the order room; a socket
    // in both rooms receives it once.
    const rooms = currentRiderId
      ? [roomName, this.getRiderRoomName(currentRiderId)]
      : roomName;
    this.server.to(rooms).emit('orderStatusUpdate', payload);
    this.server.to(rooms).emit('order.status', payload);
    this.logger.log(
      `Broadcasted status update for order ${orderId}: ${order.orderStatus}`,
    );
  }

  /**
   * Notify a specific rider about a new order assignment
   */
  notifyRiderOfAssignment(riderId: string, rawOrder: any): void {
    const roomName = `rider_${riderId}`;
    const order = this.stripSensitive(rawOrder);
    const payload = {
      order: {
        id: order._id?.toString?.() || order.id?.toString?.(),
        orderId: order.orderId,
        orderNumber: order.orderId,
        status: order.orderStatus,
        pickup: {
          name: order.storeName || 'Store',
          phone: order.storePhone || '',
          address: {
            full: order.storeAddress || '',
            coordinates: {
              latitude: order.storeLocation?.latitude || 0,
              longitude: order.storeLocation?.longitude || 0,
            },
          },
        },
        delivery: {
          name: order.customerName || 'Customer',
          phone: order.customerPhone || '',
          address: {
            full: order.deliveryAddress?.address || '',
            coordinates: {
              latitude:
                order.deliveryAddress?.coordinates?.coordinates?.[1] || 0,
              longitude:
                order.deliveryAddress?.coordinates?.coordinates?.[0] || 0,
            },
          },
        },
        items: order.items || [],
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee || 0,
        tip: order.tip ?? 0,
      },
    };
    this.server.to(roomName).emit('newOrderAssignment', payload);
    this.server.to(roomName).emit('rider.assignment', payload);

    const orderAssignedPayload = {
      orderId: order._id?.toString?.() || order.id,
      rider: order.rider || null,
      order,
    };
    this.server
      .to(this.getOrderRoomName(order._id?.toString?.() || order.id))
      .emit('orderAssigned', orderAssignedPayload);
    this.server
      .to(this.getOrderRoomName(order._id?.toString?.() || order.id))
      .emit('order.assigned', orderAssignedPayload);
    this.logger.log(
      `Notified rider ${riderId} about new order ${order.orderId}`,
    );
  }

  notifyRiderOrderPacked(riderId: string, rawOrder: any): void {
    const roomName = `rider_${riderId}`;
    const order = this.stripSensitive(rawOrder);
    const payload = {
      orderId: order._id?.toString?.() || order.id,
      status: order.orderStatus,
      order,
      notification: {
        title: 'Order packed',
        body: `${order.orderId} is packed and ready for pickup.`,
      },
    };
    this.server.to(roomName).emit('orderPacked', payload);
    this.server.to(roomName).emit('order.packed', payload);
    this.logger.log(
      `Notified rider ${riderId} that order ${order.orderId} is packed`,
    );
  }

  /**
   * Tells a rider that an order reserved for / assigned to them was
   * cancelled, and removes their sockets from the order room.
   */
  notifyRiderOrderCancelled(
    riderId: string,
    order: { _id?: any; id?: any; orderId?: string },
    reason?: string | null,
  ): void {
    const orderId = this.extractEntityId(order._id ?? order.id) ?? '';
    const payload = {
      orderId,
      orderNumber: order.orderId ?? null,
      status: 'CANCELLED',
      reason: reason ?? null,
      cancelledAt: new Date(),
    };
    this.emitToRider(riderId, ['orderCancelled', 'order.cancelled'], payload);
    this.removeRiderFromOrderRoom(riderId, orderId);
    this.logger.log(
      `Notified rider ${riderId} that order ${orderId} was cancelled`,
    );
  }

  /**
   * Tells a rider they no longer have an order (admin unassign/reassign, or
   * their own reject), and removes their sockets from the order room.
   */
  notifyRiderOrderUnassigned(
    riderId: string,
    order: { _id?: any; id?: any; orderId?: string },
    reason: RiderUnassignReason,
  ): void {
    const orderId = this.extractEntityId(order._id ?? order.id) ?? '';
    const payload = {
      orderId,
      orderNumber: order.orderId ?? null,
      reason,
      timestamp: new Date(),
    };
    this.emitToRider(riderId, ['orderUnassigned', 'order.unassigned'], payload);
    this.removeRiderFromOrderRoom(riderId, orderId);
    this.logger.log(
      `Notified rider ${riderId} of unassignment from ${orderId} (${reason})`,
    );
  }

  private emitToRider(riderId: string, events: string[], payload: unknown) {
    if (!this.server) return;
    const room = this.getRiderRoomName(riderId);
    for (const event of events) {
      this.server.to(room).emit(event, payload);
    }
  }

  private removeRiderFromOrderRoom(riderId: string, orderId: string): void {
    if (!orderId) return;
    try {
      // Works across instances when the Redis adapter is enabled.
      this.server
        ?.in(this.getRiderRoomName(riderId))
        .socketsLeave(this.getOrderRoomName(orderId));
    } catch (error) {
      this.logger.warn(
        `Failed to remove rider ${riderId} from order ${orderId}: ${(error as Error).message}`,
      );
    }
  }

  broadcastRiderLocationUpdate(
    orderId: string,
    location: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
    },
    riderId: string,
    order?: any,
  ): void {
    const broadcastKey = `${orderId}:${riderId}`;
    this.pendingLocationBroadcasts.set(broadcastKey, {
      orderId,
      location,
      riderId,
      order,
    });

    if (this.locationBroadcastTimers.has(broadcastKey)) {
      return;
    }

    this.locationBroadcastTimers.set(
      broadcastKey,
      setTimeout(() => {
        const pending = this.pendingLocationBroadcasts.get(broadcastKey);
        this.pendingLocationBroadcasts.delete(broadcastKey);
        this.locationBroadcastTimers.delete(broadcastKey);

        if (!pending) return;
        this.emitRiderLocationUpdate(
          pending.orderId,
          pending.location,
          pending.riderId,
          pending.order,
        );
      }, this.LOCATION_BROADCAST_THROTTLE_MS),
    );
  }

  private emitRiderLocationUpdate(
    orderId: string,
    location: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
    },
    riderId: string,
    order?: any,
  ): void {
    const roomName = `order_${orderId}`;
    const payload = {
      orderId,
      riderId,
      location,
      timestamp: new Date(),
      tracking: order?.tracking || null,
      order: this.stripSensitive(order) || null,
    };
    this.server.to(roomName).emit('riderLocationUpdate', payload);
    this.server.to(roomName).emit('rider.location', payload);
    this.logger.log(
      `Broadcasted location update for rider ${riderId} to order ${orderId}`,
    );
  }

  /**
   * Broadcast ETA update to order room
   */
  broadcastETAUpdate(orderId: string, eta: Date, order?: any): void {
    const roomName = `order_${orderId}`;
    const now = new Date();
    const durationMinutes = Math.round((eta.getTime() - now.getTime()) / 60000);

    const payload = {
      orderId,
      estimatedDeliveryTime: eta,
      durationMinutes,
      distanceRemaining: order?.tracking?.distanceRemaining ?? null,
      tracking: order?.tracking || null,
      order: this.stripSensitive(order) || null,
    };
    this.server.to(roomName).emit('etaUpdate', payload);
    this.server.to(roomName).emit('eta.updated', payload);
    this.logger.log(
      `Broadcasted ETA update for order ${orderId}: ${durationMinutes} minutes`,
    );
  }
}

/** accuracy/heading/speed: iOS reports -1 when unknown, so negatives are dropped. */
function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
