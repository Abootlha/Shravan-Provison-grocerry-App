import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { randomInt, timingSafeEqual } from 'crypto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ORDER_STATUS_TRANSITIONS,
} from './schemas/order.schema';
import {
  OrderStatusLog,
  OrderStatusLogDocument,
} from './schemas/order-status-log.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import {
  Rider,
  RiderDocument,
  RiderStatus,
} from '../riders/schemas/rider.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';

export const MAX_DELIVERY_OTP_ATTEMPTS = 5;

// Statuses after which the goods have physically left the store.
const GOODS_LEFT_STORE_STATUSES: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
];

export interface UpdateStatusOptions {
  actorRole?: string;
  deliveryOtp?: string;
  reason?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  private getActiveTrackingLeg(
    status: OrderStatus,
  ): 'to_store' | 'to_customer' | null {
    if ([OrderStatus.ASSIGNED, OrderStatus.PACKED].includes(status)) {
      return 'to_store';
    }

    if (
      [OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY].includes(status)
    ) {
      return 'to_customer';
    }

    return null;
  }

  private generateDeliveryOtp(): string {
    return `${randomInt(1000, 10000)}`;
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(String(a ?? ''));
    const right = Buffer.from(String(b ?? ''));
    if (left.length !== right.length || left.length === 0) {
      return false;
    }
    return timingSafeEqual(left, right);
  }

  isOnlinePayment(order: { paymentMethod?: PaymentMethod }): boolean {
    return order.paymentMethod !== PaymentMethod.COD;
  }

  isPaymentSettledForFulfilment(order: {
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
  }): boolean {
    return (
      !this.isOnlinePayment(order) ||
      order.paymentStatus === PaymentStatus.COMPLETED
    );
  }

