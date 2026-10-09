import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rider, RiderDocument } from './rider.schema';
import { LocationService } from './location.service';
import { MatchingService } from './matching.service';
import { RedisService } from './redis.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AvailabilityDto } from './dto/availability.dto';
import { INearbyRiderQuery, IRider } from './interfaces/rider.interface';

@Injectable()
export class RiderService {
  private readonly logger = new Logger(RiderService.name);

  constructor(
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private locationService: LocationService,
    private matchingService: MatchingService,
    private redisService: RedisService,
  ) {}

  async createRider(userId: string, vehicleType?: string): Promise<Rider> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const existingRider = await this.riderModel.findOne({ userId });
    if (existingRider) {
      throw new ConflictException('Rider profile already exists for this user');
    }

    const rider = new this.riderModel({
      userId: new Types.ObjectId(userId),
      vehicleType: vehicleType || 'motorcycle',
      isAvailable: false,
      isOnline: false,
      stats: {
        totalDeliveries: 0,
        avgRating: 0,
        acceptanceRate: 0,
      },
    });

    const savedRider = await rider.save();
    await this.redisService.setJson(`rider:${savedRider._id}`, savedRider.toObject(), 3600);

    this.logger.log(`Created rider profile for user: ${userId}`);
    return savedRider;
  }

  async findById(id: string): Promise<Rider> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid rider ID');
    }

    const cachedRider = await this.redisService.getJson<Rider>(`rider:${id}`);
    if (cachedRider) {
      return cachedRider;
    }

    const rider = await this.riderModel.findById(id).populate('userId', 'name phone email');
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    await this.redisService.setJson(`rider:${id}`, rider.toObject(), 3600);
    return rider;
  }

  async findByUserId(userId: string): Promise<Rider> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async findAll(status?: 'available' | 'busy' | 'offline'): Promise<Rider[]> {
    const filter: Record<string, unknown> = {};

    if (status === 'available') {
      filter.isOnline = true;
      filter.isAvailable = true;
    } else if (status === 'busy') {
      filter.isOnline = true;
      filter.isAvailable = false;
    } else if (status === 'offline') {
      filter.isOnline = false;
    }

    return this.riderModel
      .find(filter)
      .populate('userId', 'name phone email')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async updateLocation(riderId: string, locationDto: UpdateLocationDto): Promise<{ success: boolean; throttled?: boolean }> {
    if (!Types.ObjectId.isValid(riderId)) {
      throw new NotFoundException('Invalid rider ID');
    }

    const rider = await this.riderModel.findById(riderId);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    const updated = await this.locationService.updateLocation(
      riderId,
      locationDto.longitude,
      locationDto.latitude,
      locationDto.heading,
      locationDto.speed,
    );

    if (updated) {
      await this.redisService.del(`rider:${riderId}`);
      this.logger.log(`Updated location for rider: ${riderId}`);
    }

    return { success: updated, throttled: !updated };
  }

  async toggleAvailability(riderId: string, availabilityDto: AvailabilityDto): Promise<Rider> {
    if (!Types.ObjectId.isValid(riderId)) {
      throw new NotFoundException('Invalid rider ID');
    }

    const updateData: Record<string, boolean> = {};
    if (availabilityDto.isAvailable !== undefined) {
      updateData.isAvailable = availabilityDto.isAvailable;
    }
    if (availabilityDto.isOnline !== undefined) {
      updateData.isOnline = availabilityDto.isOnline;
    }

    const rider = await this.riderModel.findByIdAndUpdate(
      riderId,
      { $set: updateData },
      { new: true },
    );

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    await this.redisService.del(`rider:${riderId}`);
    this.logger.log(`Updated availability for rider: ${riderId}`, updateData);
    return rider;
  }

  async findNearby(query: INearbyRiderQuery): Promise<IRider[]> {
    return this.matchingService.findNearbyRiders(query);
  }

  async getMetrics(riderId: string): Promise<any> {
    if (!Types.ObjectId.isValid(riderId)) {
      throw new NotFoundException('Invalid rider ID');
    }

    const rider = await this.riderModel.findById(riderId);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return {
      totalDeliveries: rider.stats.totalDeliveries,
      avgRating: rider.stats.avgRating,
      acceptanceRate: rider.stats.acceptanceRate,
      isOnline: rider.isOnline,
      isAvailable: rider.isAvailable,
      lastLocationUpdate: rider.lastLocationUpdate,
    };
  }

  async updateStats(riderId: string, stats: { totalDeliveries?: number; avgRating?: number; acceptanceRate?: number }): Promise<Rider> {
    if (!Types.ObjectId.isValid(riderId)) {
      throw new NotFoundException('Invalid rider ID');
    }

    const rider = await this.riderModel.findById(riderId);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    const updatedStats = {
      totalDeliveries: stats.totalDeliveries ?? rider.stats.totalDeliveries,
      avgRating: stats.avgRating ?? rider.stats.avgRating,
      acceptanceRate: stats.acceptanceRate ?? rider.stats.acceptanceRate,
    };

    rider.stats = updatedStats;
    await rider.save();

    await this.redisService.del(`rider:${riderId}`);
    this.logger.log(`Updated stats for rider: ${riderId}`);
    return rider;
  }
}
