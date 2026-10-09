import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { RedisService } from '../../common/utils/redis.service';
import { ConfigService } from '@nestjs/config';

export interface PaginatedProducts {
  products: ProductDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async findAll(query: {
    categoryId?: string;
    subcategoryId?: string;
    itemGroupId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedProducts> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { isAvailable: true };
    if (query.categoryId) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { categoryId: new Types.ObjectId(query.categoryId) },
        { categoryId: query.categoryId },
      );
    }
    if (query.subcategoryId) {
      const subFilter: any = {
        $or: [
          { subcategoryId: new Types.ObjectId(query.subcategoryId) },
          { subcategoryId: query.subcategoryId },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, subFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, subFilter);
      }
    }
    if (query.itemGroupId) {
      const itemFilter: any = {
        $or: [
          { itemGroupId: new Types.ObjectId(query.itemGroupId) },
          { itemGroupId: query.itemGroupId },
        ],
      };
      if (filter.$and) {
        filter.$and.push(itemFilter);
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, itemFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, itemFilter);
      }
    }

    // Check cache for category products
    const cacheKey = this.buildCacheKey(query, page, limit);
    if (!query.search) {
      const cached =
        await this.redisService.getJSON<PaginatedProducts>(cacheKey);
      if (cached) return cached;
    }

    // Text search if provided
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ soldCount: -1 })
        .populate('categoryId', 'name type')
        .populate('subcategoryId', 'name parentId')
        .populate('itemGroupId', 'name subcategoryId')
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    const result = {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Cache result
    if (!query.search) {
      const ttl = this.configService.get<number>('cache.ttl.products') || 300;
      await this.redisService.setJSON(cacheKey, result, ttl);
    }

    return result;
  }

  private buildCacheKey(query: any, page: number, limit: number): string {
    const parts = ['products'];
    if (query.itemGroupId) parts.push(`itemGroup:${query.itemGroupId}`);
    else if (query.subcategoryId)
      parts.push(`subcategory:${query.subcategoryId}`);
    else if (query.categoryId) parts.push(`category:${query.categoryId}`);
    else parts.push('all');
    parts.push(`${page}:${limit}`);
    return parts.join(':');
  }

  async findById(id: string): Promise<ProductDocument | null> {
    // Try cache
    const cacheKey = RedisService.Keys.product(id);
    const cached = await this.redisService.getJSON<ProductDocument>(cacheKey);
    if (cached) return cached;

    const product = await this.productModel
      .findById(id)
      .populate('categoryId', 'name type')
      .populate('subcategoryId', 'name parentId')
      .populate('itemGroupId', 'name subcategoryId')
      .exec();

    if (product) {
      const ttl =
        this.configService.get<number>('cache.ttl.productDetail') || 600;
      await this.redisService.setJSON(cacheKey, product, ttl);
    }

    return product;
  }

  async create(data: Partial<Product>): Promise<ProductDocument> {
    // Ensure ObjectId fields are properly converted
    if (data.categoryId && typeof data.categoryId === 'string') {
      data.categoryId = new Types.ObjectId(data.categoryId) as any;
    }
    if (data.subcategoryId && typeof data.subcategoryId === 'string') {
      data.subcategoryId = new Types.ObjectId(data.subcategoryId) as any;
    }
    if (data.itemGroupId && typeof data.itemGroupId === 'string') {
      data.itemGroupId = new Types.ObjectId(data.itemGroupId) as any;
    }

    // Prevent duplicate entry on sparse unique barcode index
    if (data.barcode === '') {
      data.barcode = undefined;
    }

    const product = new this.productModel(data);
    await product.save();

    // Populate before returning
    await product.populate([
      { path: 'categoryId', select: 'name type' },
      { path: 'subcategoryId', select: 'name parentId' },
      { path: 'itemGroupId', select: 'name subcategoryId' },
    ]);

    // Invalidate category cache
    if (data.categoryId) {
      await this.redisService.delPattern(
        `products:category:${String(data.categoryId)}:*`,
      );
    }
    await this.redisService.delPattern(`products:all:*`);

    return product;
  }

  async update(id: string, data: Partial<Product>): Promise<ProductDocument> {
    const updatePayload: any = { ...data };

    // Prevent duplicate entry on sparse unique barcode index
    if (updatePayload.barcode === '') {
      delete updatePayload.barcode;
      updatePayload.$unset = updatePayload.$unset || {};
      updatePayload.$unset.barcode = 1;
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('categoryId', 'name type')
      .populate('subcategoryId', 'name parentId')
      .populate('itemGroupId', 'name subcategoryId');
    if (!product) throw new NotFoundException('Product not found');

    // Invalidate caches
    await this.redisService.del(RedisService.Keys.product(id));
    await this.redisService.delPattern(
      `products:category:${String(product.categoryId)}:*`,
    );
    await this.redisService.delPattern(`products:all:*`);

    return product;
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    await this.productModel.findByIdAndUpdate(id, {
      $inc: { stock: quantity },
    });
    await this.redisService.del(RedisService.Keys.product(id));
  }

  /**
   * Atomically reserves stock for every item. Each decrement only succeeds if
   * enough stock remains (conditional update), and if any item fails the
   * items already decremented are rolled back.
   */
  async checkAndLockStock(
    items: { productId: string; quantity: number }[],
  ): Promise<boolean> {
    const locked: { productId: string; quantity: number }[] = [];

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        await this.releaseStock(locked);
        return false;
      }

      const result = await this.productModel.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } },
      );

      if (!result || result.modifiedCount !== 1) {
        await this.releaseStock(locked);
        return false;
      }

      locked.push(item);
      await this.redisService.del(RedisService.Keys.product(item.productId));
    }

    return true;
  }

  /**
   * Returns stock for the given items. Callers are responsible for making sure
   * this runs at most once per order (see Order.stockReleased).
   */
  async releaseStock(
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const item of items) {
      await this.productModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } },
      );
      await this.redisService.del(RedisService.Keys.product(item.productId));
    }
  }
}
