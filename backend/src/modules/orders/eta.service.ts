import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';
import { RedisService } from '../../common/utils/redis.service';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

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
  private readonly googleMapsClient: Client;
  private readonly ETA_CACHE_TTL = 120; // 2 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.googleMapsClient = new Client({});
  }

  /**
   * Calculate ETA from rider location to delivery address
   * Uses Google Distance Matrix API with 2-minute caching
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

    // Call Distance Matrix API
    const origin = `${riderLocation.latitude},${riderLocation.longitude}`;
    const destination = `${deliveryAddress.latitude},${deliveryAddress.longitude}`;

    try {
      const response = await this.callDistanceMatrixAPI(origin, destination);
      const durationSeconds = this.parseETAFromResponse(response);
      const distanceMeters = this.parseDistanceFromResponse(response);

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
   * Call Google Distance Matrix API
   */
  private async callDistanceMatrixAPI(
    origin: string,
    destination: string,
  ): Promise<any> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const response = await this.googleMapsClient.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        mode: TravelMode.driving,
        units: UnitSystem.metric,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Distance Matrix API error: ${response.data.status}`);
    }

    const element = response.data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      throw new Error(`No route found: ${element?.status || 'UNKNOWN'}`);
    }

    return response.data;
  }

  /**
   * Parse duration in seconds from Distance Matrix API response
   */
  private parseETAFromResponse(response: any): number {
    const element = response.rows[0]?.elements[0];
    if (!element || !element.duration) {
      throw new Error('Invalid Distance Matrix API response: missing duration');
    }
    return element.duration.value; // Duration in seconds
  }

  /**
   * Parse distance in meters from Distance Matrix API response
   */
  private parseDistanceFromResponse(response: any): number {
    const element = response.rows[0]?.elements[0];
    if (!element || !element.distance) {
      throw new Error('Invalid Distance Matrix API response: missing distance');
    }
    return element.distance.value; // Distance in meters
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
    const rider = await this.userModel.findOne({
      _id: order.riderId,
      role: UserRole.RIDER,
    });

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
