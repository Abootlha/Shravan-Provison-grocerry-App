import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { RoomService } from './room.service';
import { AuthService } from './auth.service';
import { RedisService } from './redis.service';

@Module({
  providers: [
    TrackingGateway,
    TrackingService,
    RoomService,
    AuthService,
    RedisService,
  ],
  exports: [TrackingService, RoomService],
})
export class TrackingModule {}
