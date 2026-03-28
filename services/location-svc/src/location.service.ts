import { Injectable, Logger } from '@nestjs/common';
import { GeohashService } from './geohash.service';
import { QuadtreeService } from './quadtree.service';
import { RouteService } from './route.service';
import { EtaService } from './eta.service';
import { MapMyIndiaService } from './mapmyindia.service';

interface RouteResult {
  points: Array<{ latitude: number; longitude: number }>;
  distance_km: number;
  duration_seconds: number;
  polyline: string;
}

interface ETAResult {
  duration_seconds: number;
  formatted: string;
  arrival_time: Date;
}

interface NearbyRider {
  rider_id: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  geohash: string;
}

interface RankedRider extends NearbyRider {
  score: number;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly geohashService: GeohashService,
    private readonly quadtreeService: QuadtreeService,
    private readonly routeService: RouteService,
    private readonly etaService: EtaService,
    private readonly mapMyIndiaService: MapMyIndiaService,
  ) {}

  encodeGeohash(lat: number, lng: number, precision?: number): string {
    return this.geohashService.encode(lat, lng, precision);
  }

  decodeGeohash(hash: string): { latitude: number; longitude: number } {
    return this.geohashService.decode(hash);
  }

  getNeighborHashes(hash: string): string[] {
    return this.geohashService.getNeighbors(hash);
  }

  async calculateRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RouteResult> {
    return this.routeService.calculateRoute(originLat, originLng, destLat, destLng);
  }

  async calculateETA(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<ETAResult> {
    return this.etaService.calculateETA(originLat, originLng, destLat, destLng);
  }

  async geocode(address: string): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }> {
    return this.mapMyIndiaService.geocode(address);
  }

  async reverseGeocode(lat: number, lng: number): Promise<{
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }> {
    return this.mapMyIndiaService.reverseGeocode(lat, lng);
  }

  async updateRiderLocation(
    riderId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    await this.quadtreeService.updateRiderLocation(riderId, lat, lng);
  }

  async removeRider(riderId: string): Promise<void> {
    await this.quadtreeService.removeRider(riderId);
  }

  async findNearbyRiders(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number = 10,
  ): Promise<NearbyRider[]> {
    const riders = await this.quadtreeService.findNearbyRiders(lat, lng, radiusKm, limit);

    return riders.map(rider => ({
      rider_id: rider.rider_id,
      latitude: rider.lat,
      longitude: rider.lng,
      distance_km: this.haversineDistance(lat, lng, rider.lat, rider.lng),
      geohash: this.geohashService.encode(rider.lat, rider.lng, 6),
    }));
  }

  async rankRiders(
    lat: number,
    lng: number,
    radiusKm: number,
    limit: number = 5,
    minRating?: number,
    riderRatings?: Map<string, { rating: number; acceptanceRate: number }>,
  ): Promise<RankedRider[]> {
    const nearbyRiders = await this.findNearbyRiders(lat, lng, radiusKm, limit * 3);

    const scoredRiders = nearbyRiders.map(rider => {
      let rating = 4.5;
      let acceptanceRate = 0.8;

      if (riderRatings && riderRatings.has(rider.rider_id)) {
        const riderData = riderRatings.get(rider.rider_id)!;
        rating = riderData.rating;
        acceptanceRate = riderData.acceptanceRate;
      }

      const distanceScore = Math.max(0, 1 - rider.distance_km / radiusKm);
      const ratingScore = rating / 5;
      const acceptanceScore = acceptanceRate;

      const score = distanceScore * 0.4 + ratingScore * 0.3 + acceptanceScore * 0.2;

      return {
        ...rider,
        score,
      };
    });

    if (minRating !== undefined) {
      return scoredRiders
        .filter(r => {
          const riderData = riderRatings?.get(r.rider_id);
          return !riderData || riderData.rating >= minRating;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    return scoredRiders.sort((a, b) => b.score - a.score).slice(0, limit);
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
