import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_REORDER_LEVEL,
  Product,
  ProductDocument,
  ProductStatus,
  checkoutPriceOf,
  productStatusOf,
} from './schemas/product.schema';
import {
  StockAdjustment,
  StockAdjustmentDocument,
  StockAdjustmentReason,
} from './schemas/stock-adjustment.schema';
import { ProductsService } from './products.service';
import {
  AdminProductsQueryDto,
  StockAdjustmentDto,
} from './dto/admin-products.dto';
import { escapeRegex, pageMeta } from '../../common/dto/query-transforms';

export type ProductIssue =
  | 'missing_price'
  | 'no_image'
  | 'missing_unit'
  | 'unit_looks_like_barcode';

export type StockState = 'ok' | 'low' | 'out';

/** 8+ consecutive digits in a unit ("8047675773 G") is a barcode, not a unit. */
const BARCODE_IN_UNIT = /\d{8,}/;

const blank = (field: string) => ({
  $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: '' }],
});

/** Mongo filter for products that need attention (see productIssues). */
export const NEEDS_ATTENTION_FILTER = {
  $or: [
    // Checkout uses `price`, else pricing.sellingPrice: both missing or <= 0.
    {
      $and: [
        {
          $or: [
            { price: { $exists: false } },
            { price: null },
            { price: { $lte: 0 } },
          ],
        },
        {
          $or: [
            { 'pricing.sellingPrice': { $exists: false } },
            { 'pricing.sellingPrice': null },
            { 'pricing.sellingPrice': { $lte: 0 } },
          ],
        },
      ],
    },
    {
      $and: [
        blank('image'),
        {
          $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
        },
      ],
    },
    { $and: [blank('unit'), blank('pack.unit')] },
    { unit: { $regex: BARCODE_IN_UNIT.source } },
    { 'pack.unit': { $regex: BARCODE_IN_UNIT.source } },
  ],
};

const LOW_STOCK_EXPR = {
  $lte: ['$stock', { $ifNull: ['$reorderLevel', DEFAULT_REORDER_LEVEL] }],
};

export function productIssues(product: any): ProductIssue[] {
  const issues: ProductIssue[] = [];
  if (checkoutPriceOf(product) === null) issues.push('missing_price');
  const hasImage =
    !!product.image ||
    (Array.isArray(product.images) && product.images.length > 0);
  if (!hasImage) issues.push('no_image');
  const unit: string = product.unit || product.pack?.unit || '';
  if (!unit.trim()) issues.push('missing_unit');
  if (
    BARCODE_IN_UNIT.test(product.unit || '') ||
    BARCODE_IN_UNIT.test(product.pack?.unit || '')
  ) {
    issues.push('unit_looks_like_barcode');
  }
  return issues;
}

export function stockStateOf(product: {
  stock?: number;
  reorderLevel?: number;
}): StockState {
  const stock = product.stock ?? 0;
  if (stock <= 0) return 'out';
  return stock <= (product.reorderLevel ?? DEFAULT_REORDER_LEVEL)
    ? 'low'
    : 'ok';
}

