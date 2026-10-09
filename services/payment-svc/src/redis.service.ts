import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly TTL = 300;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url);

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(key: string, value: unknown, ttl: number = this.TTL): Promise<void> {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  getPaymentCacheKey(paymentId: string): string {
    return `payment:${paymentId}`;
  }

  async invalidatePaymentCache(paymentId: string): Promise<void> {
    const key = this.getPaymentCacheKey(paymentId);
    await this.del(key);
    this.logger.log(`Cache invalidated for payment: ${paymentId}`);
  }
}
