import { ConfigService } from '@nestjs/config';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
}

/**
 * Connection settings shared by EVERY Redis client (cache/sessions, BullMQ,
 * Socket.IO pub/sub). Keeping them in one place guarantees that REDIS_DB is
 * applied everywhere, so two environments on one Redis server never share
 * sessions, OTPs or queues.
 */
export function redisConnectionOptions(
  configService: ConfigService,
): RedisConnectionOptions {
  return {
    host: configService.get<string>('redis.host') || 'localhost',
    port: configService.get<number>('redis.port') || 6379,
    password: configService.get<string>('redis.password') || undefined,
    db: configService.get<number>('redis.db') ?? 0,
  };
}
