import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

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

  constructor(private configService: ConfigService) {
    // Create a separate Redis connection for subscribing
    this.subscriber = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
    });

    // Subscribe to order updates channel
    this.subscriber.subscribe('order-updates', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to order-updates:', err);
      } else {
        this.logger.log('Subscribed to order-updates channel');
      }
    });

    // Listen for messages
    this.subscriber.on('message', (channel, message) => {
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

  afterInit(server: Server) {
    this.logger.log('Orders WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinOrder')
  handleJoinOrder(client: Socket, orderId: string) {
    client.join(`order:${orderId}`);
    this.logger.log(`Client ${client.id} joined room order:${orderId}`);
    return { event: 'joined', data: { orderId } };
  }

  @SubscribeMessage('leaveOrder')
  handleLeaveOrder(client: Socket, orderId: string) {
    client.leave(`order:${orderId}`);
    this.logger.log(`Client ${client.id} left room order:${orderId}`);
    return { event: 'left', data: { orderId } };
  }
}
