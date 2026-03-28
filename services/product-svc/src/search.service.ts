import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './product.schema';
import { RedisService } from './common/utils/redis.service';

export interface SearchResult {
    products: ProductDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    query: string;
}

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        private redisService: RedisService,
    ) {}

    async search(
        query: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<SearchResult> {
        if (!query || query.trim().length < 2) {
            return {
                products: [],
                total: 0,
                page,
                limit,
                totalPages: 0,
                query,
            };
        }

        const skip = (page - 1) * limit;
        const normalizedQuery = query.trim().toLowerCase();

        const cacheKey = RedisService.Keys.search(`${normalizedQuery}:${page}:${limit}`);
        const cached = await this.redisService.getJSON<SearchResult>(cacheKey);
        if (cached) return cached;

        const searchFilter = {
            isAvailable: true,
            $or: [
                { name: { $regex: normalizedQuery, $options: 'i' } },
                { nameHi: { $regex: normalizedQuery, $options: 'i' } },
                { description: { $regex: normalizedQuery, $options: 'i' } },
                { descriptionHi: { $regex: normalizedQuery, $options: 'i' } },
                { tags: { $in: [new RegExp(normalizedQuery, 'i')] } },
                { barcode: { $regex: normalizedQuery, $options: 'i' } },
            ],
        };

        const [products, total] = await Promise.all([
            this.productModel
                .find(searchFilter)
                .skip(skip)
                .limit(limit)
                .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
                .populate('categoryId', 'name nameHi')
                .populate('subcategoryId', 'name')
                .populate('brandId', 'name')
                .exec(),
            this.productModel.countDocuments(searchFilter),
        ]);

        const result: SearchResult = {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            query,
        };

        await this.redisService.setJSON(cacheKey, result, 300);

        return result;
    }

    async searchByBarcode(barcode: string): Promise<ProductDocument | null> {
        return this.productModel
            .findOne({
                barcode,
                isAvailable: true,
            })
            .populate('categoryId', 'name nameHi')
            .populate('subcategoryId', 'name')
            .populate('brandId', 'name')
            .exec();
    }

    async fuzzySearch(
        query: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<SearchResult> {
        if (!query || query.trim().length < 2) {
            return {
                products: [],
                total: 0,
                page,
                limit,
                totalPages: 0,
                query,
            };
        }

        const skip = (page - 1) * limit;
        const normalizedQuery = query.trim();

        const searchFilter = {
            isAvailable: true,
            $or: [
                { name: { $regex: normalizedQuery, $options: 'i' } },
                { nameHi: { $regex: normalizedQuery, $options: 'i' } },
                { description: { $regex: normalizedQuery, $options: 'i' } },
            ],
        };

        const [products, total] = await Promise.all([
            this.productModel
                .find(searchFilter)
                .skip(skip)
                .limit(limit)
                .sort({ name: 1 })
                .populate('categoryId', 'name nameHi')
                .exec(),
            this.productModel.countDocuments(searchFilter),
        ]);

        return {
            products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            query,
        };
    }
}
