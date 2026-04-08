import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
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
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
    @Inject(forwardRef(() => RidersService))
    private ridersService: RidersService,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) { }

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
    client.emit('joinedRiderRoom', { riderId: user.userId, roomName });
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
    if (typeof value.toString === 'function' && value.constructor?.name === 'ObjectId') {
      return value.toString();
    }
    if (value._id) {
      return typeof value._id === 'string' ? value._id : value._id?.toString?.() || null;
    }
    if (value.id) {
      return typeof value.id === 'string' ? value.id : value.id?.toString?.() || null;
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
      throw new WsException('Unauthorized: You do not have access to this order');
    }

    // Join the room
    const roomName = this.getOrderRoomName(orderId);
    client.join(roomName);
    this.logger.log(`Client ${client.id} (user ${user.userId}) joined room ${roomName}`);

    // Send acknowledgment
    client.emit('joinedOrderRoom', { orderId, roomName });
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
    client.emit('leftOrderRoom', { orderId, roomName });
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
      throw new WsException('Invalid location data: latitude and longitude are required');
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
            $in: [OrderStatus.ASSIGNED, OrderStatus.PACKED, OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY],
          },
        })
        .select('_id')
        .lean()
        .exec();

      // Broadcast location update to all order rooms
      for (const order of activeOrders) {
        const trackingOrder = await this.ordersService.buildRealtimeOrderPayload(order._id.toString());
        this.broadcastRiderLocationUpdate(
          order._id.toString(),
          {
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
            speed: payload.speed
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
      this.logger.error(`Location update failed for rider ${user.userId}: ${(error as Error).message}`);
      throw new WsException((error as Error).message || 'Failed to update location');
    }
  }

  /**
   * Broadcast order status update to order room
   */
  broadcastOrderStatusUpdate(orderId: string, order: any): void {
    const roomName = `order_${orderId}`;
    this.server.to(roomName).emit('orderStatusUpdate', {
      orderId,
      status: order.orderStatus,
      timeline: order.timeline,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      order,
      rider: order.rider || null,
      tracking: order.tracking || null,
    });
    this.logger.log(`Broadcasted status update for order ${orderId}: ${order.orderStatus}`);
  }

  /**
   * Notify a specific rider about a new order assignment
   */
  notifyRiderOfAssignment(riderId: string, order: any): void {
    const roomName = `rider_${riderId}`;
    this.server.to(roomName).emit('newOrderAssignment', {
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
              latitude: order.deliveryAddress?.coordinates?.coordinates?.[1] || 0,
              longitude: order.deliveryAddress?.coordinates?.coordinates?.[0] || 0,
            },
          },
        },
        items: order.items || [],
        totalAmount: order.totalAmount,
        deliveryFee: order.deliveryFee || 0,
        tip: 0,
      },
    });
    this.server.to(this.getOrderRoomName(order._id?.toString?.() || order.id)).emit('orderAssigned', {
      orderId: order._id?.toString?.() || order.id,
      rider: order.rider || null,
      order,
    });
    this.logger.log(`Notified rider ${riderId} about new order ${order.orderId}`);
  }

  notifyRiderOrderPacked(riderId: string, order: any): void {
    const roomName = `rider_${riderId}`;
    this.server.to(roomName).emit('orderPacked', {
      orderId: order._id?.toString?.() || order.id,
      status: order.orderStatus,
      order,
      notification: {
        title: 'Order packed',
        body: `${order.orderId} is packed and ready for pickup.`,
      },
    });
    this.logger.log(`Notified rider ${riderId} that order ${order.orderId} is packed`);
  }

  broadcastRiderLocationUpdate(
    orderId: string,
    location: { latitude: number; longitude: number; heading?: number; speed?: number },
    riderId: string,
    order?: any,
  ): void {
    const roomName = `order_${orderId}`;
    this.server.to(roomName).emit('riderLocationUpdate', {
      riderId,
      location,
      timestamp: new Date(),
      tracking: order?.tracking || null,
      order: order || null,
    });
    this.logger.log(`Broadcasted location update for rider ${riderId} to order ${orderId}`);
  }

  /**
   * Broadcast ETA update to order room
   */
  broadcastETAUpdate(orderId: string, eta: Date, order?: any): void {
    const roomName = `order_${orderId}`;
    const now = new Date();
    const durationMinutes = Math.round((eta.getTime() - now.getTime()) / 60000);

    this.server.to(roomName).emit('etaUpdate', {
      orderId,
      estimatedDeliveryTime: eta,
      durationMinutes,
      distanceRemaining: order?.tracking?.distanceRemaining ?? null,
      tracking: order?.tracking || null,
      order: order || null,
    });
    this.logger.log(`Broadcasted ETA update for order ${orderId}: ${durationMinutes} minutes`);
  }
}
