import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MapsService } from './maps.service';
import {
  GeocodeQueryDto,
  ReverseGeocodeQueryDto,
  SearchPlacesQueryDto,
} from './dto/maps-query.dto';

/**
 * Maps proxy. These endpoints are intentionally public: the customer app
 * calls them during location selection without an access token (see
 * customer-app/services/locationService.js). They are therefore validated,
 * cached in Redis and rate limited hard per client IP to protect the paid
 * Google/Mappls quotas.
 */
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(@Query() dto: SearchPlacesQueryDto) {
    const near =
      dto.near_lat !== undefined && dto.near_lng !== undefined
        ? { latitude: dto.near_lat, longitude: dto.near_lng }
        : undefined;
    return this.mapsService.searchPlaces(dto.query, near);
  }

  @Get('geocode')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async geocode(@Query() dto: GeocodeQueryDto) {
    return this.mapsService.geocodeAddress(dto.address);
  }

  @Get('reverse-geocode')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reverseGeocode(@Query() dto: ReverseGeocodeQueryDto) {
    return this.mapsService.reverseGeocode(dto.latitude, dto.longitude);
  }
}
