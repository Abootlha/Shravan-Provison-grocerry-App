import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class AmqpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmqpService.name);
  private connection: amqp.AmqpConnectionManager;
  private channel: amqp.ChannelWrapper;
  private readonly exchange = 'order.events';
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    
    try {
      this.connection = amqp.connect([url]);
      this.connection.on('connect', () => {
        this.logger.log('Connected to RabbitMQ');
        this.isConnected = true;
      });
      this.connection.on('disconnect', (err: { err?: Error }) => {
        this.logger.warn('Disconnected from RabbitMQ', err?.err?.message);
        this.isConnected = false;
      });

      this.channel = this.connection.createChannel({
        setup: async (channel: ConfirmChannel) => {
          await channel.assertExchange(this.exchange, 'topic', { durable: true });
        },
      });

      await this.channel.waitForConnect();
      this.isConnected = true;
    } catch (error) {
      this.logger.warn('RabbitMQ not available, running without message queue');
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn('Error closing RabbitMQ connection');
    }
  }

  async publish(routingKey: string, data: Record<string, unknown>): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug(`RabbitMQ not connected, skipping publish: ${routingKey}`);
      return;
    }
    try {
      await this.channel.publish(
        this.exchange,
        routingKey,
        Buffer.from(JSON.stringify(data)),
        { persistent: true, contentType: 'application/json' },
      );
      this.logger.log(`Published event ${routingKey}: ${JSON.stringify(data)}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${routingKey}`, error);
    }
  }

  async publishOrderCreated(order: Record<string, unknown>): Promise<void> {
    await this.publish('order.created', order);
  }

  async publishStatusChanged(order: Record<string, unknown>): Promise<void> {
    await this.publish('order.status.changed', order);
  }

  async publishOrderAssigned(order: Record<string, unknown>): Promise<void> {
    await this.publish('order.assigned', order);
  }
}
