import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Order, OrderDocument } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignRiderDto } from './dto/assign-rider.dto';
import { TimelineService } from './timeline.service';
import { AmqpService } from './amqp.service';
import { RedisService } from './redis.service';
import { OrderStatus, OrderResponse } from './interfaces/order.interface';
import { isValidTransition, isTerminalState } from './state-machine';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly locationSvcUrl: string;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private timelineService: TimelineService,
    @Optional() private amqpService: AmqpService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.locationSvcUrl = this.configService.get<string>('LOCATION_SVC_URL', 'http://localhost:3005');
  }

  private generateOrderId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const uniquePart = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `ORD-${dateStr}-${uniquePart}`;
  }

  private calculateItemTotal(items: CreateOrderDto['items']): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  async createOrder(dto: CreateOrderDto): Promise<OrderResponse> {
    try {
      const itemTotal = this.calculateItemTotal(dto.items);
      const discount = dto.discount ?? 0;
      const totalAmount = itemTotal + dto.deliveryFee + dto.packagingFee - discount;

      const order = new this.orderModel({
        orderId: this.generateOrderId(),
        userId: new Types.ObjectId(dto.userId),
        items: dto.items.map((item) => ({
          ...item,
          productId: new Types.ObjectId(item.productId),
        })),
        itemTotal,
        deliveryFee: dto.deliveryFee,
        packagingFee: dto.packagingFee,
        discount,
        totalAmount,
        deliveryAddress: {
          ...dto.deliveryAddress,
        },
        paymentMethod: dto.paymentMethod,
        paymentStatus: 'PENDING',
        orderStatus: OrderStatus.PENDING,
        timeline: [
          {
            status: OrderStatus.PENDING,
            timestamp: new Date(),
            note: 'Order created',
          },
        ],
      });

      const savedOrder = await order.save();
      this.logger.log(`Order created: ${savedOrder.orderId}`);

      await this.cacheOrder(savedOrder);
      await this.amqpService.publishOrderCreated(savedOrder.toObject() as unknown as Record<string, unknown>);

      return this.toResponse(savedOrder);
    } catch (error) {
      this.logger.error('Failed to create order', error);
      throw new InternalServerErrorException('Failed to create order');
    }
  }

  async getOrderById(orderId: string): Promise<OrderResponse> {
    const cached = await this.redisService.get<OrderResponse>(
      this.redisService.getOrderCacheKey(orderId),
    );
    if (cached) {
      this.logger.debug(`Cache hit for order: ${orderId}`);
      return cached;
    }

    const order = await this.orderModel
      .findOne({ orderId })
      .populate('userId', 'name email phone')
      .populate('riderId', 'name phone vehicleNumber');

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    await this.cacheOrder(order);
    return this.toResponse(order);
  }

  async getOrdersByUserId(userId: string): Promise<OrderResponse[]> {
    const orders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('riderId', 'name phone')
      .sort({ createdAt: -1 });

    return orders.map((order) => this.toResponse(order));
  }

  async getOrdersByRiderId(riderId: string): Promise<OrderResponse[]> {
    const orders = await this.orderModel
      .find({ riderId: new Types.ObjectId(riderId) })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });

    return orders.map((order) => this.toResponse(order));
  }

  async getActiveOrders(): Promise<OrderResponse[]> {
    const activeStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
      OrderStatus.ASSIGNED,
      OrderStatus.OUT_FOR_DELIVERY,
    ];

    const orders = await this.orderModel
      .find({ orderStatus: { $in: activeStatuses } })
      .populate('userId', 'name email phone')
      .populate('riderId', 'name phone vehicleNumber')
      .sort({ createdAt: -1 });

    return orders.map((order) => this.toResponse(order));
  }

  async updateStatus(dto: UpdateStatusDto): Promise<OrderResponse> {
    const order = await this.orderModel.findOne({ orderId: dto.orderId });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    if (!isValidTransition(order.orderStatus as OrderStatus, dto.newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${order.orderStatus} to ${dto.newStatus}`,
      );
    }

    if (isTerminalState(order.orderStatus as OrderStatus)) {
      throw new BadRequestException(`Order is in terminal state ${order.orderStatus}`);
    }

    order.orderStatus = dto.newStatus;

    if (dto.newStatus === OrderStatus.DELIVERED) {
      order.actualDeliveryTime = new Date();
    }

    await order.save();

    await this.timelineService.addTimelineEntry(
      dto.orderId,
      dto.newStatus,
      dto.changedBy ? new Types.ObjectId(dto.changedBy) : undefined,
      dto.note,
    );

    await this.redisService.invalidateOrderCache(dto.orderId);
    await this.amqpService.publishStatusChanged({
      orderId: dto.orderId,
      previousStatus: order.orderStatus,
      newStatus: dto.newStatus,
      timestamp: new Date(),
    });

    this.logger.log(`Order ${dto.orderId} status updated to ${dto.newStatus}`);

    return this.getOrderById(dto.orderId);
  }

  async assignRider(dto: AssignRiderDto): Promise<OrderResponse> {
    const order = await this.orderModel.findOne({ orderId: dto.orderId });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    if (order.orderStatus !== OrderStatus.PACKED) {
      throw new BadRequestException(
        `Order must be in PACKED status to assign rider, current: ${order.orderStatus}`,
      );
    }

    const riderId = new Types.ObjectId(dto.riderId);

    const estimatedTime = await this.calculateEta(order);

    order.riderId = riderId;
    order.orderStatus = OrderStatus.ASSIGNED;
    order.estimatedDeliveryTime = estimatedTime;

    await order.save();

    await this.timelineService.addTimelineEntry(
      dto.orderId,
      OrderStatus.ASSIGNED,
      dto.assignedBy ? new Types.ObjectId(dto.assignedBy) : undefined,
      `Rider ${dto.riderId} assigned`,
    );

    await this.redisService.invalidateOrderCache(dto.orderId);
    await this.amqpService.publishOrderAssigned({
      orderId: dto.orderId,
      riderId: dto.riderId,
      estimatedDeliveryTime: estimatedTime,
    });

    this.logger.log(`Rider ${dto.riderId} assigned to order ${dto.orderId}`);

    return this.getOrderById(dto.orderId);
  }

  async cancelOrder(orderId: string, reason: string, cancelledBy?: string): Promise<OrderResponse> {
    const order = await this.orderModel.findOne({ orderId });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (isTerminalState(order.orderStatus as OrderStatus)) {
      throw new BadRequestException(`Order is already in terminal state ${order.orderStatus}`);
    }

    order.orderStatus = OrderStatus.CANCELLED;
    order.cancellationReason = reason;

    await order.save();

    await this.timelineService.addTimelineEntry(
      orderId,
      OrderStatus.CANCELLED,
      cancelledBy ? new Types.ObjectId(cancelledBy) : undefined,
      reason,
    );

    await this.redisService.invalidateOrderCache(orderId);
    await this.amqpService.publishStatusChanged({
      orderId,
      previousStatus: order.orderStatus,
      newStatus: OrderStatus.CANCELLED,
      reason,
      timestamp: new Date(),
    });

    this.logger.log(`Order ${orderId} cancelled: ${reason}`);

    return this.getOrderById(orderId);
  }

  private async calculateEta(order: OrderDocument): Promise<Date> {
    try {
      const [lng, lat] = order.deliveryAddress.coordinates.coordinates;
      const etaMinutes = 30;
      const eta = new Date();
      eta.setMinutes(eta.getMinutes() + etaMinutes);
      return eta;
    } catch (error) {
      this.logger.warn(`Failed to calculate ETA for order ${order.orderId}, using default`);
      const defaultEta = new Date();
      defaultEta.setMinutes(defaultEta.getMinutes() + 45);
      return defaultEta;
    }
  }

  private async cacheOrder(order: OrderDocument): Promise<void> {
    try {
      await this.redisService.set(
        this.redisService.getOrderCacheKey(order.orderId),
        this.toResponse(order),
      );
    } catch (error) {
      this.logger.warn(`Failed to cache order ${order.orderId}`, error);
    }
  }

  private toResponse(order: OrderDocument): OrderResponse {
    return {
      id: order._id.toString(),
      orderId: order.orderId,
      userId: order.userId.toString(),
      riderId: order.riderId?.toString(),
      items: order.items.map((item) => ({
        productId: item.productId.toString(),
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
      })),
      itemTotal: order.itemTotal,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      discount: order.discount,
      totalAmount: order.totalAmount,
      deliveryAddress: order.deliveryAddress as any,
      paymentMethod: order.paymentMethod as any,
      paymentStatus: order.paymentStatus as any,
      orderStatus: order.orderStatus as any,
      cancellationReason: order.cancellationReason,
      timeline: order.timeline.map((entry) => ({
        status: entry.status as any,
        timestamp: entry.timestamp,
        changedBy: entry.changedBy?.toString(),
        note: entry.note,
      })),
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      actualDeliveryTime: order.actualDeliveryTime,
      createdAt: (order as any).createdAt,
      updatedAt: (order as any).updatedAt,
    };
  }
}
