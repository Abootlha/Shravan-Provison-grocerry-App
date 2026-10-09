import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Category,
  CategoryDocument,
  CategoryType,
} from './schemas/category.schema';
import { RedisService } from '../../common/utils/redis.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private redisService: RedisService,
  ) {}

  // Get all main categories (type = 'category')
  async findAll(type?: CategoryType): Promise<CategoryDocument[]> {
    const cacheKey = type ? `categories:${type}` : 'categories:all';
    const cached =
      await this.redisService.getJSON<CategoryDocument[]>(cacheKey);
    if (cached) return cached;

    const query: any = { isActive: true };
    if (type) {
      query.type = type;
    } else {
      // Default: return only main categories
      query.type = CategoryType.CATEGORY;
    }

    const categories = await this.categoryModel
      .find(query)
      .sort({ sortOrder: 1 })
      .exec();

    await this.redisService.setJSON(cacheKey, categories, 600);
    return categories;
  }

  // Get subcategories for a parent category
  async findSubcategories(parentId: string): Promise<CategoryDocument[]> {
    const cacheKey = `categories:subcategories:${parentId}`;
    const cached =
      await this.redisService.getJSON<CategoryDocument[]>(cacheKey);
    if (cached) return cached;

    const subcategories = await this.categoryModel
      .find({
        parentId: new Types.ObjectId(parentId),
        type: CategoryType.SUBCATEGORY,
        isActive: true,
      })
      .sort({ sortOrder: 1 })
      .exec();

    await this.redisService.setJSON(cacheKey, subcategories, 600);
    return subcategories;
  }

  // Get all categories with their subcategories (nested)
  async findAllWithSubcategories(): Promise<any[]> {
    const cacheKey = 'categories:nested';
    const cached = await this.redisService.getJSON<any[]>(cacheKey);
    if (cached) return cached;

    const categories = await this.categoryModel
      .find({ type: CategoryType.CATEGORY, isActive: true })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    const result = await Promise.all(
      categories.map(async (cat) => {
        const subcategories = await this.categoryModel
          .find({
            parentId: cat._id,
            type: CategoryType.SUBCATEGORY,
            isActive: true,
          })
          .sort({ sortOrder: 1 })
          .lean()
          .exec();

        return { ...cat, subcategories };
      }),
    );

    await this.redisService.setJSON(cacheKey, result, 600);
    return result;
  }

  async findById(id: string): Promise<CategoryDocument | null> {
    return this.categoryModel.findById(id).exec();
  }

  async create(data: Partial<Category>): Promise<CategoryDocument> {
    // Set level based on type
    if (data.type === CategoryType.SUBCATEGORY && data.parentId) {
      data.level = 1;
    } else {
      data.type = CategoryType.CATEGORY;
      data.level = 0;
    }

    const category = new this.categoryModel(data);
    await category.save();

    // Invalidate all category caches
    await this.invalidateCache(data.parentId?.toString());

    return category;
  }

  async update(id: string, data: Partial<Category>): Promise<CategoryDocument> {
    const existing = await this.categoryModel.findById(id);
    if (!existing) throw new NotFoundException('Category not found');

    const category = await this.categoryModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    // Invalidate caches
    await this.invalidateCache(existing.parentId?.toString());

    return category!;
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoryModel.findById(id);
    if (category) {
      // Delete all subcategories if this is a main category
      if (category.type === CategoryType.CATEGORY) {
        await this.categoryModel.deleteMany({ parentId: category._id });
      }
      await this.categoryModel.findByIdAndDelete(id);
      await this.invalidateCache(category.parentId?.toString());
    }
  }

  private async invalidateCache(parentId?: string): Promise<void> {
    await this.redisService.del('categories:all');
    await this.redisService.del('categories:category');
    await this.redisService.del('categories:subcategory');
    await this.redisService.del('categories:nested');
    if (parentId) {
      await this.redisService.del(`categories:subcategories:${parentId}`);
    }
  }
}
