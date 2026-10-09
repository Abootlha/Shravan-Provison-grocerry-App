import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rider, RiderDocument } from './rider.schema';
import { RedisService } from './redis.service';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);
  private readonly LOCATION_THROTTLE_MS = 5000;

  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private redisService: RedisService,
  ) {}

  async updateLocation(
    riderId: string,
    longitude: number,
    latitude: number,
    heading?: number,
    speed?: number,
  ): Promise<boolean> {
    const throttleKey = `rider:${riderId}:location_throttle`;
    const lastUpdate = await this.redisService.get(throttleKey);

    if (lastUpdate) {
      const elapsed = Date.now() - parseInt(lastUpdate, 10);
      if (elapsed < this.LOCATION_THROTTLE_MS) {
        this.logger.warn(`Location update throttled for rider ${riderId}. Elapsed: ${elapsed}ms`);
        return false;
      }
    }

    await this.riderModel.findByIdAndUpdate(riderId, {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      lastLocationUpdate: new Date(),
      heading: heading ?? 0,
      speed: speed ?? 0,
    });

    await this.redisService.set(throttleKey, Date.now().toString(), 10);

    await this.redisService.setJson(`rider:${riderId}:location`, {
      coordinates: [longitude, latitude],
      heading,
      speed,
      updatedAt: new Date(),
    }, 300);

    this.logger.debug(`Updated location for rider ${riderId}: [${longitude}, ${latitude}]`);
    return true;
  }

  async getCachedLocation(riderId: string): Promise<any | null> {
    return this.redisService.getJson(`rider:${riderId}:location`);
  }
}