const SORT_FIELDS: Record<string, string> = {
  name: 'name',
  price: 'price',
  stock: 'stock',
  soldCount: 'soldCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const LIST_PROJECTION =
  'name nameHi brand barcode sku categoryId subcategoryId itemGroupId price originalPrice pricing unit pack stock reorderLevel image images isAvailable status soldCount createdAt updatedAt';

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(StockAdjustment.name)
    private adjustmentModel: Model<StockAdjustmentDocument>,
    private productsService: ProductsService,
  ) {}

  /** Mongo filter for the admin list (exported for tests). */
  buildFilter(query: AdminProductsQueryDto): Record<string, any> {
    const and: Record<string, any>[] = [];

    if (query.status === ProductStatus.ACTIVE) {
      and.push({ status: { $in: [ProductStatus.ACTIVE, null] } });
    } else if (query.status) {
      and.push({ status: query.status });
    }
    // Hierarchy ids may be stored as ObjectId or (legacy) string.
    for (const field of [
      'categoryId',
      'subcategoryId',
      'itemGroupId',
    ] as const) {
      const id = query[field];
      if (id) {
        and.push({ [field]: { $in: [new Types.ObjectId(id), id] } });
      }
    }
    if (query.isAvailable !== undefined) {
      and.push({ isAvailable: query.isAvailable });
    }
    if (query.stock === 'out') {
      and.push({ stock: { $lte: 0 } });
    } else if (query.stock === 'low') {
      and.push({ stock: { $gt: 0 } }, { $expr: LOW_STOCK_EXPR });
    }
    if (query.needsAttention) {
      and.push(NEEDS_ATTENTION_FILTER);
    }
    const q = query.q?.trim();
    if (q) {
      const regex = { $regex: escapeRegex(q), $options: 'i' };
      and.push({
        $or: [
          { name: regex },
          { nameHi: regex },
          { brand: regex },
          { barcode: regex },
          { sku: regex },
        ],
      });
    }
    return and.length ? { $and: and } : {};
  }

  private decorate(product: any) {
    return {
      ...product,
      status: productStatusOf(product),
      reorderLevel: product.reorderLevel ?? DEFAULT_REORDER_LEVEL,
      stockState: stockStateOf(product),
      issues: productIssues(product),
    };
  }

  async list(query: AdminProductsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter = this.buildFilter(query);

    const sortKey = query.sort || '-updatedAt';
    const field = SORT_FIELDS[sortKey.replace(/^-/, '')] || 'updatedAt';
    const sort: Record<string, 1 | -1> = {
      [field]: sortKey.startsWith('-') ? -1 : 1,
      _id: 1,
    };

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .select(LIST_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .populate('itemGroupId', 'name')
        .lean()
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      products: products.map((p) => this.decorate(p)),
      ...pageMeta(total, page, limit),
    };
  }

  /** Tab badges for the products screen. */
  async counts() {
    const count = (filter: Record<string, any>) =>
      this.productModel.countDocuments(filter).exec();
    const active = { status: { $in: [ProductStatus.ACTIVE, null] } };
    const [all, activeCount, draft, archived, needsAttention, low, out] =
      await Promise.all([
        count({}),
        count(active),
        count({ status: ProductStatus.DRAFT }),
        count({ status: ProductStatus.ARCHIVED }),
        count({
          $and: [
            { status: { $ne: ProductStatus.ARCHIVED } },
            NEEDS_ATTENTION_FILTER,
          ],
        }),
        count({ ...active, stock: { $gt: 0 }, $expr: LOW_STOCK_EXPR }),
        count({ ...active, stock: { $lte: 0 } }),
      ]);
    return {
      all,
      active: activeCount,
      draft,
      archived,
      needsAttention,
      lowStock: low,
      outOfStock: out,
    };
  }

  async get(id: string) {
    const product = await this.productModel
      .findById(id)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('itemGroupId', 'name')
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Product not found');
    return this.decorate(product);
  }

  async setStatus(id: string, status: ProductStatus) {
    const product = await this.productModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Product not found');
    await this.productsService.invalidateProduct(id);
    return this.decorate(product);
  }

  async bulkSetStatus(ids: string[], status: ProductStatus) {
    const result = await this.productModel
      .updateMany(
        { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
        { $set: { status } },
      )
      .exec();
    for (const id of ids) {
      await this.productsService.invalidateProduct(id);
    }
    return { matched: result.matchedCount, modified: result.modifiedCount };
  }

  async setReorderLevel(id: string, reorderLevel: number) {
    const product = await this.productModel
      .findByIdAndUpdate(id, { $set: { reorderLevel } }, { new: true })
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Product not found');
    await this.productsService.invalidateProduct(id);
    return this.decorate(product);
  }

  /**
   * Atomic stock change with a reason, recorded in `stockadjustments`.
   * A removal can never take stock below zero.
   */
  async adjustStock(
    id: string,
    dto: StockAdjustmentDto,
    actor: { userId?: string; role?: string } = {},
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product id');
    }
    const filter: Record<string, any> = { _id: new Types.ObjectId(id) };
    if (dto.delta < 0) filter.stock = { $gte: -dto.delta };

    const before = await this.productModel
      .findOneAndUpdate(filter, { $inc: { stock: dto.delta } }, { new: false })
      .select('stock reorderLevel name')
      .lean()
      .exec();

    if (!before) {
      const exists = await this.productModel.exists({ _id: id });
      if (!exists) throw new NotFoundException('Product not found');
      throw new ConflictException('Not enough stock to remove that many');
    }

    const previousStock = before.stock ?? 0;
    const newStock = previousStock + dto.delta;
    const adjustment = await this.adjustmentModel.create({
      productId: new Types.ObjectId(id),
      delta: dto.delta,
      previousStock,
      newStock,
      reason: dto.reason,
      note: dto.note?.trim() || undefined,
      actorId:
        actor.userId && Types.ObjectId.isValid(actor.userId)
          ? new Types.ObjectId(actor.userId)
          : undefined,
      actorRole: actor.role,
    });
    await this.productsService.invalidateProduct(id);

    return {
      product: {
        _id: id,
        name: before.name,
        stock: newStock,
        reorderLevel: before.reorderLevel ?? DEFAULT_REORDER_LEVEL,
        stockState: stockStateOf({
          stock: newStock,
          reorderLevel: before.reorderLevel,
        }),
      },
      adjustment,
    };
  }

  /** Legacy PUT /products/:id/stock {quantity}: a restock of +quantity. */
  async restock(
    id: string,
    quantity: number,
    actor: { userId?: string; role?: string } = {},
  ) {
    if (quantity === 0) return null;
    return this.adjustStock(
      id,
      { delta: quantity, reason: StockAdjustmentReason.RESTOCK },
      actor,
    );
  }

  async listAdjustments(productId: string, page = 1, limit = 20) {
    const filter = { productId: new Types.ObjectId(productId) };
    const [adjustments, total] = await Promise.all([
      this.adjustmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actorId', 'name role')
        .lean()
        .exec(),
      this.adjustmentModel.countDocuments(filter),
    ]);
    return { adjustments, ...pageMeta(total, page, limit) };
  }
}
