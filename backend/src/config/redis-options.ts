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

/**
 * Pub/sub channel name for this environment. Redis channels are global to the
 * server (SELECT/REDIS_DB does not isolate them), so production and the dev
 * instance on the same Redis would otherwise receive each other's events.
 */
export function scopedPubSubChannel(
  configService: ConfigService,
  channel: string,
): string {
  const env =
    configService.get<string>('nodeEnv') ||
    process.env.NODE_ENV ||
    'development';
  const db = configService.get<number>('redis.db') ?? 0;
  return `${env}:${db}:${channel}`;
}
