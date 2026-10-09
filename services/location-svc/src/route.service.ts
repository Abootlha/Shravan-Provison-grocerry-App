import { Injectable, Logger } from '@nestjs/common';
import { MapMyIndiaService } from './mapmyindia.service';
import { CacheService } from './cache.service';

interface RouteResult {
  points: Array<{ latitude: number; longitude: number }>;
  distance_km: number;
  duration_seconds: number;
  polyline: string;
}

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    private readonly mapMyIndiaService: MapMyIndiaService,
    private readonly cacheService: CacheService,
  ) {}

  async calculateRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RouteResult> {
    const cachedRoute = await this.cacheService.getRouteCache(
      originLat,
      originLng,
      destLat,
      destLng,
    );

    if (cachedRoute) {
      this.logger.debug('Returning cached route');
      return JSON.parse(cachedRoute);
    }

    try {
      const result = await this.mapMyIndiaService.calculateRoute(
        originLat,
        originLng,
        destLat,
        destLng,
      );

      const routeResult: RouteResult = {
        points: [
          { latitude: originLat, longitude: originLng },
          { latitude: destLat, longitude: destLng },
        ],
        distance_km: result.distanceKm,
        duration_seconds: result.durationSeconds,
        polyline: result.polyline,
      };

      await this.cacheService.setRouteCache(
        originLat,
        originLng,
        destLat,
        destLng,
        JSON.stringify(routeResult),
      );

      return routeResult;
    } catch (error) {
      this.logger.warn(`MapMyIndia route failed, falling back to Haversine: ${error}`);
      return this.fallbackHaversineRoute(originLat, originLng, destLat, destLng);
    }
  }

  private fallbackHaversineRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): RouteResult {
    const distance = this.haversineDistance(originLat, originLng, destLat, destLng);
    const durationSeconds = Math.round((distance / 30) * 3600);

    return {
      points: [
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng },
      ],
      distance_km: distance,
      duration_seconds: durationSeconds,
      polyline: this.encodeSimplePolyline(originLat, originLng, destLat, destLng),
    };
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

  private encodeSimplePolyline(lat1: number, lng1: number, lat2: number, lng2: number): string {
    return `${lat1},${lng1}|${lat2},${lng2}`;
  }
}
