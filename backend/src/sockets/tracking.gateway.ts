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
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { WsJwtGuard } from '../modules/auth/guards/ws-jwt.guard';
import { Order, OrderStatus } from '../modules/orders/schemas/order.schema';
import { OrdersService } from '../modules/orders/orders.service';
import { RidersService } from '../modules/riders/riders.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

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
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private configService: ConfigService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    const redisHost =
      this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;

    try {
      const pubClient = new Redis({
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: 3,
      });
      const subClient = pubClient.duplicate();
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log(
        `Socket.IO Redis adapter enabled for tracking gateway at ${redisHost}:${redisPort}`,
      );
    } catch (error) {
      this.logger.warn(
        `Socket.IO Redis adapter disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle client connection
   * Auto-join rider room if the connected user is a rider
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle rider joining their personal room for order notifications
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRiderRoom')
  async handleJoinRiderRoom(@ConnectedSocket() client: Socket): Promise<void> {
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
    const isAdmin = user.role === 'admin';
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
  async handleLeaveOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinOrderRoomPayload,
  ): Promise<void> {
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

    // Validate coordinates
    if (!payload.latitude || !payload.longitude) {
      throw new WsException(
        'Invalid location data: latitude and longitude are required',
      );
    }

    try {
      // Update rider location (includes throttling and validation)
      await this.ridersService.updateLocation(user.userId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
      });

      // Find all active orders for this rider
      const activeOrders = await this.orderModel
        .find({
          riderId: user.userId,
          orderStatus: {
            $in: [
              OrderStatus.ASSIGNED,
              OrderStatus.PACKED,
              OrderStatus.PICKED_UP,
              OrderStatus.OUT_FOR_DELIVERY,
            ],
          },
        })
        .select('_id')
        .lean()
        .exec();

      // Broadcast location update to all order rooms
      for (const order of activeOrders) {
        const trackingOrder =
          await this.ordersService.buildRealtimeOrderPayload(
            order._id.toString(),
          );
        this.broadcastRiderLocationUpdate(
          order._id.toString(),
          {
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
            speed: payload.speed,
          },
          user.userId,
          trackingOrder,
        );
      }

      // Send acknowledgment to rider
      client.emit('locationUpdateAck', {
        success: true,
        timestamp: new Date(),
      });

      this.logger.log(
        `Location updated for rider ${user.userId}, broadcasted to ${activeOrders.length} orders`,
      );
    } catch (error) {
      this.logger.error(
        `Location update failed for rider ${user.userId}: ${(error as Error).message}`,
      );
      throw new WsException(
        (error as Error).message || 'Failed to update location',
      );
    }
  }

  /**
   * Broadcast order status update to order room
   */
  broadcastOrderStatusUpdate(orderId: string, order: any): void {
    const roomName = `order_${orderId}`;
    const payload = {
      orderId,
      status: order.orderStatus,
      timeline: order.timeline,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      order,
      rider: order.rider || null,
      tracking: order.tracking || null,
    };
    this.server.to(roomName).emit('orderStatusUpdate', payload);
    this.server.to(roomName).emit('order.status', payload);
    this.logger.log(
      `Broadcasted status update for order ${orderId}: ${order.orderStatus}`,
    );
  }

  /**
   * Notify a specific rider about a new order assignment
   */
  notifyRiderOfAssignment(riderId: string, order: any): void {
    const roomName = `rider_${riderId}`;
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
        tip: 0,
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

  notifyRiderOrderPacked(riderId: string, order: any): void {
    const roomName = `rider_${riderId}`;
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
      order: order || null,
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
      order: order || null,
    };
    this.server.to(roomName).emit('etaUpdate', payload);
    this.server.to(roomName).emit('eta.updated', payload);
    this.logger.log(
      `Broadcasted ETA update for order ${orderId}: ${durationMinutes} minutes`,
    );
  }
}
