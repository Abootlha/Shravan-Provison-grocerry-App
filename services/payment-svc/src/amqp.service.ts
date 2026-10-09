import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class AmqpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmqpService.name);
  private connection: amqp.AmqpConnectionManager;
  private channel: amqp.ChannelWrapper;
  private readonly exchange = 'payment.events';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    
    this.connection = amqp.connect([url]);
    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });
    this.connection.on('disconnect', (err: { err?: Error }) => {
      this.logger.error('Disconnected from RabbitMQ', err?.err?.message);
    });

    this.channel = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(this.exchange, 'topic', { durable: true });
      },
    });

    await this.channel.waitForConnect();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(routingKey: string, data: Record<string, unknown>): Promise<void> {
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
      throw error;
    }
  }

  async publishPaymentCompleted(payment: Record<string, unknown>): Promise<void> {
    await this.publish('payment.completed', payment);
  }

  async publishPaymentFailed(payment: Record<string, unknown>): Promise<void> {
    await this.publish('payment.failed', payment);
  }

  async publishPaymentRefunded(payment: Record<string, unknown>): Promise<void> {
    await this.publish('payment.refunded', payment);
  }
}
