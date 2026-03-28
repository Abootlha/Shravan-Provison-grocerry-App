import { Injectable, Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AuthService, AuthenticatedUser } from './auth.service';
import { RoomService } from './room.service';
import { TrackingService } from './tracking.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { JoinOrderRoomDto, LeaveOrderRoomDto } from './dto/room.dto';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  namespace: '/',
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private redisAdapter: any;

  constructor(
    private readonly authService: AuthService,
    private readonly roomService: RoomService,
    private readonly trackingService: TrackingService,
    private readonly configService: ConfigService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    this.logger.log('Tracking Gateway initialized');

    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    
    try {
      const pubClient = new Redis(redisUrl);
      const subClient = pubClient.duplicate();

      this.redisAdapter = createAdapter(pubClient, subClient);
      server.adapter(this.redisAdapter);
      
      this.logger.log('Redis adapter configured for Socket.io');
    } catch (error) {
      this.logger.warn(`Redis adapter not configured: ${error.message}`);
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.authService.extractTokenFromHandshake(client.handshake);
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: No token provided`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const user = await this.authService.validateToken(token);
      
      (client as any).user = user;
      
      this.logger.log(`Client connected: ${client.id} (user: ${user.userId}, role: ${user.role})`);

      client.emit('connected', { 
        socketId: client.id, 
        userId: user.userId,
        message: 'Successfully connected to tracking gateway' 
      });

      if (user.role === 'admin') {
        this.roomService.joinRoom(this.server, client, this.roomService.getAdminRoom(), user);
      }
    } catch (error) {
      this.logger.warn(`Client ${client.id} connection rejected: ${error.message}`);
      client.emit('error', { message: error.message || 'Authentication failed' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = (client as any).user as AuthenticatedUser | undefined;
    
    if (user) {
      this.roomService.leaveAllRooms(this.server, client);
      this.logger.log(`Client disconnected: ${client.id} (user: ${user.userId})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id} (unauthenticated)`);
    }
  }

  @SubscribeMessage('joinOrderRoom')
  handleJoinOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinOrderRoomDto,
  ): void {
    const user = (client as any).user as AuthenticatedUser;
    
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!data.orderId) {
      client.emit('error', { message: 'orderId is required' });
      return;
    }

    const room = this.roomService.getOrderRoom(data.orderId);
    
    if (this.roomService.canJoinOrderRoom(user.userId, user.role, data.orderId)) {
      this.roomService.joinRoom(this.server, client, room, user);
      client.emit('roomJoined', { room, orderId: data.orderId });
      this.logger.log(`User ${user.userId} joined order room: ${data.orderId}`);
    } else {
      client.emit('error', { message: 'Not authorized to join this order room' });
    }
  }

  @SubscribeMessage('leaveOrderRoom')
  handleLeaveOrderRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveOrderRoomDto,
  ): void {
    const user = (client as any).user as AuthenticatedUser;
    
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!data.orderId) {
      client.emit('error', { message: 'orderId is required' });
      return;
    }

    const room = this.roomService.getOrderRoom(data.orderId);
    this.roomService.leaveRoom(this.server, client, room);
    client.emit('roomLeft', { room, orderId: data.orderId });
    this.logger.log(`User ${user.userId} left order room: ${data.orderId}`);
  }

  @SubscribeMessage('riderLocationUpdate')
  handleRiderLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdateDto,
  ): void {
    const user = (client as any).user as AuthenticatedUser;
    
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (user.role !== 'rider') {
      client.emit('error', { message: 'Only riders can update location' });
      return;
    }

    const locationData = {
      riderId: user.userId,
      lat: data.lat,
      lng: data.lng,
      heading: data.heading,
      speed: data.speed,
      timestamp: new Date(),
    };

    this.trackingService.updateRiderLocation(user.userId, locationData);
    this.logger.debug(`Rider ${user.userId} location update: ${data.lat}, ${data.lng}`);
  }

  getServer(): Server {
    return this.server;
  }
}
