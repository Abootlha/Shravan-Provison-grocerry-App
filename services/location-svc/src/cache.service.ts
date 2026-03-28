import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeohashService } from './geohash.service';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ROUTE_TTL = 300;
  private readonly ETA_TTL = 120;
  private readonly RIDER_LOCATION_TTL = 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly geohashService: GeohashService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async getRouteCache(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<string | null> {
    const originHash = this.geohashService.encode(originLat, originLng, 4);
    const destHash = this.geohashService.encode(destLat, destLng, 4);
    const key = `route:${originHash}:${destHash}`;
    return this.redis.get(key);
  }

  async setRouteCache(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    routeData: string,
  ): Promise<void> {
    const originHash = this.geohashService.encode(originLat, originLng, 4);
    const destHash = this.geohashService.encode(destLat, destLng, 4);
    const key = `route:${originHash}:${destHash}`;
    await this.redis.setex(key, this.ROUTE_TTL, routeData);
  }

  async getETACache(
    lat: number,
    lng: number,
    destLat: number,
    destLng: number,
  ): Promise<string | null> {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    const roundedDestLat = Math.round(destLat * 10000) / 10000;
    const roundedDestLng = Math.round(destLng * 10000) / 10000;
    const key = `eta:${roundedLat}:${roundedLng}:${roundedDestLat}:${roundedDestLng}`;
    return this.redis.get(key);
  }

  async setETACache(
    lat: number,
    lng: number,
    destLat: number,
    destLng: number,
    etaData: string,
  ): Promise<void> {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    const roundedDestLat = Math.round(destLat * 10000) / 10000;
    const roundedDestLng = Math.round(destLng * 10000) / 10000;
    const key = `eta:${roundedLat}:${roundedLng}:${roundedDestLat}:${roundedDestLng}`;
    await this.redis.setex(key, this.ETA_TTL, etaData);
  }

  async setRiderLocation(
    riderId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const key = `rider:location:${riderId}`;
    const value = JSON.stringify({ lat, lng, timestamp: Date.now() });
    await this.redis.setex(key, this.RIDER_LOCATION_TTL, value);
  }

  async getRiderLocation(
    riderId: string,
  ): Promise<{ lat: number; lng: number; timestamp: number } | null> {
    const key = `rider:location:${riderId}`;
    const value = await this.redis.get(key);
    if (!value) return null;
    return JSON.parse(value);
  }

  async removeRiderLocation(riderId: string): Promise<void> {
    const key = `rider:location:${riderId}`;
    await this.redis.del(key);
  }

  getRedisClient(): Redis {
    return this.redis;
  }
}
