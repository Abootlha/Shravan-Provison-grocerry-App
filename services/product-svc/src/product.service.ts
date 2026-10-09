import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './product.schema';
import { RedisService } from './common/utils/redis.service';
import { ConfigService } from '@nestjs/config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface PaginatedProducts {
    products: ProductDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        private redisService: RedisService,
        private configService: ConfigService,
    ) {}

    async findAll(query: {
        categoryId?: string;
        subcategoryId?: string;
        brandId?: string;
        page?: number;
        limit?: number;
        search?: string;
        isFeatured?: boolean;
    }): Promise<PaginatedProducts> {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        const filter: any = { isAvailable: true };
        if (query.categoryId) {
            filter.categoryId = new Types.ObjectId(query.categoryId);
        }
        if (query.subcategoryId) {
            filter.subcategoryId = new Types.ObjectId(query.subcategoryId);
        }
        if (query.brandId) {
            filter.brandId = new Types.ObjectId(query.brandId);
        }
        if (query.isFeatured !== undefined) {
            filter.isFeatured = query.isFeatured;
        }

        const cacheKey = this.buildCacheKey(query, page, limit);
        if (!query.search) {
            const cached = await this.redisService.getJSON<PaginatedProducts>(cacheKey);
            if (cached) return cached;
        }

        if (query.search) {
            filter.$text = { $search: query.search };
        }

        const [products, total] = await Promise.all([
            this.productModel
                .find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('categoryId', 'name nameHi')
                .populate('subcategoryId', 'name')
                .populate('brandId', 'name')
                .exec(),
            this.productModel.countDocuments(filter),
        ]);

        const result: PaginatedProducts = {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        if (!query.search) {
            const ttl = this.configService.get<number>('cache.ttl.products') || 300;
            await this.redisService.setJSON(cacheKey, result, ttl);
        }

        return result;
    }

    private buildCacheKey(query: any, page: number, limit: number): string {
        const parts = ['products'];
        if (query.categoryId) parts.push(`cat:${query.categoryId}`);
        if (query.subcategoryId) parts.push(`subcat:${query.subcategoryId}`);
        if (query.brandId) parts.push(`brand:${query.brandId}`);
        if (query.isFeatured) parts.push('featured');
        parts.push(`${page}:${limit}`);
        if (query.search) parts.push(`q:${query.search}`);
        return parts.join(':');
    }

    async findById(id: string): Promise<ProductDocument | null> {
        const cacheKey = RedisService.Keys.product(id);
        const cached = await this.redisService.getJSON<ProductDocument>(cacheKey);
        if (cached) return cached;

        const product = await this.productModel
            .findById(id)
            .populate('categoryId', 'name nameHi')
            .populate('subcategoryId', 'name')
            .populate('brandId', 'name')
            .exec();

        if (product) {
            const ttl = this.configService.get<number>('cache.ttl.productDetail') || 600;
            await this.redisService.setJSON(cacheKey, product, ttl);
        }

        return product;
    }

    async findByBarcode(barcode: string): Promise<ProductDocument | null> {
        return this.productModel.findOne({ barcode }).populate('categoryId', 'name').exec();
    }

    async create(data: CreateProductDto): Promise<ProductDocument> {
        const productData: any = { ...data };

        if (data.categoryId) {
            productData.categoryId = new Types.ObjectId(data.categoryId);
        }
        if (data.subcategoryId) {
            productData.subcategoryId = new Types.ObjectId(data.subcategoryId);
        }
        if (data.brandId) {
            productData.brandId = new Types.ObjectId(data.brandId);
        }

        const product = new this.productModel(productData);
        await product.save();

        await product.populate([
            { path: 'categoryId', select: 'name nameHi' },
            { path: 'subcategoryId', select: 'name' },
            { path: 'brandId', select: 'name' },
        ]);

        if (data.categoryId) {
            await this.redisService.delPattern(`products:cat:${data.categoryId}:*`);
        }

        return product;
    }

    async update(id: string, data: UpdateProductDto): Promise<ProductDocument> {
        const updateData: any = { ...data };

        if (data.categoryId) {
            updateData.categoryId = new Types.ObjectId(data.categoryId);
        }
        if (data.subcategoryId) {
            updateData.subcategoryId = new Types.ObjectId(data.subcategoryId);
        }
        if (data.brandId) {
            updateData.brandId = new Types.ObjectId(data.brandId);
        }

        const product = await this.productModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('categoryId', 'name nameHi')
            .populate('subcategoryId', 'name')
            .populate('brandId', 'name')
            .exec();

        if (!product) throw new NotFoundException('Product not found');

        await this.redisService.del(RedisService.Keys.product(id));
        await this.redisService.delPattern('products:*');

        return product;
    }

    async delete(id: string): Promise<void> {
        const result = await this.productModel.findByIdAndDelete(id).exec();
        if (!result) throw new NotFoundException('Product not found');

        await this.redisService.del(RedisService.Keys.product(id));
        await this.redisService.delPattern('products:*');
    }

    async updateStock(id: string, quantity: number): Promise<void> {
        await this.productModel.findByIdAndUpdate(id, { $inc: { stock: quantity } }).exec();
        await this.redisService.del(RedisService.Keys.product(id));
    }

    async getFeaturedProducts(limit: number = 10): Promise<ProductDocument[]> {
        const cacheKey = RedisService.Keys.productsFeatured();
        const cached = await this.redisService.getJSON<ProductDocument[]>(cacheKey);
        if (cached) return cached;

        const products = await this.productModel
            .find({ isFeatured: true, isAvailable: true })
            .limit(limit)
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .exec();

        const ttl = this.configService.get<number>('cache.ttl.products') || 300;
        await this.redisService.setJSON(cacheKey, products, ttl);

        return products;
    }

    async getProductsByCategory(
        categoryId: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<PaginatedProducts> {
        return this.findAll({ categoryId, page, limit });
    }
}
