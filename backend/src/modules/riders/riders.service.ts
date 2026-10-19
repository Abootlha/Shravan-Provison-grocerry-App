import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Rider,
  RiderDocument,
  RiderStatus,
  VehicleType,
} from './schemas/rider.schema';
import { RedisService } from '../../common/utils/redis.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from '../orders/eta.service';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { OrdersService } from '../orders/orders.service';
import {
  OrderStatusLog,
  OrderStatusLogDocument,
} from '../orders/schemas/order-status-log.schema';
import { RIDER_REJECTED_NOTE } from '../orders/rider-events';
import { DEFAULT_TIMEZONE } from '../settings/store-hours';
import * as bcrypt from 'bcrypt';

export interface LocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationUpdateResult {
  /** True when the update arrived too soon after the previous one and was dropped. */
  throttled: boolean;
  rider?: Rider;
}

/** Minimum gap between stored rider locations. Clients send every ~5 s. */
export const LOCATION_THROTTLE_MS = 2500;
/** Minimum gap between ETA recalculations (each may call the directions API). */
export const ETA_RECALC_INTERVAL_MS = 15000;

const ACTIVE_RIDER_ORDER_STATUSES = [
  OrderStatus.ASSIGNED,
  OrderStatus.PACKED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

export interface PeriodMetrics {
  deliveries: number;
  earnings: number;
}

export interface RiderMetrics {
  totalDeliveries: number;
  avgRating: number;
  acceptanceRate: number;
  currency: 'INR';
  timezone: string;
  earningsBasis: 'deliveryFee+tip';
  today: PeriodMetrics;
  week: PeriodMetrics;
  month: PeriodMetrics;
}

export interface UpdateRiderProfileInput {
  name?: string;
  vehicleType?: VehicleType;
  vehicleNumber?: string;
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
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @InjectModel(OrderStatusLog.name)
    private readonly orderStatusLogModel: Model<OrderStatusLogDocument>,
  ) {}

  private readonly logger = new Logger(RidersService.name);

  async findAll(status?: string): Promise<Rider[]> {
    const query: Record<string, any> = {};

    if (status === 'available') {
      query.status = RiderStatus.AVAILABLE;
    } else if (status === 'busy') {
      query.status = RiderStatus.BUSY;
    } else if (status === 'offline') {
      query.status = RiderStatus.OFFLINE;
    }

    return this.riderModel.find(query).select('-password').lean().exec();
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
    const normalizedPhone = phone.startsWith('+91')
      ? phone
      : `+91${phone.replace(/\s/g, '')}`;
    return this.riderModel
      .findOne({
        $or: [
          { phone: normalizedPhone },
          { phone: phone.replace(/\s/g, '') },
          { phone },
        ],
      })
      .lean()
      .exec();
  }

  async updatePresence(
    riderId: string,
    presence: { isOnline?: boolean; isAvailable?: boolean },
  ): Promise<RiderDocument> {
    const rider = await this.findRiderById(riderId);

    if (typeof presence.isOnline === 'boolean') {
      rider.status = presence.isOnline
        ? presence.isAvailable
          ? RiderStatus.AVAILABLE
          : RiderStatus.BUSY
        : RiderStatus.OFFLINE;
    }

    if (typeof presence.isAvailable === 'boolean') {
      rider.status =
        rider.status === RiderStatus.OFFLINE
          ? RiderStatus.OFFLINE
          : presence.isAvailable
            ? RiderStatus.AVAILABLE
            : RiderStatus.BUSY;
    }

    await this.keepBusyWhileOnActiveOrder(rider);
    await rider.save();
    return rider;
  }

  /**
   * A rider with an in-progress order must stay BUSY, otherwise toggling
   * "available" would let auto-assignment hand them a second order.
   */
  private async keepBusyWhileOnActiveOrder(
    rider: RiderDocument,
  ): Promise<void> {
    if (rider.status !== RiderStatus.AVAILABLE) return;

    const activeOrder = await this.orderModel.exists({
      riderId: rider._id,
      orderStatus: {
        $in: [
          OrderStatus.CONFIRMED,
          OrderStatus.ASSIGNED,
          OrderStatus.PACKED,
          OrderStatus.PICKED_UP,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });
    if (activeOrder) {
      rider.status = RiderStatus.BUSY;
    }
  }

  /**
   * Delivery counts and earnings for today / this week (from Monday) / this
   * month in the store timezone, from DELIVERED orders by actualDeliveryTime.
   *
   * There is no payout or commission model yet, so earnings are estimated as
   * deliveryFee + tip of each delivered order (tip counts as 0 when absent).
   * Online hours are not returned because presence history is not stored.
   */
  async getMetrics(riderId: string, now = new Date()): Promise<RiderMetrics> {
    const rider = await this.findRiderById(riderId);
    const riderObjectId = new Types.ObjectId(riderId);
    const timezone = DEFAULT_TIMEZONE;
    const { dayStart, weekStart, monthStart } = periodStarts(now, timezone);
    const earliest = new Date(
      Math.min(weekStart.getTime(), monthStart.getTime()),
    );

    const countFor = (start: Date) => ({
      $sum: { $cond: [{ $gte: ['$actualDeliveryTime', start] }, 1, 0] },
    });
    const earningsFor = (start: Date) => ({
      $sum: {
        $cond: [
          { $gte: ['$actualDeliveryTime', start] },
          {
            $add: [{ $ifNull: ['$deliveryFee', 0] }, { $ifNull: ['$tip', 0] }],
          },
          0,
        ],
      },
    });

    const [totalDeliveries, periods, accepted, rejected] = await Promise.all([
      this.orderModel.countDocuments({
        riderId: riderObjectId,
        orderStatus: OrderStatus.DELIVERED,
      }),
      this.orderModel
        .aggregate<Record<string, number>>([
          {
            $match: {
              riderId: riderObjectId,
              orderStatus: OrderStatus.DELIVERED,
              actualDeliveryTime: { $gte: earliest },
            },
          },
          {
            $group: {
              _id: null,
              todayCount: countFor(dayStart),
              todayEarnings: earningsFor(dayStart),
              weekCount: countFor(weekStart),
              weekEarnings: earningsFor(weekStart),
              monthCount: countFor(monthStart),
              monthEarnings: earningsFor(monthStart),
            },
          },
        ])
        .exec(),
      // Accepts are logged with the rider as actor; rejects carry a note.
      this.orderStatusLogModel.countDocuments({
        changedBy: riderObjectId,
        newStatus: OrderStatus.ASSIGNED,
      }),
      this.orderStatusLogModel.countDocuments({
        changedBy: riderObjectId,
        note: { $regex: `^${RIDER_REJECTED_NOTE}` },
      }),
    ]);

    const p = periods[0] ?? {};
    const period = (key: 'today' | 'week' | 'month'): PeriodMetrics => ({
      deliveries: p[`${key}Count`] ?? 0,
      earnings: Math.round((p[`${key}Earnings`] ?? 0) * 100) / 100,
    });
    const offers = accepted + rejected;

    return {
      totalDeliveries,
      avgRating: rider.rating ?? 0,
      acceptanceRate: offers > 0 ? Math.round((accepted / offers) * 100) : 100,
      currency: 'INR',
      timezone,
      earningsBasis: 'deliveryFee+tip',
      today: period('today'),
      week: period('week'),
      month: period('month'),
    };
  }

  /** The rider's own profile edit (PUT /riders/me). */
  async updateProfile(
    riderId: string,
    input: UpdateRiderProfileInput,
  ): Promise<RiderDocument> {
    const rider = await this.findRiderById(riderId);
    if (input.name !== undefined) rider.name = input.name.trim();
    if (input.vehicleType !== undefined) rider.vehicleType = input.vehicleType;
    if (input.vehicleNumber !== undefined) {
      const normalized = input.vehicleNumber
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
      rider.vehicleNumber = normalized || undefined;
    }
    await rider.save();
    return rider;
  }

  async updateAvailability(
    riderId: string,
    isAvailable: boolean,
  ): Promise<Rider> {
    const rider = await this.findRiderById(riderId);

    rider.status = isAvailable ? RiderStatus.AVAILABLE : RiderStatus.BUSY;
    await this.keepBusyWhileOnActiveOrder(rider);
    await rider.save();

    return rider;
  }

  async updateOnlineStatus(riderId: string, isOnline: boolean): Promise<Rider> {
    const rider = await this.findRiderById(riderId);

    rider.status = isOnline ? RiderStatus.AVAILABLE : RiderStatus.OFFLINE;
    await this.keepBusyWhileOnActiveOrder(rider);
    await rider.save();

    return rider;
  }

  async findAvailableRiders(): Promise<Omit<Rider, 'password'>[]> {
    return this.riderModel
      .find({
        status: RiderStatus.AVAILABLE,
        isActive: true,
      })
      .lean()
      .exec()
      .then((riders) =>
        riders.map((rider) => {
          const copy: Record<string, any> = { ...rider };
          delete copy.password;
          return copy as Omit<Rider, 'password'>;
        }),
      );
  }

  async findById(riderId: string): Promise<Rider> {
    const rider = await this.riderModel.findById(riderId);

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  /**
   * Claims a Redis slot for `ms`. Returns false when it is still held from a
   * previous call. Fails open if Redis is unavailable: a few extra writes are
   * better than a frozen map.
   */
  private async acquireThrottle(key: string, ms: number): Promise<boolean> {
    try {
      const result = await this.redisService
        .getClient()
        .set(key, Date.now().toString(), 'PX', ms, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        `Throttle check failed for ${key}: ${(error as Error).message}`,
      );
      return true;
    }
  }

  /**
   * Stores the rider's location and broadcasts it to every active order room
   * (and etaUpdate when the ETA is recalculated). Updates closer than
   * LOCATION_THROTTLE_MS are dropped silently ({ throttled: true }) rather
   * than rejected, since clients send on a fixed timer and jitter would
   * otherwise turn into errors.
   */
  async updateLocation(
    riderId: string,
    location: LocationDto,
  ): Promise<LocationUpdateResult> {
    if (
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90
    ) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }
    if (
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    const allowed = await this.acquireThrottle(
      `rider:location:throttle:${riderId}`,
      LOCATION_THROTTLE_MS,
    );
    if (!allowed) {
      return { throttled: true };
    }

    const rider = await this.findRiderById(riderId);

    const now = new Date();
    rider.currentLocation = {
      type: 'Point',
      coordinates: [location.longitude, location.latitude],
    };
    rider.lastLocationUpdate = now;
    rider.lastActiveAt = now;

    await rider.save();

    const activeOrders = await this.orderModel
      .find({
        riderId: new Types.ObjectId(riderId),
        orderStatus: { $in: ACTIVE_RIDER_ORDER_STATUSES },
      })
      .select('_id orderStatus')
      .lean()
      .exec();

    for (const order of activeOrders) {
      const orderId = order._id.toString();
      try {
        let eta: Date | null = null;
        if (
          order.orderStatus === OrderStatus.OUT_FOR_DELIVERY &&
          (await this.acquireThrottle(
            `order:eta:recalc:${orderId}`,
            ETA_RECALC_INTERVAL_MS,
          ))
        ) {
          eta = await this.etaService
            .recalculateForOrder(orderId)
            .catch((error: Error) => {
              this.logger.warn(
                `Failed to recalculate ETA for order ${orderId}: ${error.message}`,
              );
              return null;
            });
        }

        const trackingOrder =
          await this.ordersService.buildRealtimeOrderPayload(orderId);
        this.trackingGateway.broadcastRiderLocationUpdate(
          orderId,
          {
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading,
            speed: location.speed,
          },
          riderId,
          trackingOrder,
        );
        if (eta) {
          this.trackingGateway.broadcastETAUpdate(orderId, eta, trackingOrder);
        }
      } catch (error) {
        // One failing order must not stop updates for the others.
        this.logger.warn(
          `Failed to broadcast location for order ${orderId}: ${(error as Error).message}`,
        );
      }
    }

    return { throttled: false, rider };
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

    const normalizedPhone = phone.startsWith('+91')
      ? phone
      : `+91${phone.replace(/\s/g, '')}`;

    const existingRider = await this.riderModel.findOne({
      $or: [
        { username },
        { phone: normalizedPhone },
        { phone: phone.replace(/\s/g, '') },
      ],
    });

    if (existingRider) {
      throw new BadRequestException(
        'Username or phone number already registered',
      );
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

  /**
   * OTP login for riders. Riders must be pre-created (and activated) by an
   * admin; this never creates a rider.
   */
  async ensureOtpRider(phone: string): Promise<RiderDocument> {
    const normalizedPhone = phone.startsWith('+91')
      ? phone
      : `+91${phone.replace(/\s/g, '')}`;
    const existingRider = await this.riderModel.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: phone.replace(/\s/g, '') },
        { phone },
      ],
    });

    if (!existingRider || !existingRider.isActive) {
      throw new UnauthorizedException(
        'This phone number is not registered as an active rider',
      );
    }

    return existingRider;
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

/**
 * Start of the current day, week (Monday) and month in `timezone`, as UTC
 * instants. Assumes the zone offset is the same at the period start as now,
 * which holds for the store's zone (Asia/Kolkata has no DST).
 */
export function periodStarts(
  now: Date,
  timezone: string,
): { dayStart: Date; weekStart: Date; monthStart: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  // The zone's wall-clock time read as UTC, minus the real instant, is the
  // zone offset.
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second')),
  );
  const offsetMs = wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const startOf = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d) - offsetMs);

  const daysSinceMonday = Math.max(
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')),
    0,
  );
  return {
    dayStart: startOf(year, month, day),
    weekStart: startOf(year, month, day - daysSinceMonday),
    monthStart: startOf(year, month, 1),
  };
}
