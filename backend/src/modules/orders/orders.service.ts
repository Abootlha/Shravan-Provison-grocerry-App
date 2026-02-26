import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Order, OrderDocument, OrderStatus, PaymentMethod, ORDER_STATUS_TRANSITIONS } from './schemas/order.schema';
import { OrderStatusLog, OrderStatusLogDocument } from './schemas/order-status-log.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';

@Injectable()
export class OrdersService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(OrderStatusLog.name) private orderStatusLogModel: Model<OrderStatusLogDocument>,
        @InjectQueue('orders') private ordersQueue: Queue,
        private cartService: CartService,
        private productsService: ProductsService,
        private redisService: RedisService,
    ) { }

    async createOrder(userId: string, data: {
        deliveryAddress: any;
        paymentMethod: PaymentMethod;
        deliveryInstructions?: string;
    }): Promise<OrderDocument> {
        // Recalculate cart with current prices (NEVER trust frontend prices)
        const cart = await this.cartService.recalculateCart(userId);

        if (!cart.items || cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        // Lock stock atomically
        const stockItems = cart.items.map((item: any) => ({
            productId: item.productId.toString(),
            quantity: item.quantity,
        }));

        const stockLocked = await this.productsService.checkAndLockStock(stockItems);
        if (!stockLocked) {
            throw new BadRequestException('Some items are out of stock');
        }

        // Generate order ID
        const orderId = `ORD-${dayjs().format('YYYYMMDD')}-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Calculate totals
        const itemTotal = cart.total;
        const deliveryFee = itemTotal >= 200 ? 0 : 25;
        const packagingFee = 5;
        const discount = Math.round(itemTotal * 0.05); // 5% discount
        const totalAmount = itemTotal + deliveryFee + packagingFee - discount;

        // Create order
        const order = new this.orderModel({
            orderId,
            userId: new Types.ObjectId(userId),
            items: cart.items.map((item: any) => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image,
            })),
            itemTotal,
            deliveryFee,
            packagingFee,
            discount,
            totalAmount,
            deliveryAddress: data.deliveryAddress,
            paymentMethod: data.paymentMethod,
            orderStatus: OrderStatus.PLACED,
            estimatedDeliveryTime: dayjs().add(15, 'minutes').toDate(),
            deliveryInstructions: data.deliveryInstructions,
        });

        await order.save();

        // Log status
        await this.logStatusChange(order._id, null, OrderStatus.PLACED, new Types.ObjectId(userId));

        // Cache order status in Redis
        await this.redisService.set(
            RedisService.Keys.orderStatus(orderId),
            OrderStatus.PLACED
        );

        // Clear user's cart
        await this.cartService.clearCart(userId);

        // Add to queue for confirmation (in production: after payment verification)
        await this.ordersQueue.add('confirmOrder', { orderId: order._id.toString() }, { delay: 5000 });

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
        return this.orderModel.findById(orderId).exec();
    }

    async findByOrderId(orderId: string): Promise<OrderDocument | null> {
        return this.orderModel.findOne({ orderId }).exec();
    }

    async updateStatus(
        orderId: string,
        newStatus: OrderStatus,
        adminId: string,
        note?: string,
    ): Promise<OrderDocument> {
        const order = await this.orderModel.findById(orderId);
        if (!order) throw new NotFoundException('Order not found');

        // Validate transition
        const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.orderStatus];
        if (!allowedTransitions.includes(newStatus)) {
            throw new BadRequestException(
                `Cannot transition from ${order.orderStatus} to ${newStatus}`
            );
        }

        const previousStatus = order.orderStatus;
        order.orderStatus = newStatus;
        await order.save();

        // Log status change
        await this.logStatusChange(order._id, previousStatus, newStatus, new Types.ObjectId(adminId), note);

        // Update Redis cache
        await this.redisService.set(
            RedisService.Keys.orderStatus(order.orderId),
            newStatus
        );

        // Publish to Redis for real-time updates
        await this.redisService.publish(
            'order-updates',
            JSON.stringify({ orderId: order.orderId, status: newStatus })
        );

        // If cancelled, release stock
        if (newStatus === OrderStatus.CANCELLED) {
            const stockItems = order.items.map((item) => ({
                productId: item.productId.toString(),
                quantity: item.quantity,
            }));
            await this.productsService.releaseStock(stockItems);
        }

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
        status?: OrderStatus;
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
            filter.orderStatus = query.status;
        }

        if (query.startDate || query.endDate) {
            filter.createdAt = {};
            if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
            if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
        }

        const [orders, total] = await Promise.all([
            this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
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
