import {
  Inject,
  Injectable,
  OnModuleInit,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import {
  Rider,
  RiderDocument,
  RiderStatus,
} from '../riders/schemas/rider.schema';
import { OFFER_RESPONSE_TIMEOUT_MS } from '../orders/rider-events';
import {
  RIDER_UPDATES_CHANNEL,
  RiderPushService,
} from '../orders/rider-push.service';
import { OrdersService } from '../orders/orders.service';
import { ETAService } from '../orders/eta.service';

export const STALE_ORDER_QUEUE = 'stale-order-check';
export const ANOMALY_QUEUE = 'anomaly-check';
export const ETA_QUEUE = 'eta-recalculation';
export const RIDER_PRESENCE_QUEUE = 'rider-presence';

/** An "available" rider not heard from for this long is marked offline. */
export const RIDER_STALE_AFTER_MS = 15 * 60 * 1000;
/** How often offers, idle "busy" riders and stale riders are checked. */
export const RIDER_PRESENCE_INTERVAL_MS = 30_000;

/** Orders a rider is holding (an open offer or a delivery in progress). */
const RIDER_HOLDING_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.PACKED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 15;

/**
 * Schedules the recurring jobs and holds their logic. The BullMQ workers live
 * in jobs.processors.ts (one processor class per queue) and delegate here.
 */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(STALE_ORDER_QUEUE) private staleOrderQueue: Queue,
    @InjectQueue(ANOMALY_QUEUE) private anomalyQueue: Queue,
    @InjectQueue(ETA_QUEUE) private etaQueue: Queue,
    @InjectQueue(RIDER_PRESENCE_QUEUE) private riderPresenceQueue: Queue,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private ordersService: OrdersService,
    private etaService: ETAService,
    private configService: ConfigService,
    @Optional() private riderPush?: RiderPushService,
    @Optional()
    @Inject(forwardRef(() => TrackingGateway))
    private trackingGateway?: TrackingGateway,
  ) {}

  async onModuleInit() {
    // Register recurring jobs
    await this.registerStaleOrderCheck();
    await this.registerAnomalyCheck();
    await this.registerETARecalculation();
    await this.registerRiderPresence();
  }

  /** Rider presence sweep: every 30 seconds (see sweepRiderPresence). */
  async registerRiderPresence(): Promise<void> {
    await this.riderPresenceQueue.add(
      'sweep-rider-presence',
      {},
      {
        repeat: { every: RIDER_PRESENCE_INTERVAL_MS },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    this.logger.log('Registered rider presence sweep (every 30 seconds)');
  }

  private getPaymentTimeoutMinutes(): number {
    const raw = Number(this.configService?.get('PAYMENT_TIMEOUT_MINUTES'));
    return Number.isFinite(raw) && raw > 0
      ? raw
      : DEFAULT_PAYMENT_TIMEOUT_MINUTES;
  }

  /**
   * Register stale order check job - runs every 2 minutes
   */
  async registerStaleOrderCheck(): Promise<void> {
    await this.staleOrderQueue.add(
      'check-stale-orders',
      {},
      {
        repeat: {
          pattern: '*/2 * * * *', // Every 2 minutes
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
      },
    );
    this.logger.log('Registered stale order check job (every 2 minutes)');
  }

  /**
   * Register anomaly detection job - runs every 10 minutes
   */
  async registerAnomalyCheck(): Promise<void> {
    await this.anomalyQueue.add(
      'check-anomalies',
      {},
      {
        repeat: {
          pattern: '*/10 * * * *', // Every 10 minutes
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
    this.logger.log('Registered anomaly check job (every 10 minutes)');
  }

  /**
   * Register ETA recalculation job - runs every 5 minutes
   */
  async registerETARecalculation(): Promise<void> {
    await this.etaQueue.add(
      'recalculate-eta',
      {},
      {
        repeat: {
          pattern: '*/5 * * * *', // Every 5 minutes
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
    this.logger.log('Registered ETA recalculation job (every 5 minutes)');
  }

  /**
   * Process a job from any of the queues (called by the per-queue processors)
   */
  async process(job: Job): Promise<any> {
    const queueName = job.queueName;

    try {
      switch (queueName) {
        case STALE_ORDER_QUEUE:
          await this.processPaymentTimeouts();
          await this.processStaleOrders();
          await this.retryUnassignedOrders();
          return;
        case ANOMALY_QUEUE:
          return await this.processAnomalies();
        case ETA_QUEUE:
          return await this.processETAUpdates();
        case RIDER_PRESENCE_QUEUE:
          return await this.sweepRiderPresence();
        default:
          this.logger.warn(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Process stale orders - cancel PENDING orders older than 24 hours.
   * Cancellation goes through OrdersService so it logs the status change,
   * releases stock once, invalidates caches and broadcasts over sockets.
   */
  async processStaleOrders(): Promise<void> {
    this.logger.log('Processing stale orders...');

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find PENDING orders older than 24 hours
    const staleOrders = await this.orderModel
      .find({
        orderStatus: OrderStatus.PENDING,
        createdAt: { $lt: twentyFourHoursAgo },
      })
      .exec();

    this.logger.log(`Found ${staleOrders.length} stale orders`);
    if (staleOrders.length === 0) return;

    // Get system user ID for automated actions
    const systemUser = await this.getSystemUser();

    for (const order of staleOrders) {
      try {
        await this.ordersService.cancelOrder(
          order._id.toString(),
          systemUser._id.toString(),
          'AUTO_CANCELLED_STALE',
        );

        this.logger.log(`Cancelled stale order: ${order.orderId}`);
      } catch (error) {
        this.logger.error(
          `Failed to cancel stale order ${order.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Cancel online-payment orders whose payment is still PENDING after
   * PAYMENT_TIMEOUT_MINUTES (default 15). Marks payment FAILED, cancels the
   * order and releases stock. A late PayU success for such an order is
   * flagged for refund instead of reviving it.
   */
  async processPaymentTimeouts(): Promise<void> {
    const timeoutMinutes = this.getPaymentTimeoutMinutes();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const unpaidOrders = await this.orderModel
      .find({
        paymentMethod: { $ne: PaymentMethod.COD },
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PENDING,
        createdAt: { $lt: cutoff },
      })
      .exec();

    if (unpaidOrders.length > 0) {
      this.logger.log(
        `Found ${unpaidOrders.length} online orders unpaid after ${timeoutMinutes} minutes`,
      );
    }

    for (const order of unpaidOrders) {
      try {
        await this.ordersService.markPaymentFailed(
          order._id.toString(),
          'PAYMENT_TIMEOUT',
        );
        this.logger.log(`Cancelled unpaid order: ${order.orderId}`);
      } catch (error) {
        this.logger.error(
          `Failed to cancel unpaid order ${order.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Retry rider assignment for CONFIRMED orders that were left unassigned
   * because no rider was available at confirmation time.
   */
  async retryUnassignedOrders(): Promise<void> {
    const unassigned = await this.orderModel
      .find({ orderStatus: OrderStatus.CONFIRMED, riderId: null })
      .exec();

    for (const order of unassigned) {
      try {
        const assigned = await this.ordersService.autoAssignNearestRider(
          order._id.toString(),
        );
        if (assigned) {
          this.logger.log(`Assigned rider to waiting order ${order.orderId}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to assign rider to order ${order.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Keeps rider status honest. Each step runs on its own so one failure does
   * not skip the others.
   */
  async sweepRiderPresence(): Promise<{
    expiredOffers: number;
    releasedRiders: number;
    offlineRiders: number;
  }> {
    const result = { expiredOffers: 0, releasedRiders: 0, offlineRiders: 0 };
    for (const [key, step] of [
      ['expiredOffers', () => this.expireUnansweredOffers()],
      ['releasedRiders', () => this.releaseIdleBusyRiders()],
      ['offlineRiders', () => this.markStaleRidersOffline()],
    ] as const) {
      try {
        result[key] = await step();
      } catch (error) {
        this.logger.error(
          `Rider presence step ${key} failed: ${(error as Error).message}`,
        );
      }
    }
    return result;
  }

  /**
   * Offers the rider did not accept or reject within
   * OFFER_RESPONSE_TIMEOUT_MS go to the next rider. Without this the order
   * stayed parked on a rider who never answered, and that rider stayed busy.
   */
  async expireUnansweredOffers(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - OFFER_RESPONSE_TIMEOUT_MS);
    const waiting = await this.orderModel
      .find({
        orderStatus: OrderStatus.CONFIRMED,
        riderId: { $ne: null },
        $or: [
          { riderOfferedAt: { $lt: cutoff } },
          // Offers made before riderOfferedAt existed.
          { riderOfferedAt: { $exists: false }, updatedAt: { $lt: cutoff } },
        ],
      })
      .select('_id orderId riderId')
      .limit(50)
      .lean()
      .exec();

    let expired = 0;
    for (const order of waiting) {
      try {
        await this.ordersService.expireRiderOffer(
          order._id.toString(),
          String(order.riderId),
        );
        expired += 1;
        this.logger.log(
          `Offer for order ${order.orderId} expired; moved on from rider ${String(order.riderId)}`,
        );
      } catch (error) {
        // Accepted or changed meanwhile: nothing to do.
        this.logger.debug?.(
          `Offer expiry skipped for ${order.orderId}: ${(error as Error).message}`,
        );
      }
    }
    return expired;
  }

  /**
   * A rider marked busy while holding no order (a lost release, or riders
   * stuck by the old "online = busy" bug) becomes available again.
   */
  async releaseIdleBusyRiders(): Promise<number> {
    const busy = await this.riderModel
      .find({ status: RiderStatus.BUSY })
      .select('_id')
      .lean()
      .exec();
    if (!busy.length) return 0;

    const holding = new Set(
      (
        await this.orderModel.distinct('riderId', {
          riderId: { $in: busy.map((r) => r._id) },
          orderStatus: { $in: RIDER_HOLDING_STATUSES },
        })
      ).map(String),
    );

    let released = 0;
    for (const rider of busy) {
      if (holding.has(String(rider._id))) continue;
      // Re-check right before the update: assignRider claims the rider a
      // moment before it writes riderId onto the order.
      const nowHolding = await this.orderModel.exists({
        riderId: rider._id,
        orderStatus: { $in: RIDER_HOLDING_STATUSES },
      });
      if (nowHolding) continue;
      const res = await this.riderModel
        .updateOne(
          { _id: rider._id, status: RiderStatus.BUSY },
          { $set: { status: RiderStatus.AVAILABLE } },
        )
        .exec();
      if (res.modifiedCount) released += 1;
    }
    if (released) this.logger.log(`Released ${released} idle busy rider(s)`);
    return released;
  }

  /**
   * "Available" riders the server has not heard from for
   * RIDER_STALE_AFTER_MS (app killed, phone off, no signal) go offline so
   * the admin sees the truth and orders are not offered to them. Busy
   * riders are left alone: they are holding an order.
   */
  async markStaleRidersOffline(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RIDER_STALE_AFTER_MS);
    const stale = await this.riderModel
      .find({
        status: RiderStatus.AVAILABLE,
        // Contact = lastActiveAt, else the last location report. Never
        // updatedAt: offers and releases touch the rider document, which
        // would keep an unreachable rider looking alive forever.
        $or: [
          { lastActiveAt: { $lt: cutoff } },
          {
            lastActiveAt: null,
            $or: [
              { lastLocationUpdate: { $lt: cutoff } },
              { lastLocationUpdate: null, createdAt: { $lt: cutoff } },
            ],
          },
        ],
      })
      .select('_id')
      .lean()
      .exec();
    if (!stale.length) return 0;

    // A rider with the app connected is reachable even without location
    // updates (standing still at the store sends none): keep them online.
    let connected = new Set<string>();
    try {
      connected =
        (await this.trackingGateway?.connectedRiderIds(
          stale.map((r) => String(r._id)),
        )) ?? connected;
    } catch (error) {
      // Unknown socket state: do not take anyone offline on a guess.
      this.logger.warn(
        `Could not read rider connections, skipping offline sweep: ${(error as Error).message}`,
      );
      return 0;
    }
    if (connected.size) {
      await this.riderModel
        .updateMany(
          { _id: { $in: [...connected] } },
          { $set: { lastActiveAt: new Date() } },
        )
        .exec();
    }

    let marked = 0;
    for (const rider of stale) {
      if (connected.has(String(rider._id))) continue;
      const res = await this.riderModel
        .updateOne(
          { _id: rider._id, status: RiderStatus.AVAILABLE },
          { $set: { status: RiderStatus.OFFLINE } },
        )
        .exec();
      if (!res.modifiedCount) continue;
      marked += 1;
      this.riderPush?.notify(String(rider._id), {
        title: 'You are offline',
        body: 'We lost contact with your phone, so you will not get new orders. Open the app to go online again.',
        data: { type: 'rider_offline' },
        channelId: RIDER_UPDATES_CHANNEL,
      });
    }
    if (marked)
      this.logger.log(`Marked ${marked} unreachable rider(s) offline`);
    return marked;
  }

  /**
   * Process anomalous orders - flag OUT_FOR_DELIVERY orders older than 2 hours
   */
  async processAnomalies(): Promise<void> {
    this.logger.log('Processing anomalous orders...');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find OUT_FOR_DELIVERY orders older than 2 hours
    const anomalousOrders = await this.orderModel
      .find({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        updatedAt: { $lt: twoHoursAgo },
      })
      .exec();

    this.logger.log(`Found ${anomalousOrders.length} anomalous orders`);

    for (const order of anomalousOrders) {
      try {
        // Flag as anomalous (add to order metadata or log)
        this.logger.warn(
          `ANOMALY DETECTED: Order ${order.orderId} has been OUT_FOR_DELIVERY for more than 2 hours`,
        );

        // Notify admins (in production, this would send notifications)
        this.notifyAdmins(order);
      } catch (error) {
        this.logger.error(
          `Failed to process anomalous order ${order.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Process ETA recalculation - update ETA for all OUT_FOR_DELIVERY orders
   */
  async processETAUpdates(): Promise<void> {
    this.logger.log('Processing ETA recalculations...');

    // Find all OUT_FOR_DELIVERY orders
    const activeOrders = await this.orderModel
      .find({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      })
      .select('_id orderId riderId')
      .exec();

    this.logger.log(
      `Found ${activeOrders.length} orders for ETA recalculation`,
    );

    for (const order of activeOrders) {
      try {
        if (order.riderId) {
          await this.etaService.recalculateForOrder(order._id.toString());
          this.logger.log(`Recalculated ETA for order: ${order.orderId}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to recalculate ETA for order ${order.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Get or create system user for automated actions
   */
  private async getSystemUser(): Promise<UserDocument> {
    let systemUser = await this.userModel.findOne({ phone: 'SYSTEM' });

    if (!systemUser) {
      systemUser = await this.userModel.create({
        phone: 'SYSTEM',
        name: 'System',
        role: UserRole.ADMIN,
      });
    }

    return systemUser;
  }

  /**
   * Notify administrators about anomalous orders
   */
  private notifyAdmins(order: OrderDocument): void {
    // In production, this would:
    // 1. Send push notifications to admin devices
    // 2. Send email alerts
    // 3. Create admin dashboard notifications
    // 4. Log to monitoring system (e.g., Sentry, DataDog)

    this.logger.warn(
      `ADMIN NOTIFICATION: Anomalous order ${order.orderId} requires attention`,
    );
  }
}
