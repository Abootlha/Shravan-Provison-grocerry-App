import { Controller, Get, Query } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('near_lat') nearLat?: string,
    @Query('near_lng') nearLng?: string,
  ) {
    const near =
      nearLat && nearLng
        ? { latitude: parseFloat(nearLat), longitude: parseFloat(nearLng) }
        : undefined;
    return this.mapsService.searchPlaces(query, near);
  }

  @Get('geocode')
  async geocode(@Query('address') address: string) {
    return this.mapsService.geocodeAddress(address);
  }

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
  ) {
    return this.mapsService.reverseGeocode(
      parseFloat(latitude),
      parseFloat(longitude),
    );
  }
}
