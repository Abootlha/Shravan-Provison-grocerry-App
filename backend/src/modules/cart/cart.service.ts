import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';
import { ConfigService } from '@nestjs/config';
import { MAX_CART_ITEM_QUANTITY } from './dto/cart.dto';
import { isProductSellable } from '../products/schemas/product.schema';
import { sellableLine } from '../products/sellable-line';

/** A cart line is one product in one pack size. */
const sameLine = (
  item: { productId: any; variantSku?: string },
  productId: string,
  variantSku?: string,
) =>
  item.productId.toString() === productId &&
  (item.variantSku || undefined) === (variantSku || undefined);

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    private productsService: ProductsService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async getCart(userId: string): Promise<any> {
    // Try Redis cache first
    const cacheKey = RedisService.Keys.cart(userId);
    const cached = await this.redisService.getJSON<any>(cacheKey);
    if (cached) return cached;

    // Get from DB
    let cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!cart) {
      cart = new this.cartModel({
        userId: new Types.ObjectId(userId),
        items: [],
      });
      await cart.save();
    }

    // Enrich with product details
    const enrichedCart = await this.enrichCartWithProducts(cart);

    // Cache
    const ttl = this.configService.get<number>('cache.ttl.cart') || 3600;
    await this.redisService.setJSON(cacheKey, enrichedCart, ttl);

    return enrichedCart;
  }

  /** The product + its sellable line, or a 400/404 explaining why not. */
  private async lineFor(productId: string, variantSku?: string) {
    const product = await this.productsService.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    const line = sellableLine(product, variantSku);
    if (!line)
      throw new BadRequestException(
        variantSku
          ? 'This pack size is not available'
          : 'Product not available',
      );
    return { product, line };
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    variantSku?: string,
  ): Promise<any> {
    // Validate product (and pack size) exists and has stock
    const { line } = await this.lineFor(productId, variantSku);
    if (line.stock < quantity)
      throw new BadRequestException('Insufficient stock');

    let cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!cart) {
      cart = new this.cartModel({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }

    // Check if this product + pack size is already in the cart
    const existingItem = cart.items.find((item) =>
      sameLine(item, productId, line.variantSku),
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > MAX_CART_ITEM_QUANTITY) {
        throw new BadRequestException(
          `Maximum ${MAX_CART_ITEM_QUANTITY} units per product`,
        );
      }
      if (line.stock < newQuantity)
        throw new BadRequestException('Insufficient stock');
      existingItem.quantity = newQuantity;
      existingItem.price = line.price; // Update to current price
    } else {
      cart.items.push({
        productId: new Types.ObjectId(productId),
        quantity,
        price: line.price,
        ...(line.variantSku ? { variantSku: line.variantSku } : {}),
      });
    }

    await cart.save();

    // Invalidate cache
    await this.redisService.del(RedisService.Keys.cart(userId));

    return this.getCart(userId);
  }

  async updateQuantity(
    userId: string,
    productId: string,
    quantity: number,
    variantSku?: string,
  ): Promise<any> {
    if (quantity < 1) {
      return this.removeFromCart(userId, productId, variantSku);
    }

    const { line } = await this.lineFor(productId, variantSku);
    if (line.stock < quantity)
      throw new BadRequestException('Insufficient stock');

    const cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find((i) =>
      sameLine(i, productId, line.variantSku),
    );
    if (!item) throw new NotFoundException('Item not in cart');

    item.quantity = quantity;
    item.price = line.price;
    await cart.save();

    await this.redisService.del(RedisService.Keys.cart(userId));
    return this.getCart(userId);
  }

  async removeFromCart(
    userId: string,
    productId: string,
    variantSku?: string,
  ): Promise<any> {
    const cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!cart) throw new NotFoundException('Cart not found');

    // Without a sku every pack of the product goes (old clients); with one, only that pack.
    cart.items = cart.items.filter((item) =>
      variantSku
        ? !sameLine(item, productId, variantSku)
        : item.productId.toString() !== productId,
    );
    await cart.save();

    await this.redisService.del(RedisService.Keys.cart(userId));
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { items: [] },
    );
    await this.redisService.del(RedisService.Keys.cart(userId));
  }

  // Recalculate cart with current prices (for checkout)
  async recalculateCart(userId: string): Promise<any> {
    const cart = await this.cartModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Update all prices to current
    for (const item of cart.items) {
      const product = await this.productsService.findById(
        item.productId.toString(),
      );
      const line = product ? sellableLine(product, item.variantSku) : null;
      if (!product || !line) {
        throw new BadRequestException(
          `Product ${String(item.productId)} is no longer available`,
        );
      }
      if (line.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
      item.price = line.price;
    }

    await cart.save();
    await this.redisService.del(RedisService.Keys.cart(userId));

    return this.enrichCartWithProducts(cart);
  }

  private async enrichCartWithProducts(cart: CartDocument): Promise<any> {
    const enrichedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await this.productsService.findById(
          item.productId.toString(),
        );
        const line = product ? sellableLine(product, item.variantSku) : null;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          name: product?.name,
          image: product?.image,
          unit: line?.unit ?? product?.unit,
          sku: line?.sku,
          mrp: line?.mrp,
          ...(item.variantSku
            ? {
                variantSku: item.variantSku,
                mirrorsTopLevel: !!line?.mirrorsTopLevel,
              }
            : {}),
          isAvailable: !!line && isProductSellable(product),
        };
      }),
    );

    const total = enrichedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return {
      userId: cart.userId,
      items: enrichedItems,
      itemCount: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
      total,
    };
  }
}
