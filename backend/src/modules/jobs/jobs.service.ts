import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { OrdersService } from '../orders/orders.service';
import { ETAService } from '../orders/eta.service';

@Injectable()
@Processor('stale-order-check', {
  concurrency: 5,
})
@Processor('anomaly-check', {
  concurrency: 5,
})
@Processor('eta-recalculation', {
  concurrency: 5,
})
export class JobsService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('stale-order-check') private staleOrderQueue: Queue,
    @InjectQueue('anomaly-check') private anomalyQueue: Queue,
    @InjectQueue('eta-recalculation') private etaQueue: Queue,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private ordersService: OrdersService,
    private etaService: ETAService,
  ) {
    super();
  }

  async onModuleInit() {
    // Register recurring jobs
    await this.registerStaleOrderCheck();
    await this.registerAnomalyCheck();
    await this.registerETARecalculation();
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
   * Process jobs from all queues
   */
  async process(job: Job): Promise<any> {
    const queueName = job.queueName;

    try {
      switch (queueName) {
        case 'stale-order-check':
          return await this.processStaleOrders(job);
        case 'anomaly-check':
          return await this.processAnomalies(job);
        case 'eta-recalculation':
          return await this.processETAUpdates(job);
        default:
          this.logger.warn(`Unknown queue: ${queueName}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Process stale orders - cancel PENDING orders older than 24 hours
   */
  async processStaleOrders(job: Job): Promise<void> {
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

    // Get system user ID for automated actions
    const systemUser = await this.getSystemUser();

    for (const order of staleOrders) {
      try {
        // Update to CANCELLED status
        order.orderStatus = OrderStatus.CANCELLED;
        order.cancellationReason = 'AUTO_CANCELLED_STALE';

        // Add timeline entry
        this.ordersService.addTimelineEntry(
          order,
          OrderStatus.CANCELLED,
          systemUser._id.toString(),
        );

        await order.save();

        this.logger.log(`Cancelled stale order: ${order.orderId}`);
      } catch (error) {
        this.logger.error(`Failed to cancel stale order ${order.orderId}:`, error);
      }
    }
  }

  /**
   * Process anomalous orders - flag OUT_FOR_DELIVERY orders older than 2 hours
   */
  async processAnomalies(job: Job): Promise<void> {
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
        await this.notifyAdmins(order);
      } catch (error) {
        this.logger.error(`Failed to process anomalous order ${order.orderId}:`, error);
      }
    }
  }

  /**
   * Process ETA recalculation - update ETA for all OUT_FOR_DELIVERY orders
   */
  async processETAUpdates(job: Job): Promise<void> {
    this.logger.log('Processing ETA recalculations...');

    // Find all OUT_FOR_DELIVERY orders
    const activeOrders = await this.orderModel
      .find({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      })
      .select('_id orderId riderId')
      .exec();

    this.logger.log(`Found ${activeOrders.length} orders for ETA recalculation`);

    for (const order of activeOrders) {
      try {
        if (order.riderId) {
          await this.etaService.recalculateForOrder(order._id.toString());
          this.logger.log(`Recalculated ETA for order: ${order.orderId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to recalculate ETA for order ${order.orderId}:`, error);
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
  private async notifyAdmins(order: OrderDocument): Promise<void> {
    // In production, this would:
    // 1. Send push notifications to admin devices
    // 2. Send email alerts
    // 3. Create admin dashboard notifications
    // 4. Log to monitoring system (e.g., Sentry, DataDog)

    this.logger.warn(`ADMIN NOTIFICATION: Anomalous order ${order.orderId} requires attention`);
  }
}
