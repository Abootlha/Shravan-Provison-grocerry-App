import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Order, OrderDocument, OrderStatus, PaymentMethod, PaymentStatus, ORDER_STATUS_TRANSITIONS } from './schemas/order.schema';
import { OrderStatusLog, OrderStatusLogDocument } from './schemas/order-status-log.schema';
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
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(OrderStatusLog.name) private orderStatusLogModel: Model<OrderStatusLogDocument>,
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

        const deliveryAddress = {
            type: data.deliveryAddress.type,
            address: data.deliveryAddress.address,
            city: data.deliveryAddress.city,
            pincode: data.deliveryAddress.pincode,
            coordinates: {
                type: 'Point',
                coordinates: [data.deliveryAddress.longitude || 0, data.deliveryAddress.latitude || 0],
            },
        };

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
            deliveryAddress: deliveryAddress,
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
            .populate('userId', 'name phone')
            .populate('riderId', 'name phone vehicleType rating totalDeliveries currentLocation status')
            .lean()
            .exec();

        // Cache the result if found
        if (order) {
            await this.cacheService.setOrder(orderId, order);
        }

        return order;
    }

    async findByOrderId(orderId: string): Promise<OrderDocument | null> {
        return this.orderModel
            .findOne({ orderId })
            .populate('userId', 'name phone')
            .populate('riderId', 'name phone vehicleType rating totalDeliveries currentLocation status')
            .lean()
            .exec();
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

    async findAvailableForRiders(riderId: string): Promise<OrderDocument[]> {
        return this.orderModel
            .find({
                orderStatus: OrderStatus.ASSIGNED,
                riderId: new Types.ObjectId(riderId),
            })
            .sort({ createdAt: -1 })
            .populate('userId', 'name phone')
            .lean()
            .exec();
    }

    private async buildRealtimeOrderPayload(orderId: string): Promise<any> {
        const [order, storeSettings] = await Promise.all([
            this.orderModel
                .findById(orderId)
                .populate('userId', 'name phone')
                .populate('riderId', 'name phone vehicleType rating totalDeliveries currentLocation status')
                .lean()
                .exec(),
            this.settingsService.getStoreSettings(),
        ]);

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const rider = order.riderId && typeof order.riderId === 'object'
            ? {
                id: (order.riderId as any)._id?.toString?.() || (order.riderId as any).id,
                name: (order.riderId as any).name,
                phone: (order.riderId as any).phone || '',
                vehicleType: (order.riderId as any).vehicleType,
                rating: (order.riderId as any).rating ?? 0,
                totalDeliveries: (order.riderId as any).totalDeliveries ?? 0,
                status: (order.riderId as any).status,
                currentLocation: (order.riderId as any).currentLocation
                    ? {
                        latitude: (order.riderId as any).currentLocation.coordinates?.[1] ?? null,
                        longitude: (order.riderId as any).currentLocation.coordinates?.[0] ?? null,
                    }
                    : null,
            }
            : null;

        const user = order.userId && typeof order.userId === 'object'
            ? {
                id: (order.userId as any)._id?.toString?.() || (order.userId as any).id,
                name: (order.userId as any).name || 'Customer',
                phone: (order.userId as any).phone || '',
            }
            : null;

        return {
            ...order,
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
        };
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

        const trackingOrder = await this.buildRealtimeOrderPayload(order._id.toString());

        // Broadcast order status update via socket
        this.trackingGateway.broadcastOrderStatusUpdate(order._id.toString(), trackingOrder);

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
            (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.CANCELLED)
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
                console.error(`Failed to update rider availability for order ${order._id}:`, error);
            }
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

        if (newStatus === OrderStatus.PACKED && !order.riderId) {
            try {
                await this.autoAssignNearestRider(order._id.toString());
            } catch (error) {
                console.error(`Failed to auto-assign rider for order ${order._id}:`, error);
            }
        }

        return trackingOrder as OrderDocument;
    }

    async riderAcceptOrder(orderId: string, riderId: string): Promise<OrderDocument> {
        const order = await this.orderModel.findById(orderId);
        if (!order) throw new NotFoundException('Order not found');

        // Rider can accept if order is ASSIGNED to them
        if (order.orderStatus !== OrderStatus.ASSIGNED) {
            throw new BadRequestException(
                `Order is in ${order.orderStatus} status, only ASSIGNED orders can be accepted by rider`
            );
        }

        if (!order.riderId || order.riderId.toString() !== riderId) {
            throw new ForbiddenException('This order is not assigned to you');
        }

        // Accepting confirms ownership and live tracking, but pickup remains a separate rider step.
        const trackingOrder = await this.buildRealtimeOrderPayload(order._id.toString());

        // Broadcast current assignment state so customer/admin/rider all receive the real rider details.
        this.trackingGateway.broadcastOrderStatusUpdate(order._id.toString(), trackingOrder);

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
            console.error(`Failed to broadcast initial rider location for order ${order._id}:`, error);
        }

        return trackingOrder as OrderDocument;
    }

    async assignRider(orderId: string, riderId: string): Promise<OrderDocument> {
        const order = await this.orderModel.findById(orderId);
        if (!order) throw new NotFoundException('Order not found');

        if (!this.validateStatusTransition(order.orderStatus, OrderStatus.ASSIGNED)) {
            throw new BadRequestException(
                `Cannot assign rider while order is ${order.orderStatus}`
            );
        }

        if (order.riderId && order.riderId.toString() !== riderId) {
            throw new BadRequestException('This order is already assigned to another rider');
        }

        // Validate rider exists and is available
        const rider = await this.riderModel.findById(riderId);
        if (!rider) throw new NotFoundException('Rider not found');

        if (rider.status !== 'available') {
            throw new BadRequestException('Rider is not available');
        }

        const previousStatus = order.orderStatus;
        const assignmentTimestamp = new Date();
        const updatedOrder = await this.orderModel.findOneAndUpdate(
            {
                _id: order._id,
                $or: [
                    { riderId: { $exists: false } },
                    { riderId: null },
                    { riderId: new Types.ObjectId(riderId) },
                ],
                orderStatus: { $in: [OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.ASSIGNED] },
            },
            {
                $set: {
                    riderId: new Types.ObjectId(riderId),
                    orderStatus: OrderStatus.ASSIGNED,
                },
                $push: {
                    timeline: {
                        status: OrderStatus.ASSIGNED,
                        timestamp: assignmentTimestamp,
                        changedBy: new Types.ObjectId(riderId),
                    },
                },
            },
            { new: true },
        );

        if (!updatedOrder) {
            throw new BadRequestException('This order was already assigned while processing the request');
        }

        rider.status = 'busy' as any;
        await rider.save();

        // Invalidate cache
        await this.cacheService.deleteOrder(updatedOrder._id.toString());
        await this.redisService.del(RedisService.Keys.orderStatus(updatedOrder.orderId));
        await this.redisService.set(
            RedisService.Keys.orderStatus(updatedOrder.orderId),
            OrderStatus.ASSIGNED,
        );

        await this.logStatusChange(
            updatedOrder._id,
            previousStatus,
            OrderStatus.ASSIGNED,
            new Types.ObjectId(riderId),
        );

        await this.redisService.publish(
            'order-updates',
            JSON.stringify({ orderId: updatedOrder.orderId, status: OrderStatus.ASSIGNED }),
        );

        const trackingOrder = await this.buildRealtimeOrderPayload(updatedOrder._id.toString());
        this.trackingGateway.broadcastOrderStatusUpdate(updatedOrder._id.toString(), trackingOrder);
        this.trackingGateway.notifyRiderOfAssignment(riderId, trackingOrder);

        // Calculate initial ETA
        try {
            const eta = await this.etaService.recalculateForOrder(updatedOrder._id.toString());
            if (eta) {
                this.trackingGateway.broadcastETAUpdate(updatedOrder._id.toString(), eta);
            }
        } catch (error) {
            // Log error but don't fail the assignment
            console.error(`Failed to calculate initial ETA for order ${updatedOrder._id}:`, error);
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
        if (!order || order.riderId || order.orderStatus !== OrderStatus.PACKED) {
            return null;
        }

        const storeSettings = await this.settingsService.getStoreSettings();
        const nearbyRiders = await this.riderModel
            .find({
                status: 'available',
                isActive: true,
                currentLocation: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [storeSettings.location.longitude, storeSettings.location.latitude],
                        },
                        $maxDistance: Math.max(storeSettings.serviceRadiusKm, 2) * 1000,
                    },
                },
            })
            .limit(1)
            .lean()
            .exec();

        const nearestRider = nearbyRiders[0];
        if (!nearestRider) {
            return null;
        }

        return this.assignRider(orderId, nearestRider._id.toString());
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
