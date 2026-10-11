import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
import { OrdersService } from '../orders/orders.service';
import { ETAService } from '../orders/eta.service';

export const STALE_ORDER_QUEUE = 'stale-order-check';
export const ANOMALY_QUEUE = 'anomaly-check';
export const ETA_QUEUE = 'eta-recalculation';

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
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private ordersService: OrdersService,
    private etaService: ETAService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Register recurring jobs
    await this.registerStaleOrderCheck();
    await this.registerAnomalyCheck();
    await this.registerETARecalculation();
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
