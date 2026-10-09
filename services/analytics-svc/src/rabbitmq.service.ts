import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: amqp.Channel;

  constructor(private readonly analyticsService: AnalyticsService) {}

  async onModuleInit() {
    await this.connect();
    await this.setupConsumers();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async connect() {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
  }

  private async setupConsumers() {
    await this.channel.assertExchange('order.events', 'topic', { durable: true });
    await this.channel.assertExchange('rider.events', 'topic', { durable: true });

    await this.channel.assertQueue('analytics.order.events', { durable: true });
    await this.channel.assertQueue('analytics.rider.events', { durable: true });

    await this.channel.bindQueue('analytics.order.events', 'order.events', 'order.*');
    await this.channel.bindQueue('analytics.rider.events', 'rider.events', 'rider.*');

    this.channel.consume('analytics.order.events', async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());
        await this.analyticsService.trackOrderEvent(event);
        this.channel.ack(msg);
      }
    });

    this.channel.consume('analytics.rider.events', async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());
        await this.analyticsService.trackRiderEvent(event);
        this.channel.ack(msg);
      }
    });
  }
}
