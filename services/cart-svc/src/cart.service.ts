import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './cart.schema';
import { RedisService } from './common/utils/redis.service';
import { ConfigService } from '@nestjs/config';
import { PriceCalculatorService } from './price-calculator.service';
import { AddCartItemDto, UpdateCartItemDto, CartResponse } from './dto/cart-item.dto';

export interface StockValidationResult {
    valid: boolean;
    unavailableProducts: string[];
    insufficientStock: { productId: string; requested: number; available: number }[];
}

@Injectable()
export class CartService {
    private readonly logger = new Logger(CartService.name);

    constructor(
        @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
        private redisService: RedisService,
        private configService: ConfigService,
        private priceCalculator: PriceCalculatorService,
    ) {}

    async getCart(userId: string): Promise<CartResponse> {
        const cacheKey = RedisService.Keys.cart(userId);
        const cached = await this.redisService.getJSON<CartResponse>(cacheKey);
        if (cached) return cached;

        let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!cart) {
            cart = new this.cartModel({ userId: new Types.ObjectId(userId), items: [] });
            await cart.save();
        }

        const response = this.enrichCart(cart);

        const ttl = this.configService.get<number>('cache.ttl.cart') || 3600;
        await this.redisService.setJSON(cacheKey, response, ttl);

        return response;
    }

    private enrichCart(cart: CartDocument): CartResponse {
        const prices = this.priceCalculator.calculateCartPrices(cart);

        return {
            userId: cart.userId.toString(),
            items: cart.items.map((item) => ({
                productId: item.productId.toString(),
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image,
                unit: item.unit,
            })),
            itemTotal: prices.total,
            itemCount: prices.itemCount,
        };
    }

    async addItem(userId: string, data: AddCartItemDto): Promise<CartResponse> {
        let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!cart) {
            cart = new this.cartModel({
                userId: new Types.ObjectId(userId),
                items: [],
            });
        }

        const existingItem = cart.items.find(
            (item) => item.productId.toString() === data.productId,
        );

        if (existingItem) {
            existingItem.quantity += data.quantity;
            existingItem.price = data.price;
            if (data.name) existingItem.name = data.name;
            if (data.image) existingItem.image = data.image;
            if (data.unit) existingItem.unit = data.unit;
        } else {
            cart.items.push({
                productId: new Types.ObjectId(data.productId),
                name: data.name,
                quantity: data.quantity,
                price: data.price,
                image: data.image,
                unit: data.unit,
            });
        }

        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.getCart(userId);
    }

    async updateItemQuantity(
        userId: string,
        productId: string,
        data: UpdateCartItemDto,
    ): Promise<CartResponse> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) throw new NotFoundException('Cart not found');

        const item = cart.items.find((i) => i.productId.toString() === productId);
        if (!item) throw new NotFoundException('Item not in cart');

        if (data.quantity <= 0) {
            return this.removeItem(userId, productId);
        }

        item.quantity = data.quantity;
        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.getCart(userId);
    }

    async removeItem(userId: string, productId: string): Promise<CartResponse> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) throw new NotFoundException('Cart not found');

        cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.getCart(userId);
    }

    async clearCart(userId: string): Promise<{ message: string }> {
        await this.cartModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { items: [], itemTotal: 0 },
        );

        await this.redisService.del(RedisService.Keys.cart(userId));

        return { message: 'Cart cleared successfully' };
    }

    async validateStock(
        userId: string,
        products: { productId: string; quantity: number; stock: number }[],
    ): Promise<StockValidationResult> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) {
            return {
                valid: false,
                unavailableProducts: [],
                insufficientStock: [],
            };
        }

        const unavailableProducts: string[] = [];
        const insufficientStock: { productId: string; requested: number; available: number }[] = [];

        for (const item of cart.items) {
            const productInfo = products.find((p) => p.productId === item.productId.toString());

            if (!productInfo) {
                unavailableProducts.push(item.productId.toString());
                continue;
            }

            if (item.quantity > productInfo.stock) {
                insufficientStock.push({
                    productId: item.productId.toString(),
                    requested: item.quantity,
                    available: productInfo.stock,
                });
            }
        }

        return {
            valid: unavailableProducts.length === 0 && insufficientStock.length === 0,
            unavailableProducts,
            insufficientStock,
        };
    }

    async recalculateCart(userId: string): Promise<CartResponse> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) throw new NotFoundException('Cart not found');

        const prices = this.priceCalculator.calculateCartPrices(cart);
        cart.itemTotal = prices.total;
        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.getCart(userId);
    }

    async getCartById(cartId: string): Promise<CartDocument | null> {
        return this.cartModel.findById(cartId).exec();
    }
}
