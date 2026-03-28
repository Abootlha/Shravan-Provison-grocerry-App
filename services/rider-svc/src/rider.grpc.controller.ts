import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RiderService } from './rider.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { INearbyRiderQuery } from './interfaces/rider.interface';

interface IRiderService {
  Create(data: { userId: string; vehicleType?: string }): Promise<any>;
  FindById(data: { id: string }): Promise<any>;
  FindByUserId(data: { userId: string }): Promise<any>;
  UpdateLocation(data: { id: string; location: UpdateLocationDto }): Promise<any>;
  ToggleAvailability(data: { id: string; availability: AvailabilityDto }): Promise<any>;
  FindNearby(data: INearbyRiderQuery): Promise<any>;
  GetMetrics(data: { id: string }): Promise<any>;
}

@Controller()
export class RiderGrpcController implements IRiderService {
  private readonly logger = new Logger(RiderGrpcController.name);

  constructor(private readonly riderService: RiderService) {}

  @GrpcMethod('RiderService', 'Create')
  async Create(data: { userId: string; vehicleType?: string }) {
    this.logger.log(`gRPC: Creating rider for user: ${data.userId}`);
    return this.riderService.createRider(data.userId, data.vehicleType);
  }

  @GrpcMethod('RiderService', 'FindById')
  async FindById(data: { id: string }) {
    this.logger.log(`gRPC: Finding rider by ID: ${data.id}`);
    return this.riderService.findById(data.id);
  }

  @GrpcMethod('RiderService', 'FindByUserId')
  async FindByUserId(data: { userId: string }) {
    this.logger.log(`gRPC: Finding rider by user ID: ${data.userId}`);
    return this.riderService.findByUserId(data.userId);
  }

  @GrpcMethod('RiderService', 'UpdateLocation')
  async UpdateLocation(data: { id: string; location: UpdateLocationDto }) {
    this.logger.log(`gRPC: Updating location for rider: ${data.id}`);
    return this.riderService.updateLocation(data.id, data.location);
  }

  @GrpcMethod('RiderService', 'ToggleAvailability')
  async ToggleAvailability(data: { id: string; availability: AvailabilityDto }) {
    this.logger.log(`gRPC: Toggling availability for rider: ${data.id}`);
    return this.riderService.toggleAvailability(data.id, data.availability);
  }

  @GrpcMethod('RiderService', 'FindNearby')
  async FindNearby(data: INearbyRiderQuery) {
    this.logger.log(`gRPC: Finding nearby riders at [${data.longitude}, ${data.latitude}]`);
    return this.riderService.findNearby(data);
  }

  @GrpcMethod('RiderService', 'GetMetrics')
  async GetMetrics(data: { id: string }) {
    this.logger.log(`gRPC: Getting metrics for rider: ${data.id}`);
    return this.riderService.getMetrics(data.id);
  }
}
