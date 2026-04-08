import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rider, RiderDocument, RiderStatus, VehicleType } from './schemas/rider.schema';
import { RedisService } from '../../common/utils/redis.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from '../orders/eta.service';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import * as bcrypt from 'bcrypt';

export interface LocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
    @Inject(forwardRef(() => ETAService))
    private readonly etaService: ETAService,
  ) { }

  async findAll(status?: string): Promise<Rider[]> {
    const query: Record<string, any> = {};

    if (status === 'available') {
      query.status = RiderStatus.AVAILABLE;
    } else if (status === 'busy') {
      query.status = RiderStatus.BUSY;
    } else if (status === 'offline') {
      query.status = RiderStatus.OFFLINE;
    }

    return this.riderModel.find(query).lean().exec();
  }

  async findRiderById(riderId: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(riderId);

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async findByUsername(username: string): Promise<RiderDocument | null> {
    return this.riderModel.findOne({ username });
  }

  async findByPhone(phone: string): Promise<Rider | null> {
    const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\s/g, '')}`;
    return this.riderModel.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: phone.replace(/\s/g, '') },
        { phone },
      ],
    }).lean().exec();
  }

  async updatePresence(
    riderId: string,
    presence: { isOnline?: boolean; isAvailable?: boolean },
  ): Promise<RiderDocument> {
    const rider = await this.findRiderById(riderId);

    if (typeof presence.isOnline === 'boolean') {
      rider.status = presence.isOnline
        ? (presence.isAvailable ? RiderStatus.AVAILABLE : RiderStatus.BUSY)
        : RiderStatus.OFFLINE;
    }

    if (typeof presence.isAvailable === 'boolean') {
      rider.status = rider.status === RiderStatus.OFFLINE
        ? RiderStatus.OFFLINE
        : (presence.isAvailable ? RiderStatus.AVAILABLE : RiderStatus.BUSY);
    }

    await rider.save();
    return rider;
  }

  async getMetrics(riderId: string): Promise<{
    totalDeliveries: number;
    avgRating: number;
    acceptanceRate: number;
  }> {
    await this.findRiderById(riderId);

    const totalDeliveries = await this.orderModel.countDocuments({
      riderId: new Types.ObjectId(riderId),
      orderStatus: OrderStatus.DELIVERED,
    });

    const acceptedAssignments = await this.orderModel.countDocuments({
      riderId: new Types.ObjectId(riderId),
    });

    return {
      totalDeliveries,
      avgRating: 0,
      acceptanceRate: acceptedAssignments > 0 ? 100 : 0,
    };
  }

  async updateAvailability(riderId: string, isAvailable: boolean): Promise<Rider> {
    const rider = await this.findRiderById(riderId);

    rider.status = isAvailable ? RiderStatus.AVAILABLE : RiderStatus.BUSY;
    await rider.save();

    return rider;
  }

  async updateOnlineStatus(riderId: string, isOnline: boolean): Promise<Rider> {
    const rider = await this.findRiderById(riderId);

    rider.status = isOnline ? RiderStatus.AVAILABLE : RiderStatus.OFFLINE;
    await rider.save();

    return rider;
  }

  async findAvailableRiders(): Promise<Rider[]> {
    return this.riderModel
      .find({
        status: RiderStatus.AVAILABLE,
        isActive: true,
      })
      .lean()
      .exec();
  }

  async findById(riderId: string): Promise<Rider> {
    const rider = await this.riderModel.findById(riderId);

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async validateLocationUpdate(riderId: string): Promise<boolean> {
    const throttleKey = `rider:location:throttle:${riderId}`;
    const lastUpdate = await this.redisService.get(throttleKey);

    if (lastUpdate) {
      return false;
    }

    return true;
  }

  async updateLocation(riderId: string, location: LocationDto): Promise<Rider> {
    if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }
    if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    const isAllowed = await this.validateLocationUpdate(riderId);
    if (!isAllowed) {
      throw new BadRequestException('Location updates are throttled to 5 seconds minimum interval');
    }

    const rider = await this.findRiderById(riderId);

    rider.currentLocation = {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
    };
    rider.lastLocationUpdate = new Date();

    await rider.save();

    const throttleKey = `rider:location:throttle:${riderId}`;
    await this.redisService.set(throttleKey, Date.now().toString(), 5);

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

    for (const order of activeOrders) {
      this.trackingGateway.broadcastRiderLocationUpdate(
        order._id.toString(),
        { latitude: location.latitude, longitude: location.longitude },
        riderId,
      );

      if (order.orderStatus === OrderStatus.OUT_FOR_DELIVERY) {
        try {
          const eta = await this.etaService.recalculateForOrder(order._id.toString());
          if (eta) {
            const trackingOrder = await this.orderModel
              .findById(order._id)
              .populate('userId', 'name phone')
              .populate('riderId', 'name phone vehicleType rating totalDeliveries currentLocation status lastLocationUpdate')
              .lean()
              .exec();

            this.trackingGateway.broadcastETAUpdate(order._id.toString(), eta, trackingOrder);
          }
        } catch (error) {
          console.error(`Failed to recalculate ETA for order ${order._id}:`, error);
        }
      }
    }

    return rider;
  }

  async findNearbyRiders(
    coordinates: [number, number],
    maxDistance: number = 5000,
  ): Promise<Rider[]> {
    return this.riderModel
      .find({
        status: RiderStatus.AVAILABLE,
        isActive: true,
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

  async createRider(data: any): Promise<Rider> {
    const { name, username, password, phone, vehicleType } = data;

    const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\s/g, '')}`;

    const existingRider = await this.riderModel.findOne({
      $or: [
        { username },
        { phone: normalizedPhone },
        { phone: phone.replace(/\s/g, '') },
      ],
    });

    if (existingRider) {
      throw new BadRequestException('Username or phone number already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const rider = new this.riderModel({
      name,
      username,
      password: hashedPassword,
      phone: normalizedPhone,
      vehicleType: vehicleType || VehicleType.TWO_WHEELER,
      status: RiderStatus.OFFLINE,
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [0, 0],
      },
    });

    return rider.save();
  }

  async ensureOtpRider(phone: string, name?: string): Promise<RiderDocument> {
    const normalizedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\s/g, '')}`;
    const existingRider = await this.riderModel.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: phone.replace(/\s/g, '') },
        { phone },
      ],
    });

    if (existingRider) {
      if (name && existingRider.name !== name) {
        existingRider.name = name;
        await existingRider.save();
      }
      return existingRider;
    }

    const phoneDigits = normalizedPhone.replace(/\D/g, '').slice(-10);
    let usernameBase = `rider${phoneDigits}`;
    let username = usernameBase;
    let suffix = 1;

    while (await this.riderModel.findOne({ username })) {
      username = `${usernameBase}${suffix}`;
      suffix += 1;
    }

    const hashedPassword = await bcrypt.hash(`otp-${phoneDigits}-${Date.now()}`, 10);

    const rider = new this.riderModel({
      name: name || 'Rider',
      username,
      password: hashedPassword,
      phone: normalizedPhone,
      vehicleType: VehicleType.TWO_WHEELER,
      status: RiderStatus.OFFLINE,
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [0, 0],
      },
    });

    return rider.save();
  }

  async updateRider(riderId: string, data: Partial<Rider>): Promise<Rider> {
    const rider = await this.findRiderById(riderId);

    if (data.name) rider.name = data.name;
    if (data.vehicleType) rider.vehicleType = data.vehicleType;
    if (data.isActive !== undefined) rider.isActive = data.isActive;

    await rider.save();
    return rider;
  }

  async deleteRider(riderId: string): Promise<void> {
    const rider = await this.findRiderById(riderId);
    await rider.deleteOne();
  }
}
