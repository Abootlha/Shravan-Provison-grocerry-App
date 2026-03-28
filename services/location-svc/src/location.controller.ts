import { Controller, Get, Post, Delete, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { LocationService } from './location.service';
import {
  CalculateRouteDto,
  GeoLocationDto,
  RouteResponseDto,
} from './dto/route.dto';
import {
  CalculateETADto,
  ETAResponseDto,
} from './dto/eta.dto';
import {
  UpdateRiderLocationDto,
  NearbyRidersQueryDto,
  NearbyRiderDto,
  RiderRankingQueryDto,
  GeocodeQueryDto,
  ReverseGeocodeQueryDto,
} from './dto/location.dto';

@Controller()
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post('route/calculate')
  async calculateRoute(@Body() dto: CalculateRouteDto): Promise<RouteResponseDto> {
    try {
      const result = await this.locationService.calculateRoute(
        dto.origin.latitude,
        dto.origin.longitude,
        dto.destination.latitude,
        dto.destination.longitude,
      );

      return {
        points: result.points,
        distance_km: result.distance_km,
        duration_seconds: result.duration_seconds,
        polyline: result.polyline,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to calculate route: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('eta/calculate')
  async calculateETA(@Body() dto: CalculateETADto): Promise<ETAResponseDto> {
    try {
      const result = await this.locationService.calculateETA(
        dto.origin.latitude,
        dto.origin.longitude,
        dto.destination.latitude,
        dto.destination.longitude,
      );

      return {
        duration_seconds: result.duration_seconds,
        formatted: result.formatted,
        arrival_time: result.arrival_time,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to calculate ETA: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('geocode')
  async geocode(@Query() query: GeocodeQueryDto): Promise<any> {
    try {
      const result = await this.locationService.geocode(query.address);
      return result;
    } catch (error) {
      throw new HttpException(
        `Failed to geocode address: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('reverse-geocode')
  async reverseGeocode(@Query() query: ReverseGeocodeQueryDto): Promise<any> {
    try {
      const result = await this.locationService.reverseGeocode(
        query.location.latitude,
        query.location.longitude,
      );
      return result;
    } catch (error) {
      throw new HttpException(
        `Failed to reverse geocode: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rider/location')
  async updateRiderLocation(@Body() dto: UpdateRiderLocationDto): Promise<{ success: boolean }> {
    try {
      await this.locationService.updateRiderLocation(
        dto.rider_id,
        dto.location.latitude,
        dto.location.longitude,
      );
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to update rider location: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('rider/:riderId/location')
  async removeRider(@Query('riderId') riderId: string): Promise<{ success: boolean }> {
    try {
      await this.locationService.removeRider(riderId);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        `Failed to remove rider: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('riders/nearby')
  async getNearbyRiders(@Query() query: NearbyRidersQueryDto): Promise<{ riders: any[] }> {
    try {
      const riders = await this.locationService.findNearbyRiders(
        query.location.latitude,
        query.location.longitude,
        query.radius_km,
        query.limit,
      );
      return { riders };
    } catch (error) {
      throw new HttpException(
        `Failed to find nearby riders: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('riders/ranked')
  async getRankedRiders(@Query() query: RiderRankingQueryDto): Promise<{ riders: any[] }> {
    try {
      const riders = await this.locationService.rankRiders(
        query.location.latitude,
        query.location.longitude,
        query.radius_km,
        query.limit,
        query.min_rating,
      );
      return { riders };
    } catch (error) {
      throw new HttpException(
        `Failed to rank riders: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('geohash/encode')
  encodeGeohash(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('precision') precision?: number,
  ): { geohash: string } {
    return { geohash: this.locationService.encodeGeohash(lat, lng, precision) };
  }

  @Get('geohash/decode')
  decodeGeohash(@Query('hash') hash: string): GeoLocationDto {
    const result = this.locationService.decodeGeohash(hash);
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  }

  @Get('geohash/neighbors')
  getNeighborHashes(@Query('hash') hash: string): { neighbors: string[] } {
    return { neighbors: this.locationService.getNeighborHashes(hash) };
  }
}
