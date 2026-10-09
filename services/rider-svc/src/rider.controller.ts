import { Controller, Get, Post, Put, Body, Param, Query, Logger } from '@nestjs/common';
import { RiderService } from './rider.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AvailabilityDto } from './dto/availability.dto';

@Controller('riders')
export class RiderController {
  private readonly logger = new Logger(RiderController.name);

  constructor(private readonly riderService: RiderService) {}

  @Get()
  async findAll(@Query('status') status?: 'available' | 'busy' | 'offline') {
    this.logger.log(`Listing riders with status filter: ${status || 'all'}`);
    return {
      riders: await this.riderService.findAll(status),
    };
  }

  @Post()
  async create(@Body('userId') userId: string, @Body('vehicleType') vehicleType?: string) {
    this.logger.log(`Creating rider for user: ${userId}`);
    return this.riderService.createRider(userId, vehicleType);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    this.logger.log(`Finding rider by ID: ${id}`);
    return this.riderService.findById(id);
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string) {
    this.logger.log(`Finding rider by user ID: ${userId}`);
    return this.riderService.findByUserId(userId);
  }

  @Put(':id/location')
  async updateLocation(@Param('id') id: string, @Body() locationDto: UpdateLocationDto) {
    this.logger.log(`Updating location for rider: ${id}`);
    return this.riderService.updateLocation(id, locationDto);
  }

  @Put(':id/availability')
  async toggleAvailability(@Param('id') id: string, @Body() availabilityDto: AvailabilityDto) {
    this.logger.log(`Toggling availability for rider: ${id}`);
    return this.riderService.toggleAvailability(id, availabilityDto);
  }

  @Get('nearby/search')
  async findNearby(
    @Query('longitude') longitude: string,
    @Query('latitude') latitude: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const query = {
      longitude: parseFloat(longitude),
      latitude: parseFloat(latitude),
      radiusInMeters: radius ? parseFloat(radius) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    this.logger.log(`Finding nearby riders at [${query.longitude}, ${query.latitude}]`);
    return this.riderService.findNearby(query);
  }

  @Get(':id/metrics')
  async getMetrics(@Param('id') id: string) {
    this.logger.log(`Getting metrics for rider: ${id}`);
    return this.riderService.getMetrics(id);
  }
}
