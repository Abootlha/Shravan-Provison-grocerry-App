import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { LocationGrpcController } from './location.grpc.controller';
import { GeohashService } from './geohash.service';
import { QuadtreeService } from './quadtree.service';
import { RouteService } from './route.service';
import { EtaService } from './eta.service';
import { MapMyIndiaService } from './mapmyindia.service';
import { CacheService } from './cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [LocationController, LocationGrpcController],
  providers: [
    LocationService,
    GeohashService,
    QuadtreeService,
    RouteService,
    EtaService,
    MapMyIndiaService,
    CacheService,
  ],
  exports: [
    LocationService,
    GeohashService,
    QuadtreeService,
    RouteService,
    EtaService,
    MapMyIndiaService,
    CacheService,
  ],
})
export class LocationModule {}
