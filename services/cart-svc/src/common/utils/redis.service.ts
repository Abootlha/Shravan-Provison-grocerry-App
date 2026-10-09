import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;

    constructor(private configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        this.client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
        });
    }

    async onModuleDestroy() {
        await this.client.quit();
    }

    getClient(): Redis {
        return this.client;
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async delPattern(pattern: string): Promise<void> {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }

    async getJSON<T>(key: string): Promise<T | null> {
        const data = await this.get(key);
        return data ? JSON.parse(data) : null;
    }

    async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttlSeconds);
    }

    static Keys = {
        cart: (userId: string) => `cart-svc:cart:${userId}`,
    };
}
