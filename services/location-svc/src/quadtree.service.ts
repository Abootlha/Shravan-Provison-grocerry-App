import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeohashService } from './geohash.service';

interface RiderData {
  rider_id: string;
  lat: number;
  lng: number;
  timestamp: number;
  rating?: number;
  acceptance_rate?: number;
}

@Injectable()
export class QuadtreeService implements OnModuleDestroy {
  private readonly logger = new Logger(QuadtreeService.name);
  private readonly redis: Redis;
  private readonly geohashService: GeohashService;

  constructor(
    private readonly configService: ConfigService,
    geohashService: GeohashService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.geohashService = geohashService;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async updateRiderLocation(
    riderId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    const geohash = this.geohashService.encode(lat, lng, 6);
    const hilbertIndex = this.geohashService.hilbertIndex(lat, lng);

    const zoneKey = `riders:zone:${geohash}`;
    const pipeline = this.redis.pipeline();

    pipeline.zadd(zoneKey, hilbertIndex, riderId);
    pipeline.set(
      `rider:location:${riderId}`,
      JSON.stringify({ lat, lng, geohash, timestamp: Date.now() }),
      'EX',
      60,
    );

    const neighbors = this.geohashService.getNeighbors(geohash);
    for (const neighborHash of neighbors) {
      pipeline.zadd(`riders:zone:${neighborHash}`, hilbertIndex, riderId);
    }

    await pipeline.exec();
    this.logger.debug(`Updated location for rider ${riderId} at ${geohash}`);
  }

  async removeRider(riderId: string): Promise<void> {
    const locationStr = await this.redis.get(`rider:location:${riderId}`);
    if (locationStr) {
      const { geohash } = JSON.parse(locationStr);
      const neighbors = this.geohashService.getNeighbors(geohash);
      const keysToClean = [`riders:zone:${geohash}`, ...neighbors.map((n: string) => `riders:zone:${n}`)];

      for (const key of keysToClean) {
        await this.redis.zrem(key, riderId);
      }
    }

    await this.redis.del(`rider:location:${riderId}`);
    this.logger.debug(`Removed rider ${riderId}`);
  }

  async findNearbyRiders(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number = 10,
  ): Promise<RiderData[]> {
    const centerGeohash = this.geohashService.encode(lat, lng, 6);
    const centerHilbert = this.geohashService.hilbertIndex(lat, lng);

    const searchRadius = this.calculateSearchRadius(radiusKm);

    const candidates = new Map<string, RiderData>();

    const zonesToSearch = [
      centerGeohash,
      ...this.geohashService.getNeighbors(centerGeohash),
    ];

    for (const zoneHash of zonesToSearch) {
      const key = `riders:zone:${zoneHash}`;
      const riders = await this.redis.zrangebyscore(
        key,
        centerHilbert - searchRadius,
        centerHilbert + searchRadius,
      );

      for (const riderId of riders) {
        if (candidates.has(riderId)) continue;

        const locationStr = await this.redis.get(`rider:location:${riderId}`);
        if (locationStr) {
          const data = JSON.parse(locationStr);
          const distance = this.haversineDistance(lat, lng, data.lat, data.lng);
          if (distance <= radiusKm) {
            candidates.set(riderId, {
              rider_id: riderId,
              lat: data.lat,
              lng: data.lng,
              timestamp: data.timestamp,
            });
          }
        }
      }

      if (candidates.size >= limit * 2) break;
    }

    const results = Array.from(candidates.values())
      .map(rider => ({
        ...rider,
        distance: this.haversineDistance(lat, lng, rider.lat, rider.lng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return results;
  }

  private calculateSearchRadius(radiusKm: number): number {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(Math.PI / 180 * 28.6));
    return Math.max(latDelta, lngDelta) * 65536;
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
