import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { RedisService } from '../../common/utils/redis.service';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';

export interface LocationDto {
  latitude: number;
  longitude: number;
}

export interface AddressDto {
  street: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export interface ETAResult {
  estimatedDeliveryTime: Date;
  durationMinutes: number;
  distanceMeters: number;
}

@Injectable()
export class ETAService {
  private readonly logger = new Logger(ETAService.name);
  private readonly ETA_CACHE_TTL = 120; // 2 minutes
  private readonly mapplsApiKey: string;
  private readonly directionsUrl = 'https://apis.mappls.com/advancedmaps/v1/route_adv/driving';

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
  ) {
    this.mapplsApiKey =
      this.configService.get<string>('MAPMYINDIA_API_KEY') ||
      this.configService.get<string>('MAPPLS_API_KEY') ||
      '';
  }

  /**
   * Calculate ETA from rider location to delivery address.
   * Uses Mappls directions with 2-minute caching.
   */
  async calculateETA(
    riderLocation: LocationDto,
    deliveryAddress: AddressDto,
  ): Promise<ETAResult> {
    const cacheKey = this.getETACacheKey(
      riderLocation.latitude,
      riderLocation.longitude,
      deliveryAddress.latitude,
      deliveryAddress.longitude,
    );

    // Check cache first
    const cachedDuration = await this.getCachedETA(cacheKey);
    if (cachedDuration !== null) {
      this.logger.debug(`ETA cache hit for key ${cacheKey}`);
      const durationMinutes = Math.ceil(cachedDuration / 60);
      const estimatedDeliveryTime = new Date(Date.now() + cachedDuration * 1000);
      
      return {
        estimatedDeliveryTime,
        durationMinutes,
        distanceMeters: 0, // Not stored in cache
      };
    }

    const origin = `${riderLocation.latitude},${riderLocation.longitude}`;
    const destination = `${deliveryAddress.latitude},${deliveryAddress.longitude}`;

    try {
      const { durationSeconds, distanceMeters } = await this.callMapplsDirectionsAPI(
        riderLocation,
        deliveryAddress,
      );

      // Cache the duration
      await this.setCachedETA(cacheKey, durationSeconds);

      const durationMinutes = Math.ceil(durationSeconds / 60);
      const estimatedDeliveryTime = new Date(Date.now() + durationSeconds * 1000);

      this.logger.log(
        `Calculated ETA: ${durationMinutes} minutes (${distanceMeters}m) from ${origin} to ${destination}`,
      );

      return {
        estimatedDeliveryTime,
        durationMinutes,
        distanceMeters,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate ETA from ${origin} to ${destination}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Call Mappls directions API
   */
  private async callMapplsDirectionsAPI(
    riderLocation: LocationDto,
    deliveryAddress: AddressDto,
  ): Promise<{ durationSeconds: number; distanceMeters: number }> {
    if (!this.mapplsApiKey) {
      throw new Error('MAPMYINDIA_API_KEY is not configured');
    }

    const response = await axios.get(this.directionsUrl, {
      headers: {
        Authorization: this.mapplsApiKey,
      },
      params: {
        lex_lat: riderLocation.latitude,
        lex_lng: riderLocation.longitude,
        dest_lat: deliveryAddress.latitude,
        dest_lng: deliveryAddress.longitude,
        alternatives: false,
        geometries: 'polyline',
        overview: 'full',
        steps: false,
      },
      timeout: 10000,
    });

    const route = response.data?.route?.[0];
    const leg = route?.legs?.[0];

    if (!route || !leg) {
      throw new Error('Mappls directions response did not contain a route');
    }

    return {
      durationSeconds: leg.duration || route.duration || 0,
      distanceMeters: leg.distance || route.distance || 0,
    };
  }

  /**
   * Get cached ETA duration in seconds
   * Returns null if not found or on error
   */
  private async getCachedETA(cacheKey: string): Promise<number | null> {
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return parseInt(cached, 10);
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Redis get error for ETA cache key ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Cache ETA duration in seconds with 2-minute TTL
   */
  private async setCachedETA(cacheKey: string, durationSeconds: number): Promise<void> {
    try {
      await this.redisService.set(
        cacheKey,
        durationSeconds.toString(),
        this.ETA_CACHE_TTL,
      );
      this.logger.debug(`Cached ETA for key ${cacheKey} with TTL ${this.ETA_CACHE_TTL}s`);
    } catch (error) {
      this.logger.error(
        `Redis set error for ETA cache key ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Graceful degradation: continue without caching
    }
  }

  /**
   * Recalculate ETA for a specific order
   * Only recalculates if order is in OUT_FOR_DELIVERY status
   */
  async recalculateForOrder(orderId: string): Promise<Date | null> {
    const order = await this.orderModel.findById(orderId).populate('riderId');

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Only recalculate for orders that are out for delivery
    if (order.orderStatus !== OrderStatus.OUT_FOR_DELIVERY) {
      this.logger.debug(
        `Skipping ETA recalculation for order ${orderId} - status is ${order.orderStatus}`,
      );
      return null;
    }

    if (!order.riderId) {
      this.logger.warn(`Order ${orderId} is OUT_FOR_DELIVERY but has no assigned rider`);
      return null;
    }

    // Get rider details
    const rider = await this.riderModel.findById(order.riderId);

    if (!rider || !rider.currentLocation) {
      this.logger.warn(
        `Cannot recalculate ETA for order ${orderId} - rider location not available`,
      );
      return null;
    }

    // Extract coordinates
    const riderLocation: LocationDto = {
      latitude: rider.currentLocation.coordinates[1],
      longitude: rider.currentLocation.coordinates[0],
    };

    const deliveryAddress: AddressDto = {
      street: order.deliveryAddress.address,
      city: order.deliveryAddress.city,
      postalCode: order.deliveryAddress.pincode,
      latitude: order.deliveryAddress.coordinates.coordinates[1],
      longitude: order.deliveryAddress.coordinates.coordinates[0],
    };

    try {
      const etaResult = await this.calculateETA(riderLocation, deliveryAddress);

      // Update order with new ETA
      order.estimatedDeliveryTime = etaResult.estimatedDeliveryTime;
      await order.save();

      this.logger.log(
        `Recalculated ETA for order ${orderId}: ${etaResult.durationMinutes} minutes`,
      );

      return etaResult.estimatedDeliveryTime;
    } catch (error) {
      // Error handling is done in calculateETA, just log and return null
      this.logger.error(
        `Failed to recalculate ETA for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Generate cache key from coordinates
   */
  private getETACacheKey(
    riderLat: number,
    riderLng: number,
    destLat: number,
    destLng: number,
  ): string {
    // Round to 4 decimal places (~11m precision) for better cache hits
    const roundedRiderLat = riderLat.toFixed(4);
    const roundedRiderLng = riderLng.toFixed(4);
    const roundedDestLat = destLat.toFixed(4);
    const roundedDestLng = destLng.toFixed(4);
    
    return `eta:${roundedRiderLat}:${roundedRiderLng}:${roundedDestLat}:${roundedDestLng}`;
  }
}
