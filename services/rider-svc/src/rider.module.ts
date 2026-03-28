import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rider, RiderSchema } from './rider.schema';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';
import { RiderGrpcController } from './rider.grpc.controller';
import { LocationService } from './location.service';
import { MatchingService } from './matching.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Rider.name, schema: RiderSchema }]),
  ],
  controllers: [RiderController, RiderGrpcController],
  providers: [RiderService, LocationService, MatchingService, RedisService],
  exports: [RiderService],
})
export class RiderModule {}
