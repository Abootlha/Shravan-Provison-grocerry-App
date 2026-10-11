import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConnectionOptions } from '../config/redis-options';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ADMIN_ORDER_EVENTS_CHANNEL,
  OrdersService,
} from '../modules/orders/orders.service';
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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('OrdersGateway');
  private subscriber: Redis;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {
    // Create a separate Redis connection for subscribing
    this.subscriber = new Redis(redisConnectionOptions(this.configService));

    // Subscribe to order updates channels
    this.subscriber.subscribe(
      'order-updates',
      ADMIN_ORDER_EVENTS_CHANNEL,
      (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to order-updates:', err);
        } else {
          this.logger.log('Subscribed to order-updates channel');
        }
      },
    );

    // Listen for messages
    this.subscriber.on('message', (channel, message) => {
      if (channel === ADMIN_ORDER_EVENTS_CHANNEL) {
        this.relayAdminEvent(message);
        return;
      }
      if (channel === 'order-updates') {
        try {
          const data = JSON.parse(message);
          // Emit to specific order room
          this.server.to(`order:${data.orderId}`).emit('statusUpdate', data);
          this.logger.log(
            `Status update sent for order ${data.orderId}: ${data.status}`,
          );
        } catch (err) {
          this.logger.error('Failed to parse order update message:', err);
        }
      }
    });
  }

  /** Relays an admin order event published by OrdersService to staff sockets. */
  relayAdminEvent(message: string): void {
    try {
      const data = JSON.parse(message);
      if (!data || !ADMIN_EVENTS.has(data.event)) return;
      this.server.to(ADMIN_ORDERS_ROOM).emit(data.event, data.order);
    } catch (err) {
      this.logger.error('Failed to parse admin order event:', err);
    }
  }

  afterInit() {
    this.logger.log('Orders WebSocket Gateway initialized');
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
