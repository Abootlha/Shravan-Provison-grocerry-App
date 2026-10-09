import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as ngeohash from 'ngeohash';
import { Rider, RiderDocument } from './rider.schema';
import { IRider, INearbyRiderQuery } from './interfaces/rider.interface';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly DEFAULT_RADIUS_METERS = 5000;
  private readonly DEFAULT_LIMIT = 10;

  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
  ) {}

  async findNearbyRiders(query: INearbyRiderQuery): Promise<any[]> {
    const {
      longitude,
      latitude,
      radiusInMeters = this.DEFAULT_RADIUS_METERS,
      limit = this.DEFAULT_LIMIT,
      availableOnly = true,
      onlineOnly = true,
    } = query;

    const geohashPrefix = ngeohash.encode(longitude, latitude, 5);

    const queryFilter: Record<string, any> = {
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusInMeters,
        },
      },
    };

    if (availableOnly) {
      queryFilter.isAvailable = true;
    }

    if (onlineOnly) {
      queryFilter.isOnline = true;
    }

    const riders = await this.riderModel
      .find(queryFilter)
      .limit(limit)
      .populate('userId', 'name phone')
      .exec();

    const enhancedRiders = riders.map((rider) => {
      const riderObj = rider.toObject();
      const riderHash = ngeohash.encode(longitude, latitude);
      const distance = this.calculateDistance(
        longitude,
        latitude,
        rider.currentLocation.coordinates[0],
        rider.currentLocation.coordinates[1],
      );

      return {
        ...riderObj,
        distance,
        geohash: riderHash,
      };
    });

    enhancedRiders.sort((a, b) => a.distance - b.distance);

    this.logger.log(`Found ${enhancedRiders.length} nearby riders for [${longitude}, ${latitude}]`);
    return enhancedRiders;
  }

  private calculateDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async getRidersByGeohash(geohash: string, precision: number = 5): Promise<any[]> {
    const boundingBox = ngeohash.decode_bbox(ngeohash.encode(
      parseFloat(geohash.substring(0, precision)),
      parseFloat(geohash.substring(0, precision)),
    ));

    const riders = await this.riderModel.find({
      currentLocation: {
        $geoWithin: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[
              [boundingBox[0], boundingBox[1]],
              [boundingBox[0], boundingBox[3]],
              [boundingBox[2], boundingBox[3]],
              [boundingBox[2], boundingBox[1]],
              [boundingBox[0], boundingBox[1]],
            ]],
          },
        },
      },
      isAvailable: true,
      isOnline: true,
    });

    return riders;
  }
}
