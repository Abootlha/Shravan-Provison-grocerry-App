import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ACTIVE_STATUS_FILTER,
  Product,
  ProductDocument,
} from './schemas/product.schema';
import { RedisService } from '../../common/utils/redis.service';
import { CatalogCacheService } from '../../common/utils/catalog-cache.service';
import { ConfigService } from '@nestjs/config';

/** Fields that mirror each other (legacy flat field → structured path). */
const LEGACY_FIELD_PATHS: Record<string, string> = {
  price: 'pricing.sellingPrice',
  originalPrice: 'pricing.mrp',
  unit: 'pack.unit',
};

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
    private catalogCache: CatalogCacheService,
  ) {}

  /**
   * Call after any admin change to the catalogue: drops the product detail
   * cache and bumps the catalogue version so every list cache is bypassed.
   */
  async invalidateProduct(id?: string): Promise<void> {
    if (id) await this.redisService.del(RedisService.Keys.product(id));
    await this.catalogCache.bump();
  }

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

    // Build filter: public lists only show active, available products
    // (documents without a status are treated as active).
    const filter: any = { isAvailable: true, ...ACTIVE_STATUS_FILTER };
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
    const cacheKey = this.buildCacheKey(
      query,
      page,
      limit,
      await this.catalogCache.version(),
    );
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

  private buildCacheKey(
    query: any,
    page: number,
    limit: number,
    version: string,
  ): string {
    const parts = ['products', `v${version}`];
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

    await this.invalidateProduct();

    return product;
  }

  /**
   * Partial update: only fields that are present in `data` change (an
   * omitted isAvailable, status, stock... keeps its stored value). Legacy
   * flat fields are mirrored into their structured paths because
   * findByIdAndUpdate does not run the pre('save') sync.
   */
  static buildUpdate(data: Record<string, any>): Record<string, any> {
    const $set: Record<string, any> = {};
    const $unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      $set[key] = value;
    }

    // Prevent duplicate entry on sparse unique barcode index
    if ($set.barcode === '') {
      delete $set.barcode;
      $unset.barcode = 1;
    }
    for (const [flat, path] of Object.entries(LEGACY_FIELD_PATHS)) {
      if ($set[flat] !== undefined) $set[path] = $set[flat];
    }
    if ($set.gst !== undefined) {
      $set['pricing.gst'] = $set.gst;
      delete $set.gst;
    }
    if (Array.isArray($set.images) && $set.image === undefined) {
      if ($set.images.length > 0) $set.image = $set.images[0];
      else $unset.image = 1;
    }

    const update: Record<string, any> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    return update;
  }

  async update(id: string, data: Partial<Product>): Promise<ProductDocument> {
    const updatePayload = ProductsService.buildUpdate(data);

    const product = await this.productModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('categoryId', 'name type')
      .populate('subcategoryId', 'name parentId')
      .populate('itemGroupId', 'name subcategoryId');
    if (!product) throw new NotFoundException('Product not found');

    await this.invalidateProduct(id);

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