  private async ensureDeliveryOtpById(orderId: string): Promise<any> {
    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: orderId,
          $or: [
            { deliveryOtp: { $exists: false } },
            { deliveryOtp: null },
            { deliveryOtp: '' },
          ],
        },
        { $set: { deliveryOtp: this.generateDeliveryOtp() } },
        { new: true },
      )
      .exec();

    return updated;
  }

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatusLog.name)
    private orderStatusLogModel: Model<OrderStatusLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private cartService: CartService,
    private productsService: ProductsService,
    private settingsService: SettingsService,
    private redisService: RedisService,
    private cacheService: CacheService,
    @Inject(forwardRef(() => TrackingGateway))
    private trackingGateway: TrackingGateway,
    @Inject(forwardRef(() => ETAService))
    private etaService: ETAService,
  ) {}

  async createOrder(
    userId: string,
    data: {
      deliveryAddress: any;
      paymentMethod: PaymentMethod;
      deliveryInstructions?: string;
      items?: any[];
    },
  ): Promise<OrderDocument> {
    let orderItems = [];
    let itemTotal = 0;

    if (data.items && data.items.length > 0) {
      // Process items from frontend payload securely
      for (const item of data.items) {
        const product = await this.productsService.findById(item.productId);
        if (!product || !product.isAvailable) {
          throw new BadRequestException(
            `Product ${item.name || item.productId} is no longer available`,
          );
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}`,
          );
        }
        orderItems.push({
          productId: product._id,
          name: product.name,
          quantity: item.quantity,
          price: product.price ?? 0,
          image: product.image,
        });
        itemTotal += (product.price ?? 0) * item.quantity;
      }
    } else {
      // Fallback: Recalculate backend cart
      const cart = await this.cartService.recalculateCart(userId);
      if (!cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }
      orderItems = cart.items.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      }));
      itemTotal = cart.total;
    }

    // Lock stock atomically
    const stockItems = orderItems.map((item: any) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
    }));

    const stockLocked =
      await this.productsService.checkAndLockStock(stockItems);
    if (!stockLocked) {
      throw new BadRequestException('Some items are out of stock');
    }

    // Generate order ID
    const orderId = `ORD-${dayjs().format('YYYYMMDD')}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Calculate totals using the securely computed itemTotal
    const deliveryFee = itemTotal >= 200 ? 0 : 25;
    const packagingFee = 5;
    const discount = Math.round(itemTotal * 0.05); // 5% discount
    const totalAmount = itemTotal + deliveryFee + packagingFee - discount;

    const deliveryAddress = {
      type: data.deliveryAddress.type,
      address: data.deliveryAddress.address,
      city: data.deliveryAddress.city,
      pincode: data.deliveryAddress.pincode,
      coordinates: {
        type: 'Point',
        coordinates: [
          data.deliveryAddress.longitude || 0,
          data.deliveryAddress.latitude || 0,
        ],
      },
    };

    // Create order
    const deliveryOtp = this.generateDeliveryOtp();

    const order = new this.orderModel({
      orderId,
      userId: new Types.ObjectId(userId),
      items: orderItems,
      itemTotal,
      deliveryFee,
      packagingFee,
      discount,
      totalAmount,
      deliveryAddress: deliveryAddress,
      paymentMethod: data.paymentMethod,
      // Payment status is never client-controlled: COD settles on delivery,
      // online methods settle only when PayU confirms via a verified callback.
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.PENDING,
      estimatedDeliveryTime: dayjs().add(15, 'minutes').toDate(),
      deliveryInstructions: data.deliveryInstructions,
      deliveryOtp,
    });

    try {
      await order.save();
    } catch (error) {
      // Stock was already reserved above; give it back if the order never existed.
      await this.productsService.releaseStock(stockItems);
      throw error;
    }

    // Log status
    await this.logStatusChange(
      order._id,
      null,
      OrderStatus.PENDING,
      new Types.ObjectId(userId),
    );

    // Cache order status in Redis
    await this.redisService.set(
      RedisService.Keys.orderStatus(orderId),
      OrderStatus.PENDING,
    );

    // Clear user's cart
    await this.cartService.clearCart(userId);

    return order;
  }

  async findByUser(userId: string, page = 1, limit = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find({ userId: new Types.ObjectId(userId) })
        .select('+deliveryOtp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments({ userId: new Types.ObjectId(userId) }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(orderId: string): Promise<OrderDocument | null> {
    // Check cache first
    const cached = await this.cacheService.getOrder<OrderDocument>(orderId);
    if (cached) {
      return cached;
    }

    // Fallback to database query with rider population
    const order = await this.orderModel
      .findById(orderId)
      .populate('userId', 'name phone')
      .populate(
        'riderId',
        'name phone vehicleType rating totalDeliveries currentLocation status lastLocationUpdate',
      )
      .lean()
      .exec();

    // Cache the result if found
    if (order) {
      await this.cacheService.setOrder(orderId, order);
    }

    return order;
  }

  async findByOrderId(orderId: string): Promise<OrderDocument | null> {
    const existingOrder = await this.orderModel
      .findOne({ orderId })
      .select('_id +deliveryOtp')
      .lean()
      .exec();
    if (existingOrder?._id && !existingOrder.deliveryOtp) {
      await this.ensureDeliveryOtpById(existingOrder._id.toString());
    }

    return this.orderModel
      .findOne({ orderId })
      .populate('userId', 'name phone')
      .populate(
        'riderId',
        'name phone vehicleType rating totalDeliveries currentLocation status lastLocationUpdate',
      )
      .lean()
      .exec();
  }

  async findByUserId(userId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('riderId', 'name phone')
      .select(
        'orderId orderStatus totalAmount createdAt deliveryAddress riderId',
      )
      .lean()
      .exec();
  }

  async findActiveOrders(): Promise<OrderDocument[]> {
    return this.orderModel
      .find({
        orderStatus: {
          $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        },
      })
      .select('orderId orderStatus userId riderId estimatedDeliveryTime')
      .lean()
      .exec();
  }

  async findAvailableForRiders(riderId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({
        orderStatus: OrderStatus.CONFIRMED,
        riderId: new Types.ObjectId(riderId),
      })
      .sort({ createdAt: -1 })
      .populate('userId', 'name phone')
      .lean()
      .exec();
  }

  async findCurrentForRider(riderId: string): Promise<any> {
    const currentOrder = await this.orderModel
      .findOne({
        riderId: new Types.ObjectId(riderId),
        orderStatus: {
          $in: [
            OrderStatus.ASSIGNED,
            OrderStatus.PACKED,
            OrderStatus.PICKED_UP,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      })
      .sort({ updatedAt: -1 })
      .select('_id')
      .lean()
      .exec();

    if (!currentOrder?._id) {
      return null;
    }

    return this.buildRealtimeOrderPayload(currentOrder._id.toString());
  }

  /**
   * Builds the order payload used by REST responses and socket broadcasts.
   * The delivery OTP is only included when includeDeliveryOtp is set, which
   * callers must only do for the owning customer.
   */
  async buildRealtimeOrderPayload(
    orderId: string,
    options: { includeDeliveryOtp?: boolean } = {},
  ): Promise<any> {
    if (options.includeDeliveryOtp) {
      await this.ensureDeliveryOtpById(orderId);
    }

    const orderQuery = this.orderModel.findById(orderId);
    if (options.includeDeliveryOtp) {
      orderQuery.select('+deliveryOtp');
    }

    const [order, storeSettings] = await Promise.all([
      orderQuery
        .populate('userId', 'name phone')
        .populate(
          'riderId',
          'name phone vehicleType rating totalDeliveries currentLocation status lastLocationUpdate',
        )
        .lean()
        .exec(),
      this.settingsService.getStoreSettings(),
    ]);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const rider =
      order.riderId && typeof order.riderId === 'object'
        ? {
            id:
              (order.riderId as any)._id?.toString?.() ||
              (order.riderId as any).id,
            name: (order.riderId as any).name,
            phone: (order.riderId as any).phone || '',
            vehicleType: (order.riderId as any).vehicleType,
            rating: (order.riderId as any).rating ?? 0,
            totalDeliveries: (order.riderId as any).totalDeliveries ?? 0,
            status: (order.riderId as any).status,
            currentLocation: (order.riderId as any).currentLocation
              ? {
                  latitude:
                    (order.riderId as any).currentLocation.coordinates?.[1] ??
                    null,
                  longitude:
                    (order.riderId as any).currentLocation.coordinates?.[0] ??
                    null,
                }
              : null,
          }
        : null;

    const user =
      order.userId && typeof order.userId === 'object'
        ? {
            id:
              (order.userId as any)._id?.toString?.() ||
              (order.userId as any).id,
            name: (order.userId as any).name || 'Customer',
            phone: (order.userId as any).phone || '',
          }
        : null;

    const activeLeg = this.getActiveTrackingLeg(order.orderStatus);
    const riderLocation =
      rider?.currentLocation?.latitude != null &&
      rider?.currentLocation?.longitude != null
        ? {
            latitude: rider.currentLocation.latitude,
            longitude: rider.currentLocation.longitude,
          }
        : null;

    const destination =
      activeLeg === 'to_store'
        ? {
            street: storeSettings.location.address,
            city: 'Store',
            postalCode: '',
            latitude: storeSettings.location.latitude,
            longitude: storeSettings.location.longitude,
          }
        : activeLeg === 'to_customer'
          ? {
              street: order.deliveryAddress.address,
              city: order.deliveryAddress.city,
              postalCode: order.deliveryAddress.pincode,
              latitude: order.deliveryAddress.coordinates.coordinates[1],
              longitude: order.deliveryAddress.coordinates.coordinates[0],
            }
          : null;

    const trackingSnapshot =
      riderLocation && destination
        ? await this.etaService.buildTrackingRouteSnapshot(
            riderLocation,
            destination,
          )
        : null;

    // Strip the OTP (and its attempt counter) unless explicitly requested.
    const orderWithoutOtp = { ...(order as any) };
    delete orderWithoutOtp.deliveryOtp;
    delete orderWithoutOtp.deliveryOtpAttempts;

    return {
      ...orderWithoutOtp,
      ...(options.includeDeliveryOtp ? { deliveryOtp: order.deliveryOtp } : {}),
      rider,
      customerName: user?.name || 'Customer',
      customerPhone: user?.phone || '',
      storeName: storeSettings.storeName,
      storePhone: storeSettings.contactPhone || '',
      storeAddress: storeSettings.location.address,
      storeLocation: {
        latitude: storeSettings.location.latitude,
        longitude: storeSettings.location.longitude,
      },
      tracking: {
        activeLeg,
        riderLocation,
        routeCoordinates: trackingSnapshot?.routeCoordinates || [],
        estimatedDeliveryTime:
          trackingSnapshot?.estimatedDeliveryTime ||
          order.estimatedDeliveryTime ||
          null,
        durationMinutes: trackingSnapshot?.durationMinutes ?? null,
        distanceRemaining: trackingSnapshot?.distanceRemaining ?? null,
        lastLocationUpdateAt:
          (order.riderId as any)?.lastLocationUpdate || null,
      },
    };
  }

  async getTrackingOrderById(
    orderId: string,
    options: { includeDeliveryOtp?: boolean } = {},
  ): Promise<any> {
    return this.buildRealtimeOrderPayload(orderId, options);
  }

  validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): boolean {
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
    return allowedTransitions.includes(newStatus);
  }

  addTimelineEntry(
    order: OrderDocument,
    status: OrderStatus,
    userId: string,
  ): void {
    if (!order.timeline) {
      order.timeline = [];
    }
    order.timeline.push({
      status,
      timestamp: new Date(),
      changedBy: new Types.ObjectId(userId),
    });
  }

  /**
   * Verifies the delivery OTP supplied by the rider. Every attempt (right or
   * wrong) is counted atomically so parallel guesses cannot bypass the limit.
   */
  private async verifyDeliveryOtp(
    orderObjectId: Types.ObjectId | string,
    suppliedOtp?: string,
  ): Promise<void> {
    if (!suppliedOtp || typeof suppliedOtp !== 'string') {
      throw new BadRequestException('deliveryOtp is required to deliver');
    }

    const attempt = await this.orderModel
      .findOneAndUpdate(
        {
          _id: orderObjectId,
          $or: [
            { deliveryOtpAttempts: { $exists: false } },
            { deliveryOtpAttempts: { $lt: MAX_DELIVERY_OTP_ATTEMPTS } },
          ],
        },
        { $inc: { deliveryOtpAttempts: 1 } },
        { new: true },
      )
      .select('+deliveryOtp deliveryOtpAttempts')
      .lean()
      .exec();

    if (!attempt) {
      throw new ForbiddenException(
        'Too many incorrect delivery OTP attempts. Contact support to complete this delivery.',
      );
    }

    if (!this.safeEqual(suppliedOtp.trim(), attempt.deliveryOtp)) {
      const remaining = Math.max(
        MAX_DELIVERY_OTP_ATTEMPTS - (attempt.deliveryOtpAttempts || 0),
        0,
      );
      throw new BadRequestException(
        `Invalid delivery OTP. ${remaining} attempt(s) remaining.`,
      );
    }
  }

  /**
   * Returns reserved stock for an order exactly once. The stockReleased flag is
   * flipped atomically, so only the request that wins the flip releases stock.
   */
  async releaseOrderStock(order: {
    _id: any;
    items: { productId: any; quantity: number }[];
  }): Promise<boolean> {
    const claimed = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, stockReleased: { $ne: true } },
        { $set: { stockReleased: true } },
        { new: true },
      )
      .exec();

    if (!claimed) {
      return false;
    }

    const stockItems = (claimed.items || order.items).map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
    }));
    await this.productsService.releaseStock(stockItems);
    return true;
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    options: UpdateStatusOptions = {},
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const previousStatus = order.orderStatus;

    // Validate transition
    if (!this.validateStatusTransition(previousStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${previousStatus} to ${newStatus}`,
      );
    }

    // Online orders cannot move forward until PayU has confirmed payment.
    if (
      newStatus !== OrderStatus.CANCELLED &&
      !this.isPaymentSettledForFulfilment(order)
    ) {
      throw new BadRequestException(
        'Online payment has not been completed for this order',
      );
    }

    const goodsLeftStore = GOODS_LEFT_STORE_STATUSES.includes(previousStatus);
    if (
      newStatus === OrderStatus.CANCELLED &&
      goodsLeftStore &&
      options.actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Orders that have been picked up can only be cancelled by an admin',
      );
    }

    if (newStatus === OrderStatus.DELIVERED) {
      await this.verifyDeliveryOtp(order._id, options.deliveryOtp);
    }

    const now = new Date();
    const $set: Record<string, any> = { orderStatus: newStatus };
    if (newStatus === OrderStatus.DELIVERED) {
      $set.actualDeliveryTime = now;
      if (order.paymentMethod === PaymentMethod.COD) {
        $set.paymentStatus = PaymentStatus.COMPLETED;
        $set.paymentConfirmedAt = now;
      }
    }
    if (newStatus === OrderStatus.CANCELLED) {
      if (options.reason) {
        $set.cancellationReason = options.reason;
      }
      const reviewReasons: string[] = [];
      if (goodsLeftStore) {
        // Goods already left the store: do not auto-restock, a human must
        // reconcile the inventory once the items are back.
        reviewReasons.push('CANCELLED_AFTER_PICKUP_STOCK_NOT_RELEASED');
      }
      if (
        this.isOnlinePayment(order) &&
        order.paymentStatus === PaymentStatus.COMPLETED
      ) {
        reviewReasons.push('REFUND_REQUIRED');
      }
      if (reviewReasons.length > 0) {
        $set.requiresManualReview = true;
        $set.manualReviewReason = reviewReasons.join(',');
      }
    }

    // Atomic transition: only succeeds if nobody changed the status meanwhile.
    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, orderStatus: previousStatus },
        {
          $set,
          $push: {
            timeline: {
              status: newStatus,
              timestamp: now,
              changedBy: new Types.ObjectId(userId),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Order status was changed by another request. Please refresh and retry.',
      );
    }

    // Invalidate full order cache (for tracking system)
    await this.cacheService.deleteOrder(updated._id.toString());

    // Invalidate Redis cache
    await this.redisService.del(RedisService.Keys.orderStatus(updated.orderId));

    // Only the request that won the transition gets here, so stock is
    // released at most once per order (and releaseOrderStock is idempotent).
    if (newStatus === OrderStatus.CANCELLED && !goodsLeftStore) {
      await this.releaseOrderStock(updated);
    }

    // Log status change
    await this.logStatusChange(
      updated._id,
      previousStatus,
      newStatus,
      new Types.ObjectId(userId),
      options.reason,
    );

    // Update Redis cache with new status
    await this.redisService.set(
      RedisService.Keys.orderStatus(updated.orderId),
      newStatus,
    );

    // Publish to Redis for real-time updates
    await this.redisService.publish(
      'order-updates',
      JSON.stringify({
        orderId: updated.orderId,
        status: newStatus,
        paymentStatus: updated.paymentStatus,
      }),
    );

    const trackingOrder = await this.buildRealtimeOrderPayload(
      updated._id.toString(),
    );

    // Broadcast order status update via socket
    this.trackingGateway.broadcastOrderStatusUpdate(
      updated._id.toString(),
      trackingOrder,
    );

    if (
      updated.riderId &&
      (newStatus === OrderStatus.DELIVERED ||
        newStatus === OrderStatus.CANCELLED)
    ) {
      await this.releaseRider(
        updated.riderId.toString(),
        newStatus === OrderStatus.DELIVERED,
      );
    }

    if (newStatus === OrderStatus.CONFIRMED && !updated.riderId) {
      let assignedOrder: OrderDocument | null = null;
      try {
        assignedOrder = await this.autoAssignNearestRider(
          updated._id.toString(),
        );
      } catch (error) {
        this.logger.warn(
          `Auto-assignment failed for order ${updated.orderId}: ${(error as Error).message}`,
        );
      }

      if (assignedOrder) {
        return assignedOrder;
      }

      // Order stays CONFIRMED and unassigned; the stale-order job retries
      // assignment and admins can assign manually.
      return {
        ...trackingOrder,
        riderAssignmentPending: true,
      } as OrderDocument;
    }

    if (newStatus === OrderStatus.PACKED && updated.riderId) {
      this.trackingGateway.notifyRiderOrderPacked(
        updated.riderId.toString(),
        trackingOrder,
      );
    }

    return trackingOrder as OrderDocument;
  }

  /**
   * Cancels an order through the normal status path (status log, stock
   * release, cache invalidation, socket broadcast).
   */
  async cancelOrder(
    orderId: string,
    actorId: string,
    reason: string,
    actorRole: string = UserRole.ADMIN,
  ): Promise<OrderDocument> {
    return this.updateStatus(orderId, OrderStatus.CANCELLED, actorId, {
      actorRole,
      reason,
    });
  }

  /**
   * Called after a verified PayU success callback. Idempotent: only the first
   * call moves PENDING -> COMPLETED.
   */
  async markPaymentCompleted(
    orderObjectId: string,
    mihpayid?: string,
  ): Promise<{ changed: boolean; requiresRefund?: boolean }> {
    const now = new Date();
    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: orderObjectId,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: { $ne: OrderStatus.CANCELLED },
        },
        {
          $set: {
            paymentStatus: PaymentStatus.COMPLETED,
            paymentConfirmedAt: now,
            ...(mihpayid ? { mihpayid } : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      const current = await this.orderModel
        .findById(orderObjectId)
        .select('orderId orderStatus paymentStatus')
        .lean()
        .exec();

      if (
        current &&
        current.orderStatus === OrderStatus.CANCELLED &&
        current.paymentStatus !== PaymentStatus.COMPLETED
      ) {
        // Money was captured for an order we already cancelled (e.g. payment
        // timeout). Flag it for a refund instead of reviving the order.
        await this.orderModel
          .updateOne(
            { _id: orderObjectId },
            {
              $set: {
                requiresManualReview: true,
                manualReviewReason:
                  'PAYMENT_CAPTURED_AFTER_CANCEL_REFUND_REQUIRED',
                ...(mihpayid ? { mihpayid } : {}),
              },
            },
          )
          .exec();
        this.logger.error(
          `Payment captured for cancelled order ${current.orderId} (mihpayid ${mihpayid}); refund required`,
        );
        return { changed: false, requiresRefund: true };
      }

      return { changed: false };
    }

    await this.afterPaymentStatusChange(updated);
    return { changed: true };
  }

  /**
   * Called after a verified PayU failure callback (or a payment timeout).
   * Idempotent: marks payment FAILED once and cancels the order, which
   * releases stock exactly once.
   */
  async markPaymentFailed(
    orderObjectId: string,
    reason: string,
    mihpayid?: string,
  ): Promise<{ changed: boolean }> {
    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: orderObjectId, paymentStatus: PaymentStatus.PENDING },
        {
          $set: {
            paymentStatus: PaymentStatus.FAILED,
            ...(mihpayid ? { mihpayid } : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      return { changed: false };
    }

    if (
      updated.orderStatus !== OrderStatus.CANCELLED &&
      updated.orderStatus !== OrderStatus.DELIVERED
    ) {
      try {
        const systemUserId = await this.getSystemUserId();
        await this.cancelOrder(updated._id.toString(), systemUserId, reason);
        return { changed: true };
      } catch (error) {
        this.logger.error(
          `Failed to cancel order ${updated.orderId} after payment failure: ${(error as Error).message}`,
        );
      }
    }

    await this.afterPaymentStatusChange(updated);
    return { changed: true };
  }

  private async afterPaymentStatusChange(order: OrderDocument): Promise<void> {
    await this.cacheService.deleteOrder(order._id.toString());
    await this.redisService.publish(
      'order-updates',
      JSON.stringify({
        orderId: order.orderId,
        status: order.orderStatus,
        paymentStatus: order.paymentStatus,
      }),
    );

    try {
      const trackingOrder = await this.buildRealtimeOrderPayload(
        order._id.toString(),
      );
      this.trackingGateway.broadcastOrderStatusUpdate(
        order._id.toString(),
        trackingOrder,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to broadcast payment update for ${order.orderId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * System actor used for automated status changes (jobs, payment callbacks).
   */
  async getSystemUserId(): Promise<string> {
    let systemUser = await this.userModel.findOne({ phone: 'SYSTEM' });

    if (!systemUser) {
      systemUser = await this.userModel.create({
        phone: 'SYSTEM',
        name: 'System',
        role: UserRole.ADMIN,
      });
    }

    return systemUser._id.toString();
  }

  /**
   * Marks a rider available again after delivery/cancellation. Only flips a
   * BUSY rider so an offline rider is not brought back online.
   */
  private async releaseRider(
    riderId: string,
    delivered: boolean,
  ): Promise<void> {
    try {
      if (delivered) {
        await this.riderModel
          .updateOne({ _id: riderId }, { $inc: { totalDeliveries: 1 } })
          .exec();
      }
      await this.riderModel
        .updateOne(
          { _id: riderId, status: RiderStatus.BUSY },
          { $set: { status: RiderStatus.AVAILABLE } },
        )
        .exec();
    } catch (error) {
      this.logger.error(
        `Failed to update rider availability for rider ${riderId}: ${(error as Error).message}`,
      );
    }
  }

  async riderAcceptOrder(
    orderId: string,
    riderId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    // Rider can accept if order is CONFIRMED and reserved for them.
    if (order.orderStatus !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Order is in ${order.orderStatus} status, only CONFIRMED orders can be accepted by rider`,
      );
    }

    if (!order.riderId || order.riderId.toString() !== riderId) {
      throw new ForbiddenException('This order is not assigned to you');
    }

    if (!this.isPaymentSettledForFulfilment(order)) {
      throw new BadRequestException(
        'Online payment has not been completed for this order',
      );
    }

    const previousStatus = order.orderStatus;
    const updated = await this.orderModel
      .findOneAndUpdate(
        {
          _id: order._id,
          orderStatus: OrderStatus.CONFIRMED,
          riderId: new Types.ObjectId(riderId),
        },
        {
          $set: { orderStatus: OrderStatus.ASSIGNED },
          $push: {
            timeline: {
              status: OrderStatus.ASSIGNED,
              timestamp: new Date(),
              changedBy: new Types.ObjectId(riderId),
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Order was changed by another request. Please refresh and retry.',
      );
    }

    await this.cacheService.deleteOrder(updated._id.toString());
    await this.redisService.del(RedisService.Keys.orderStatus(updated.orderId));
    await this.redisService.set(
      RedisService.Keys.orderStatus(updated.orderId),
      OrderStatus.ASSIGNED,
    );
    await this.logStatusChange(
      updated._id,
      previousStatus,
      OrderStatus.ASSIGNED,
      new Types.ObjectId(riderId),
    );
    await this.redisService.publish(
      'order-updates',
      JSON.stringify({
        orderId: updated.orderId,
        status: OrderStatus.ASSIGNED,
      }),
    );

    const trackingOrder = await this.buildRealtimeOrderPayload(
      updated._id.toString(),
    );

    // Broadcast current assignment state so customer/admin/rider all receive the real rider details.
    this.trackingGateway.broadcastOrderStatusUpdate(
      updated._id.toString(),
      trackingOrder,
    );

    // Start broadcasting rider location to the order room
    try {
      const rider = await this.riderModel.findById(riderId);
      if (rider?.currentLocation) {
        this.trackingGateway.broadcastRiderLocationUpdate(
          updated._id.toString(),
          {
            latitude: rider.currentLocation.coordinates[1],
            longitude: rider.currentLocation.coordinates[0],
          },
          riderId,
        );
      }
    } catch (error) {
      console.error(
        `Failed to broadcast initial rider location for order ${String(updated._id)}:`,
        error,
      );
    }

    return trackingOrder as OrderDocument;
  }

  async assignRider(orderId: string, riderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (order.orderStatus !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot assign rider while order is ${order.orderStatus}`,
      );
    }

    if (!this.isPaymentSettledForFulfilment(order)) {
      throw new BadRequestException(
        'Online payment has not been completed for this order',
      );
    }

    if (order.riderId && order.riderId.toString() !== riderId) {
      throw new BadRequestException(
        'This order is already assigned to another rider',
      );
    }

    // Atomically claim the rider: only an AVAILABLE rider can become BUSY, so
    // two concurrent assignments can never both take the same rider.
    const rider = await this.riderModel
      .findOneAndUpdate(
        { _id: riderId, status: RiderStatus.AVAILABLE },
        { $set: { status: RiderStatus.BUSY } },
        { new: true },
      )
      .exec();

    if (!rider) {
      const exists = await this.riderModel.exists({ _id: riderId });
      if (!exists) throw new NotFoundException('Rider not found');
      throw new BadRequestException('Rider is not available');
    }

    const assignmentTimestamp = new Date();
    const updatedOrder = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        $or: [
          { riderId: { $exists: false } },
          { riderId: null },
          { riderId: new Types.ObjectId(riderId) },
        ],
        orderStatus: OrderStatus.CONFIRMED,
      },
      {
        $set: {
          riderId: new Types.ObjectId(riderId),
        },
        $push: {
          timeline: {
            status: OrderStatus.CONFIRMED,
            timestamp: assignmentTimestamp,
            changedBy: new Types.ObjectId(riderId),
          },
        },
      },
      { new: true },
    );

    if (!updatedOrder) {
      // Give the rider back; the order was taken or changed meanwhile.
      await this.riderModel
        .updateOne(
          { _id: riderId, status: RiderStatus.BUSY },
          { $set: { status: RiderStatus.AVAILABLE } },
        )
        .exec();
      throw new BadRequestException(
        'This order was already assigned while processing the request',
      );
    }

    // Invalidate cache
    await this.cacheService.deleteOrder(updatedOrder._id.toString());
    await this.redisService.del(
      RedisService.Keys.orderStatus(updatedOrder.orderId),
    );
    await this.redisService.set(
      RedisService.Keys.orderStatus(updatedOrder.orderId),
      OrderStatus.CONFIRMED,
    );

    await this.redisService.publish(
      'order-updates',
      JSON.stringify({
        orderId: updatedOrder.orderId,
        status: OrderStatus.CONFIRMED,
      }),
    );

    const trackingOrder = await this.buildRealtimeOrderPayload(
      updatedOrder._id.toString(),
    );
    this.trackingGateway.broadcastOrderStatusUpdate(
      updatedOrder._id.toString(),
      trackingOrder,
    );
    this.trackingGateway.notifyRiderOfAssignment(riderId, trackingOrder);

    // Calculate initial ETA
    try {
      const eta = await this.etaService.recalculateForOrder(
        updatedOrder._id.toString(),
      );
      if (eta) {
        const refreshedTrackingOrder = await this.buildRealtimeOrderPayload(
          updatedOrder._id.toString(),
        );
        this.trackingGateway.broadcastETAUpdate(
          updatedOrder._id.toString(),
          eta,
          refreshedTrackingOrder,
        );
      }
    } catch (error) {
      // Log error but don't fail the assignment
      console.error(
        `Failed to calculate initial ETA for order ${String(updatedOrder._id)}:`,
        error,
      );
    }

    return trackingOrder as OrderDocument;
  }

  async unassignRider(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const previousRiderId = order.riderId?.toString();
    order.riderId = undefined;
    await order.save();

    if (previousRiderId) {
      await this.releaseRider(previousRiderId, false);
    }

    // Invalidate cache
    await this.cacheService.deleteOrder(order._id.toString());
    await this.redisService.del(RedisService.Keys.orderStatus(order.orderId));

    return order;
  }

  async autoAssignNearestRider(orderId: string): Promise<OrderDocument | null> {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (
      !order ||
      order.riderId ||
      order.orderStatus !== OrderStatus.CONFIRMED ||
      !this.isPaymentSettledForFulfilment(order)
    ) {
      return null;
    }

    const storeSettings = await this.settingsService.getStoreSettings();
    const triedRiderIds: Types.ObjectId[] = [];

    // A candidate can be claimed by a concurrent assignment between the read
    // and the atomic claim in assignRider, so try a few candidates.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const baseFilter: Record<string, any> = {
        status: RiderStatus.AVAILABLE,
        isActive: true,
        ...(triedRiderIds.length > 0 ? { _id: { $nin: triedRiderIds } } : {}),
      };

      let nearestRider = await this.riderModel
        .findOne({
          ...baseFilter,
          currentLocation: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [
                  storeSettings.location.longitude,
                  storeSettings.location.latitude,
                ],
              },
              $maxDistance: Math.max(storeSettings.serviceRadiusKm, 2) * 1000,
            },
          },
        })
        .lean()
        .exec();

      if (!nearestRider) {
        nearestRider = await this.riderModel
          .findOne(baseFilter)
          .sort({ lastActiveAt: -1, updatedAt: -1, createdAt: 1 })
          .lean()
          .exec();
      }

      if (!nearestRider) {
        return null;
      }

      try {
        return await this.assignRider(orderId, nearestRider._id.toString());
      } catch (error) {
        if (error instanceof BadRequestException) {
          triedRiderIds.push(nearestRider._id);
          continue;
        }
        throw error;
      }
    }

    return null;
  }

  /**
   * Minimal ownership info for authorization checks, looked up by the
   * human-readable orderId.
   */
  async findAccessInfoByOrderId(orderId: string): Promise<{
    _id: Types.ObjectId;
    orderId: string;
    userId: Types.ObjectId;
    riderId?: Types.ObjectId;
    orderStatus: OrderStatus;
  } | null> {
    return (await this.orderModel
      .findOne({ orderId })
      .select('_id orderId userId riderId orderStatus')
      .lean()
      .exec()) as any;
  }

  async getOrderStatus(orderId: string): Promise<string | null> {
    // Try Redis first
    const cached = await this.redisService.get(
      RedisService.Keys.orderStatus(orderId),
    );
    if (cached) return cached;

    const order = await this.findByOrderId(orderId);
    return order?.orderStatus || null;
  }

  async getStatusHistory(orderId: string): Promise<OrderStatusLogDocument[]> {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) return [];

    return this.orderStatusLogModel
      .find({ orderId: order._id })
      .sort({ createdAt: 1 })
      .exec();
  }

  // Admin: Get all orders with filters
  async findAll(query: {
    status?: string | OrderStatus;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status) {
      if (typeof query.status === 'string' && query.status.includes(',')) {
        filter.orderStatus = { $in: query.status.split(',') };
      } else {
        filter.orderStatus = query.status;
      }
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async logStatusChange(
    orderId: Types.ObjectId,
    previousStatus: OrderStatus | null,
    newStatus: OrderStatus,
    changedBy: Types.ObjectId,
    note?: string,
  ): Promise<void> {
    const log = new this.orderStatusLogModel({
      orderId,
      previousStatus,
      newStatus,
      changedBy,
      note,
    });
    await log.save();
  }
}
