import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
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
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';

@Injectable()
export class OrdersService {
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
    return `${Math.floor(1000 + Math.random() * 9000)}`;
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
      paymentStatus?: PaymentStatus;
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
      paymentStatus:
        data.paymentStatus ??
        (data.paymentMethod === PaymentMethod.COD
          ? PaymentStatus.PENDING
          : PaymentStatus.COMPLETED),
      orderStatus: OrderStatus.PENDING,
      estimatedDeliveryTime: dayjs().add(15, 'minutes').toDate(),
      deliveryInstructions: data.deliveryInstructions,
      deliveryOtp,
    });

    await order.save();

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

    await this.ensureDeliveryOtpById(orderId);

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
      .select('_id deliveryOtp')
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

  async findCurrentForRider(riderId: string): Promise<any | null> {
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

  async buildRealtimeOrderPayload(orderId: string): Promise<any> {
    await this.ensureDeliveryOtpById(orderId);

    const [order, storeSettings] = await Promise.all([
      this.orderModel
        .findById(orderId)
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

    return {
      ...order,
      rider,
      customerName: user?.name || 'Customer',
      customerPhone: user?.phone || '',
      deliveryOtp: order.deliveryOtp,
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

  async getTrackingOrderById(orderId: string): Promise<any> {
    return this.buildRealtimeOrderPayload(orderId);
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

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    // Validate transition
    if (!this.validateStatusTransition(order.orderStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.orderStatus} to ${newStatus}`,
      );
    }

    // Verify payment status before confirming
    if (newStatus === OrderStatus.CONFIRMED) {
      if (
        order.paymentStatus !== PaymentStatus.COMPLETED &&
        order.paymentMethod !== PaymentMethod.COD
      ) {
        // Online payments are currently simulated in-app, so admin confirmation should not dead-end.
        order.paymentStatus = PaymentStatus.COMPLETED;
      }
    }

    // Update status
    const previousStatus = order.orderStatus;
    order.orderStatus = newStatus;

    // Add timeline entry
    this.addTimelineEntry(order, newStatus, userId);

    await order.save();

    // Invalidate full order cache (for tracking system)
    await this.cacheService.deleteOrder(order._id.toString());

    // Invalidate Redis cache
    await this.redisService.del(RedisService.Keys.orderStatus(order.orderId));

    // Log status change
    await this.logStatusChange(
      order._id,
      previousStatus,
      newStatus,
      new Types.ObjectId(userId),
    );

    // Update Redis cache with new status
    await this.redisService.set(
      RedisService.Keys.orderStatus(order.orderId),
      newStatus,
    );

    // Publish to Redis for real-time updates
    await this.redisService.publish(
      'order-updates',
      JSON.stringify({ orderId: order.orderId, status: newStatus }),
    );

    const trackingOrder = await this.buildRealtimeOrderPayload(
      order._id.toString(),
    );

    // Broadcast order status update via socket
    this.trackingGateway.broadcastOrderStatusUpdate(
      order._id.toString(),
      trackingOrder,
    );

    if (newStatus === OrderStatus.CONFIRMED && !order.riderId) {
      const assignedOrder = await this.autoAssignNearestRider(
        order._id.toString(),
      );
      if (!assignedOrder) {
        throw new BadRequestException(
          'No available rider could be assigned to this confirmed order',
        );
      }
      return assignedOrder as OrderDocument;
    }

    if (newStatus === OrderStatus.PACKED && order.riderId) {
      this.trackingGateway.notifyRiderOrderPacked(
        order.riderId.toString(),
        trackingOrder,
      );
    }

    // If cancelled, release stock
    if (newStatus === OrderStatus.CANCELLED) {
      const stockItems = order.items.map((item) => ({
        productId: item.productId.toString(),
        quantity: item.quantity,
      }));
      await this.productsService.releaseStock(stockItems);
    }

    if (
      order.riderId &&
      (newStatus === OrderStatus.DELIVERED ||
        newStatus === OrderStatus.CANCELLED)
    ) {
      try {
        const rider = await this.riderModel.findById(order.riderId);
        if (rider) {
          rider.status = 'available' as any;
          if (newStatus === OrderStatus.DELIVERED) {
            rider.totalDeliveries = (rider.totalDeliveries || 0) + 1;
          }
          await rider.save();
        }
      } catch (error) {
        console.error(
          `Failed to update rider availability for order ${order._id}:`,
          error,
        );
      }
    }

    return trackingOrder as OrderDocument;
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

    const previousStatus = order.orderStatus;
    order.orderStatus = OrderStatus.ASSIGNED;
    this.addTimelineEntry(order, OrderStatus.ASSIGNED, riderId);
    await order.save();

    await this.cacheService.deleteOrder(order._id.toString());
    await this.redisService.del(RedisService.Keys.orderStatus(order.orderId));
    await this.redisService.set(
      RedisService.Keys.orderStatus(order.orderId),
      OrderStatus.ASSIGNED,
    );
    await this.logStatusChange(
      order._id,
      previousStatus,
      OrderStatus.ASSIGNED,
      new Types.ObjectId(riderId),
    );
    await this.redisService.publish(
      'order-updates',
      JSON.stringify({ orderId: order.orderId, status: OrderStatus.ASSIGNED }),
    );

    const trackingOrder = await this.buildRealtimeOrderPayload(
      order._id.toString(),
    );

    // Broadcast current assignment state so customer/admin/rider all receive the real rider details.
    this.trackingGateway.broadcastOrderStatusUpdate(
      order._id.toString(),
      trackingOrder,
    );

    // Start broadcasting rider location to the order room
    try {
      const rider = await this.riderModel.findById(riderId);
      if (rider?.currentLocation) {
        this.trackingGateway.broadcastRiderLocationUpdate(
          order._id.toString(),
          {
            latitude: rider.currentLocation.coordinates[1],
            longitude: rider.currentLocation.coordinates[0],
          },
          riderId,
        );
      }
    } catch (error) {
      console.error(
        `Failed to broadcast initial rider location for order ${order._id}:`,
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

    if (order.riderId && order.riderId.toString() !== riderId) {
      throw new BadRequestException(
        'This order is already assigned to another rider',
      );
    }

    // Validate rider exists and is available
    const rider = await this.riderModel.findById(riderId);
    if (!rider) throw new NotFoundException('Rider not found');

    if (rider.status !== 'available') {
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
      throw new BadRequestException(
        'This order was already assigned while processing the request',
      );
    }

    rider.status = 'busy' as any;
    await rider.save();

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
        `Failed to calculate initial ETA for order ${updatedOrder._id}:`,
        error,
      );
    }

    return trackingOrder as OrderDocument;
  }

  async unassignRider(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    order.riderId = undefined;
    await order.save();

    // Invalidate cache
    await this.redisService.del(RedisService.Keys.orderStatus(order.orderId));

    return order;
  }

  async autoAssignNearestRider(orderId: string): Promise<OrderDocument | null> {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (
      !order ||
      order.riderId ||
      order.orderStatus !== OrderStatus.CONFIRMED
    ) {
      return null;
    }

    const storeSettings = await this.settingsService.getStoreSettings();
    let nearestRider = await this.riderModel
      .findOne({
        status: 'available',
        isActive: true,
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
        .findOne({
          status: 'available',
          isActive: true,
        })
        .sort({ lastActiveAt: -1, updatedAt: -1, createdAt: 1 })
        .lean()
        .exec();
    }

    if (!nearestRider) {
      return null;
    }

    return this.assignRider(orderId, nearestRider._id.toString());
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
