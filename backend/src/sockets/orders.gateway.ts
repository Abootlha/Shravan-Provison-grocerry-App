import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  redisConnectionOptions,
  scopedPubSubChannel,
} from '../config/redis-options';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrdersService } from '../modules/orders/orders.service';
import {
  ADMIN_ORDER_EVENTS_CHANNEL,
  ORDER_EVENT_CHANNELS,
  ORDER_EVENTS_ORIGIN,
  ORDER_STATUS_CHANNEL,
  OrderEventChannel,
  OrderEventPayload,
  localOrderEvents,
} from './order-events';
import { isStaffRole } from '../modules/users/schemas/user.schema';

/** Room on the /orders namespace that receives order:new / order:updated. */
export const ADMIN_ORDERS_ROOM = 'admin:orders';
const ADMIN_EVENTS = new Set(['order:new', 'order:updated']);

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/orders',
})
export class OrdersGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('OrdersGateway');
  private subscriber?: Redis;
  private subscriberHealthy = true;
  private onLocalEvent?: (
    channel: OrderEventChannel,
    payload: OrderEventPayload,
  ) => void;

  // Keep the constructor free of closures over `this`. OrdersService is a
  // forwardRef dependency, so Nest builds this gateway via
  // Object.assign(prototypeInstance, new OrdersGateway(...)): the object the
  // constructor sees is discarded, and @WebSocketServer() is assigned to the
  // other one. Callbacks registered here would emit through an undefined
  // `server` and every event would be silently dropped. All wiring therefore
  // happens in afterInit, which runs on the managed instance.
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}

  afterInit() {
    this.onLocalEvent = (channel, payload) => this.deliver(channel, payload);
    localOrderEvents.on('event', this.onLocalEvent);
    this.startSubscriber();
    this.logger.log('Orders WebSocket Gateway initialized');
  }

  onModuleDestroy() {
    if (this.onLocalEvent) localOrderEvents.off('event', this.onLocalEvent);
    void Promise.resolve(this.subscriber?.quit()).catch(() => undefined);
  }

  /**
   * Subscribes to this environment's order channels. Redis carries events
   * published by other app processes; events from this process are already
   * delivered through localOrderEvents, so their Redis echo is skipped.
   */
  private startSubscriber(): void {
    const subscriber = new Redis(redisConnectionOptions(this.configService));
    this.subscriber = subscriber;
    subscriber.on('error', (err: Error) => {
      if (this.subscriberHealthy) {
        this.logger.warn(`Order events subscriber error: ${err.message}`);
      }
      this.subscriberHealthy = false;
    });
    subscriber.on('ready', () => {
      this.subscriberHealthy = true;
    });

    const channels = new Map(
      ORDER_EVENT_CHANNELS.map((channel) => [
        scopedPubSubChannel(this.configService, channel),
        channel,
      ]),
    );
    void subscriber.subscribe(...channels.keys(), (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to order event channels:', err);
      } else {
        this.logger.log(`Subscribed to ${[...channels.keys()].join(', ')}`);
      }
    });

    subscriber.on('message', (scoped: string, message: string) => {
      const channel = channels.get(scoped);
      if (!channel) return;
      let data: OrderEventPayload;
      try {
        data = JSON.parse(message);
      } catch (err) {
        this.logger.error(`Failed to parse ${channel} message:`, err);
        return;
      }
      if (!data || typeof data !== 'object') return;
      if (data.origin === ORDER_EVENTS_ORIGIN) return;
      const payload = { ...data };
      delete payload.origin;
      this.deliver(channel, payload);
    });
  }

  /** Emits an order event to the matching Socket.IO room. */
  deliver(channel: OrderEventChannel, data: OrderEventPayload): void {
    if (!this.server) {
      this.logger.warn(`Dropped ${channel} event: socket server not ready`);
      return;
    }
    if (channel === ADMIN_ORDER_EVENTS_CHANNEL) {
      const event = data.event as string;
      if (!ADMIN_EVENTS.has(event)) return;
      this.server.to(ADMIN_ORDERS_ROOM).emit(event, data.order);
      return;
    }
    if (channel === ORDER_STATUS_CHANNEL && typeof data.orderId === 'string') {
      this.server.to(`order:${data.orderId}`).emit('statusUpdate', data);
    }
  }

  /** Relays a serialized admin order event to staff sockets. */
  relayAdminEvent(message: string): void {
    try {
      this.deliver(ADMIN_ORDER_EVENTS_CHANNEL, JSON.parse(message));
    } catch (err) {
      this.logger.error('Failed to parse admin order event:', err);
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake?.auth?.token;
    if (authToken && typeof authToken === 'string') return authToken;

    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') return queryToken;

    const authHeader = client.handshake?.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Authenticate the socket with the same JWT used for the REST API; reject
   * unauthenticated connections outright.
   */
  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated client ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
      if (payload?.type === 'refresh') {
        throw new Error('refresh tokens cannot open a socket');
      }
      client.data.user = { userId: payload.sub, role: payload.role };
      // Admin panel sockets get live order events without asking.
      if (isStaffRole(payload.role)) {
        await client.join(ADMIN_ORDERS_ROOM);
      }
      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      this.logger.warn(
        `Rejected client ${client.id} with invalid token: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinOrder')
  async handleJoinOrder(client: Socket, orderId: string) {
    const user = client.data?.user as
      | { userId: string; role: string }
      | undefined;
    if (!user) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    if (typeof orderId !== 'string' || !orderId) {
      return { event: 'error', data: { message: 'orderId is required' } };
    }

    const order = await this.ordersService.findAccessInfoByOrderId(orderId);
    const isOwner = order?.userId?.toString() === user.userId;
    const isAssignedRider =
      user.role === 'rider' && order?.riderId?.toString() === user.userId;
    const isAdmin = isStaffRole(user.role);

    if (!order || (!isOwner && !isAssignedRider && !isAdmin)) {
      this.logger.warn(
        `Unauthorized joinOrder attempt by ${user.userId} for ${orderId}`,
      );
      return { event: 'error', data: { message: 'Order not found' } };
    }

    client.join(`order:${orderId}`);
    this.logger.log(`Client ${client.id} joined room order:${orderId}`);
    return { event: 'joined', data: { orderId } };
  }

  /** Explicit join for clients that connect before deciding to listen. */
  @SubscribeMessage('joinAdminOrders')
  async handleJoinAdminOrders(client: Socket) {
    const user = client.data?.user as
      | { userId: string; role: string }
      | undefined;
    if (!user || !isStaffRole(user.role)) {
      return { event: 'error', data: { message: 'Admin access required' } };
    }
    await client.join(ADMIN_ORDERS_ROOM);
    return { event: 'joinedAdminOrders', data: { room: ADMIN_ORDERS_ROOM } };
  }

  @SubscribeMessage('leaveOrder')
  handleLeaveOrder(client: Socket, orderId: string) {
    client.leave(`order:${orderId}`);
    this.logger.log(`Client ${client.id} left room order:${orderId}`);
    return { event: 'left', data: { orderId } };
  }
}
