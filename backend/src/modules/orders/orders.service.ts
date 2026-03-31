import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Order, OrderDocument, OrderStatus, PaymentMethod, PaymentStatus, ORDER_STATUS_TRANSITIONS } from './schemas/order.schema';
import { OrderStatusLog, OrderStatusLogDocument } from './schemas/order-status-log.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';

@Injectable()
export class OrdersService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(OrderStatusLog.name) private orderStatusLogModel: Model<OrderStatusLogDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private cartService: CartService,
        private productsService: ProductsService,
        private redisService: RedisService,
        private cacheService: CacheService,
        @Inject(forwardRef(() => TrackingGateway))
        private trackingGateway: TrackingGateway,
        @Inject(forwardRef(() => ETAService))
        private etaService: ETAService,
    ) { }

    async createOrder(userId: string, data: {
        deliveryAddress: any;
        paymentMethod: PaymentMethod;
        deliveryInstructions?: string;
        items?: any[];
    }): Promise<OrderDocument> {
        let orderItems = [];
        let itemTotal = 0;

        if (data.items && data.items.length > 0) {
            // Process items from frontend payload securely
            for (const item of data.items) {
                const product = await this.productsService.findById(item.productId);
                if (!product || !product.isAvailable) {
                    throw new BadRequestException(`Product ${item.name || item.productId} is no longer available`);
                }
                if (product.stock < item.quantity) {
                    throw new BadRequestException(`Insufficient stock for ${product.name}`);
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

        const stockLocked = await this.productsService.checkAndLockStock(stockItems);
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

        // Create order
        const order = new this.orderModel({
            orderId,
            userId: new Types.ObjectId(userId),
            items: orderItems,
            itemTotal,
            deliveryFee,
            packagingFee,
            discount,
            totalAmount,
            deliveryAddress: data.deliveryAddress,
            paymentMethod: data.paymentMethod,
            orderStatus: OrderStatus.PENDING,
            estimatedDeliveryTime: dayjs().add(15, 'minutes').toDate(),
            deliveryInstructions: data.deliveryInstructions,
        });

        await order.save();

        // Log status
        await this.logStatusChange(order._id, null, OrderStatus.PENDING, new Types.ObjectId(userId));

        // Cache order status in Redis
        await this.redisService.set(
            RedisService.Keys.orderStatus(orderId),
            OrderStatus.PENDING
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

        // Fallback to database query with rider population
        const order = await this.orderModel
            .findById(orderId)
            .populate('riderId', 'name phone')
            .lean()
            .exec();

        // Cache the result if found
        if (order) {
            await this.cacheService.setOrder(orderId, order);
        }

        return order;
    }

    async findByOrderId(orderId: string): Promise<OrderDocument | null> {
        return this.orderModel.findOne({ orderId }).lean().exec();
    }

    async findByUserId(userId: string): Promise<OrderDocument[]> {
        return this.orderModel
            .find({ userId: new Types.ObjectId(userId) })
            .populate('riderId', 'name phone')
            .select('orderId orderStatus totalAmount createdAt deliveryAddress riderId')
            .lean()
            .exec();
    }

    async findActiveOrders(): Promise<OrderDocument[]> {
        return this.orderModel
            .find({
                orderStatus: {
                    $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED]
                }
            })
            .select('orderId orderStatus userId riderId estimatedDeliveryTime')
            .lean()
            .exec();
    }

    async findAvailableForRiders(): Promise<OrderDocument[]> {
        return this.orderModel
            .find({
                orderStatus: OrderStatus.PACKED,
                riderId: { $exists: false },
            })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }

    validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
        const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
        return allowedTransitions.includes(newStatus);
    }

    addTimelineEntry(order: OrderDocument, status: OrderStatus, userId: string): void {
        if (!order.timeline) {
            order.timeline = [];
        }
        order.timeline.push({
            status,
            timestamp: new Date(),
            changedBy: new Types.ObjectId(userId)
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
                `Cannot transition from ${order.orderStatus} to ${newStatus}`
            );
        }

        // Verify payment status before confirming
        if (newStatus === OrderStatus.CONFIRMED) {
            if (order.paymentStatus !== PaymentStatus.COMPLETED && order.paymentMethod !== 'COD') {
                throw new BadRequestException(
                    'Payment must be completed before confirming order (or use COD)'
                );
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
        await this.logStatusChange(order._id, previousStatus, newStatus, new Types.ObjectId(userId));

        // Update Redis cache with new status
        await this.redisService.set(
            RedisService.Keys.orderStatus(order.orderId),
            newStatus
        );

        // Publish to Redis for real-time updates
        await this.redisService.publish(
            'order-updates',
            JSON.stringify({ orderId: order.orderId, status: newStatus })
        );

        // Broadcast order status update via socket
        this.trackingGateway.broadcastOrderStatusUpdate(order._id.toString(), order);

        // If cancelled, release stock
        if (newStatus === OrderStatus.CANCELLED) {
            const stockItems = order.items.map((item) => ({
                productId: item.productId.toString(),
                quantity: item.quantity,
            }));
            await this.productsService.releaseStock(stockItems);
        }

        // If assigned, calculate initial ETA
        if (newStatus === OrderStatus.ASSIGNED && order.riderId) {
            try {
                const eta = await this.etaService.recalculateForOrder(order._id.toString());
                if (eta) {
                    this.trackingGateway.broadcastETAUpdate(order._id.toString(), eta);
                }
            } catch (error) {
                // Log error but don't fail the status update
                console.error(`Failed to calculate initial ETA for order ${order._id}:`, error);
            }
        }

        return order;
    }

    async assignRider(orderId: string, riderId: string): Promise<OrderDocument> {
        const order = await this.orderModel.findById(orderId);
        if (!order) throw new NotFoundException('Order not found');

        if (!this.validateStatusTransition(order.orderStatus, OrderStatus.ASSIGNED)) {
            throw new BadRequestException(
                `Cannot assign rider while order is ${order.orderStatus}`
            );
        }

        // Validate rider exists and is available
        const rider = await this.userModel.findById(riderId);
        if (!rider) throw new NotFoundException('Rider not found');

        if (!rider.isAvailable || !rider.isOnline) {
            throw new BadRequestException('Rider is not available or offline');
        }

        // Assign rider
        const previousStatus = order.orderStatus;
        order.riderId = new Types.ObjectId(riderId);
        order.orderStatus = OrderStatus.ASSIGNED;
        this.addTimelineEntry(order, OrderStatus.ASSIGNED, riderId);
        await order.save();

        // Invalidate cache
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

        this.trackingGateway.broadcastOrderStatusUpdate(order._id.toString(), order);

        // Calculate initial ETA
        try {
            const eta = await this.etaService.recalculateForOrder(order._id.toString());
            if (eta) {
                this.trackingGateway.broadcastETAUpdate(order._id.toString(), eta);
            }
        } catch (error) {
            // Log error but don't fail the assignment
            console.error(`Failed to calculate initial ETA for order ${order._id}:`, error);
        }

        return order;
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

    async getOrderStatus(orderId: string): Promise<string | null> {
        // Try Redis first
        const cached = await this.redisService.get(RedisService.Keys.orderStatus(orderId));
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
            this.orderModel.find(filter).populate('userId', 'name phone').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
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
