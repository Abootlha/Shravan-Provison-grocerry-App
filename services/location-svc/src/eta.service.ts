import { Injectable, Logger } from '@nestjs/common';
import { MapMyIndiaService } from './mapmyindia.service';
import { CacheService } from './cache.service';

interface ETAResult {
  duration_seconds: number;
  formatted: string;
  arrival_time: Date;
}

@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);

  constructor(
    private readonly mapMyIndiaService: MapMyIndiaService,
    private readonly cacheService: CacheService,
  ) {}

  async calculateETA(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<ETAResult> {
    const cachedEta = await this.cacheService.getETACache(
      originLat,
      originLng,
      destLat,
      destLng,
    );

    if (cachedEta) {
      this.logger.debug('Returning cached ETA');
      const parsed = JSON.parse(cachedEta);
      return {
        ...parsed,
        arrival_time: new Date(parsed.arrival_time),
      };
    }

    try {
      const result = await this.mapMyIndiaService.calculateDistance(
        originLat,
        originLng,
        destLat,
        destLng,
      );

      const etaResult = this.formatETA(result.durationSeconds);

      await this.cacheService.setETACache(
        originLat,
        originLng,
        destLat,
        destLng,
        JSON.stringify(etaResult),
      );

      return etaResult;
    } catch (error) {
      this.logger.warn(`MapMyIndia distance failed, falling back to Haversine: ${error}`);
      return this.fallbackHaversineETA(originLat, originLng, destLat, destLng);
    }
  }

  private fallbackHaversineETA(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): ETAResult {
    const distance = this.haversineDistance(originLat, originLng, destLat, destLng);
    const avgSpeedKmh = 25;
    const durationSeconds = Math.round((distance / avgSpeedKmh) * 3600);

    return this.formatETA(durationSeconds);
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

  private formatETA(durationSeconds: number): ETAResult {
    const arrivalTime = new Date(Date.now() + durationSeconds * 1000);
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);

    let formatted: string;
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m`;
    } else {
      formatted = `${minutes}m`;
    }

    return {
      duration_seconds: durationSeconds,
      formatted,
      arrival_time: arrivalTime,
    };
  }
}
