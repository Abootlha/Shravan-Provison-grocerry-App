import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CartService {
    constructor(
        @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
        private productsService: ProductsService,
        private redisService: RedisService,
        private configService: ConfigService,
    ) { }

    async getCart(userId: string): Promise<any> {
        // Try Redis cache first
        const cacheKey = RedisService.Keys.cart(userId);
        const cached = await this.redisService.getJSON<any>(cacheKey);
        if (cached) return cached;

        // Get from DB
        let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!cart) {
            cart = new this.cartModel({ userId: new Types.ObjectId(userId), items: [] });
            await cart.save();
        }

        // Enrich with product details
        const enrichedCart = await this.enrichCartWithProducts(cart);

        // Cache
        const ttl = this.configService.get<number>('cache.ttl.cart') || 3600;
        await this.redisService.setJSON(cacheKey, enrichedCart, ttl);

        return enrichedCart;
    }

    async addToCart(userId: string, productId: string, quantity: number = 1): Promise<any> {
        // Validate product exists and has stock
        const product = await this.productsService.findById(productId);
        if (!product) throw new NotFoundException('Product not found');
        if (!product.isAvailable) throw new BadRequestException('Product not available');
        if (product.stock < quantity) throw new BadRequestException('Insufficient stock');

        let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!cart) {
            cart = new this.cartModel({ userId: new Types.ObjectId(userId), items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(
            (item) => item.productId.toString() === productId
        );

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.price = product.price; // Update to current price
        } else {
            cart.items.push({
                productId: new Types.ObjectId(productId),
                quantity,
                price: product.price,
            });
        }

        await cart.save();

        // Invalidate cache
        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.getCart(userId);
    }

    async updateQuantity(userId: string, productId: string, quantity: number): Promise<any> {
        if (quantity < 1) {
            return this.removeFromCart(userId, productId);
        }

        const product = await this.productsService.findById(productId);
        if (!product) throw new NotFoundException('Product not found');
        if (product.stock < quantity) throw new BadRequestException('Insufficient stock');

        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) throw new NotFoundException('Cart not found');

        const item = cart.items.find((i) => i.productId.toString() === productId);
        if (!item) throw new NotFoundException('Item not in cart');

        item.quantity = quantity;
        item.price = product.price;
        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));
        return this.getCart(userId);
    }

    async removeFromCart(userId: string, productId: string): Promise<any> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart) throw new NotFoundException('Cart not found');

        cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
        await cart.save();

        await this.redisService.del(RedisService.Keys.cart(userId));
        return this.getCart(userId);
    }

    async clearCart(userId: string): Promise<void> {
        await this.cartModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { items: [] }
        );
        await this.redisService.del(RedisService.Keys.cart(userId));
    }

    // Recalculate cart with current prices (for checkout)
    async recalculateCart(userId: string): Promise<any> {
        const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!cart || cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        // Update all prices to current
        for (const item of cart.items) {
            const product = await this.productsService.findById(item.productId.toString());
            if (!product || !product.isAvailable) {
                throw new BadRequestException(`Product ${item.productId} is no longer available`);
            }
            if (product.stock < item.quantity) {
                throw new BadRequestException(`Insufficient stock for ${product.name}`);
            }
            item.price = product.price;
        }

        await cart.save();
        await this.redisService.del(RedisService.Keys.cart(userId));

        return this.enrichCartWithProducts(cart);
    }

    private async enrichCartWithProducts(cart: CartDocument): Promise<any> {
        const enrichedItems = await Promise.all(
            cart.items.map(async (item) => {
                const product = await this.productsService.findById(item.productId.toString());
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    name: product?.name,
                    image: product?.image,
                    unit: product?.unit,
                    isAvailable: product?.isAvailable ?? false,
                };
            })
        );

        const total = enrichedItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        return {
            userId: cart.userId,
            items: enrichedItems,
            itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
            total,
        };
    }
}
