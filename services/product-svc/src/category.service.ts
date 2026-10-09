import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './category.schema';
import { RedisService } from './common/utils/redis.service';
import { ConfigService } from '@nestjs/config';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
    private readonly logger = new Logger(CategoryService.name);

    constructor(
        @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
        private redisService: RedisService,
        private configService: ConfigService,
    ) {}

    async findAll(): Promise<CategoryDocument[]> {
        const cacheKey = 'categories:all';
        const cached = await this.redisService.getJSON<CategoryDocument[]>(cacheKey);
        if (cached) return cached;

        const categories = await this.categoryModel
            .find({ isActive: true })
            .sort({ order: 1, name: 1 })
            .exec();

        const ttl = this.configService.get<number>('cache.ttl.categories') || 3600;
        await this.redisService.setJSON(cacheKey, categories, ttl);

        return categories;
    }

    async findById(id: string): Promise<CategoryDocument | null> {
        const cacheKey = RedisService.Keys.category(id);
        const cached = await this.redisService.getJSON<CategoryDocument>(cacheKey);
        if (cached) return cached;

        const category = await this.categoryModel.findById(id).exec();
        if (category) {
            const ttl = this.configService.get<number>('cache.ttl.categories') || 3600;
            await this.redisService.setJSON(cacheKey, category, ttl);
        }

        return category;
    }

    async findRootCategories(): Promise<CategoryDocument[]> {
        const categories = await this.categoryModel
            .find({ isActive: true, parentId: null })
            .sort({ order: 1, name: 1 })
            .exec();
        return categories;
    }

    async findSubcategories(parentId: string): Promise<CategoryDocument[]> {
        const categories = await this.categoryModel
            .find({ isActive: true, parentId: new Types.ObjectId(parentId) })
            .sort({ order: 1, name: 1 })
            .exec();
        return categories;
    }

    async getCategoryTree(): Promise<any[]> {
        const rootCategories = await this.findRootCategories();
        const tree = await Promise.all(
            rootCategories.map(async (root) => {
                const children = await this.findSubcategories(root._id.toString());
                return {
                    ...root.toObject(),
                    children: children.map((child) => child.toObject()),
                };
            }),
        );
        return tree;
    }

    async create(data: CreateCategoryDto): Promise<CategoryDocument> {
        const categoryData: any = { ...data };

        if (data.parentId) {
            categoryData.parentId = new Types.ObjectId(data.parentId);
        }

        const category = new this.categoryModel(categoryData);
        await category.save();

        await this.redisService.del('categories:all');

        return category;
    }

    async update(id: string, data: UpdateCategoryDto): Promise<CategoryDocument> {
        const updateData: any = { ...data };

        if (data.parentId) {
            updateData.parentId = new Types.ObjectId(data.parentId);
        }

        const category = await this.categoryModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .exec();

        if (!category) throw new NotFoundException('Category not found');

        await this.redisService.del(RedisService.Keys.category(id));
        await this.redisService.del('categories:all');

        return category;
    }

    async delete(id: string): Promise<void> {
        const result = await this.categoryModel.findByIdAndDelete(id).exec();
        if (!result) throw new NotFoundException('Category not found');

        await this.categoryModel.deleteMany({ parentId: new Types.ObjectId(id) }).exec();

        await this.redisService.del(RedisService.Keys.category(id));
        await this.redisService.del('categories:all');
    }
}
