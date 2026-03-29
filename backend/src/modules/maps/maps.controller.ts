import { Controller, Get, Query } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('search')
  async search(@Query('query') query: string) {
    return this.mapsService.searchPlaces(query);
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
    return this.mapsService.reverseGeocode(parseFloat(latitude), parseFloat(longitude));
  }
}
