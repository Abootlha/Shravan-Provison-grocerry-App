import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { RedisService } from '../../common/utils/redis.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from '../orders/eta.service';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';

export interface LocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
    @Inject(forwardRef(() => ETAService))
    private readonly etaService: ETAService,
  ) {}

  /**
   * Find riders with optional status filter.
   */
  async findAll(status?: string): Promise<User[]> {
    const query: Record<string, any> = {
      role: UserRole.RIDER,
    };

    if (status === 'available') {
      query.isAvailable = true;
      query.isOnline = true;
    } else if (status === 'busy') {
      query.isAvailable = false;
      query.isOnline = true;
    } else if (status === 'offline') {
      query.isOnline = false;
    }

    return this.userModel.find(query).lean().exec();
  }

  /**
   * Update rider availability status
   */
  async updateAvailability(riderId: string, isAvailable: boolean): Promise<User> {
    const rider = await this.userModel.findOne({
      _id: riderId,
      role: UserRole.RIDER,
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    rider.isAvailable = isAvailable;
    await rider.save();

    return rider;
  }

  /**
   * Update rider online status
   */
  async updateOnlineStatus(riderId: string, isOnline: boolean): Promise<User> {
    const rider = await this.userModel.findOne({
      _id: riderId,
      role: UserRole.RIDER,
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    rider.isOnline = isOnline;
    await rider.save();

    return rider;
  }

  /**
   * Find all available riders (both available and online)
   */
  async findAvailableRiders(): Promise<User[]> {
    return this.userModel
      .find({
        role: UserRole.RIDER,
        isAvailable: true,
        isOnline: true,
      })
      .lean()
      .exec();
  }

  /**
   * Find rider by ID
   */
  async findById(riderId: string): Promise<User> {
    const rider = await this.userModel.findOne({
      _id: riderId,
      role: UserRole.RIDER,
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  /**
   * Validate location update is not throttled (5-second minimum interval)
   */
  async validateLocationUpdate(riderId: string): Promise<boolean> {
    const throttleKey = `rider:location:throttle:${riderId}`;
    const lastUpdate = await this.redisService.get(throttleKey);

    if (lastUpdate) {
      // Location update is throttled
      return false;
    }

    return true;
  }

  /**
   * Update rider location with throttling
   */
  async updateLocation(riderId: string, location: LocationDto): Promise<User> {
    // Validate coordinates
    if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }
    if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    // Check throttling
    const isAllowed = await this.validateLocationUpdate(riderId);
    if (!isAllowed) {
      throw new BadRequestException('Location updates are throttled to 5 seconds minimum interval');
    }

    // Find rider
    const rider = await this.userModel.findOne({
      _id: riderId,
      role: UserRole.RIDER,
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // Update location
    rider.currentLocation = {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
    };
    rider.lastLocationUpdate = new Date();

    await rider.save();

    // Set throttle timestamp in Redis with 5-second TTL
    const throttleKey = `rider:location:throttle:${riderId}`;
    await this.redisService.set(throttleKey, Date.now().toString(), 5);

    // Find all active orders for this rider (ASSIGNED or OUT_FOR_DELIVERY)
    const activeOrders = await this.orderModel
      .find({
        riderId: new Types.ObjectId(riderId),
        orderStatus: {
          $in: [OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY],
        },
      })
      .select('_id orderStatus')
      .lean()
      .exec();

    // Broadcast location update to all order rooms
    for (const order of activeOrders) {
      this.trackingGateway.broadcastRiderLocationUpdate(
        order._id.toString(),
        { latitude: location.latitude, longitude: location.longitude },
        riderId,
      );

      // Trigger ETA recalculation for OUT_FOR_DELIVERY orders
      if (order.orderStatus === OrderStatus.OUT_FOR_DELIVERY) {
        try {
          const eta = await this.etaService.recalculateForOrder(order._id.toString());
          if (eta) {
            this.trackingGateway.broadcastETAUpdate(order._id.toString(), eta);
          }
        } catch (error) {
          // Log error but don't fail the location update
          console.error(`Failed to recalculate ETA for order ${order._id}:`, error);
        }
      }
    }

    return rider;
  }

  /**
   * Find nearby riders using geospatial query
   * @param coordinates [longitude, latitude]
   * @param maxDistance Maximum distance in meters
   */
  async findNearbyRiders(
    coordinates: [number, number],
    maxDistance: number = 5000,
  ): Promise<User[]> {
    return this.userModel
      .find({
        role: UserRole.RIDER,
        isAvailable: true,
        isOnline: true,
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: coordinates,
            },
            $maxDistance: maxDistance,
          },
        },
      })
      .lean()
      .exec();
  }
}
