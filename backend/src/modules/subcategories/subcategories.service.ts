import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subcategory, SubcategoryDocument } from './schemas/subcategory.schema';
import { RedisService } from '../../common/utils/redis.service';

@Injectable()
export class SubcategoriesService {
    constructor(
        @InjectModel(Subcategory.name) private subcategoryModel: Model<SubcategoryDocument>,
        private redisService: RedisService,
    ) { }

    async findAll(parentId?: string): Promise<SubcategoryDocument[]> {
        const cacheKey = parentId ? `subcategories:parent:${parentId}` : 'subcategories:all';
        
        // Skip cache for now
        // const cached = await this.redisService.getJSON<SubcategoryDocument[]>(cacheKey);
        // if (cached) return cached;

        const query: any = {}; // Remove isActive filter to show all subcategories
        if (parentId) {
            // Query with both ObjectId and string to handle legacy data
            query.$or = [
                { parentId: new Types.ObjectId(parentId) },
                { parentId: parentId }
            ];
        }

        const subcategories = await this.subcategoryModel
            .find(query)
            .populate('parentId', 'name icon color')
            .sort({ sortOrder: 1 })
            .lean() // Use lean() for better performance
            .exec();

        // Check for large base64 images and replace with placeholder
        const processedSubcategories = subcategories.map((subcat: any) => {
            if (subcat.icon && subcat.icon.startsWith('data:image/')) {
                const sizeKB = Math.round(subcat.icon.length / 1024);
                
                // If base64 image is larger than 100KB, replace with empty string
                if (sizeKB > 100) {
                    console.warn(`Large base64 image detected for "${subcat.name}": ${sizeKB}KB. Replacing with placeholder.`);
                    return {
                        ...subcat,
                        icon: '', // Empty string will trigger placeholder in mobile app
                    };
                }
            }
            return subcat;
        });

        await this.redisService.setJSON(cacheKey, processedSubcategories, 600);
        return processedSubcategories as SubcategoryDocument[];
    }

    async findById(id: string): Promise<SubcategoryDocument | null> {
        return this.subcategoryModel.findById(id).populate('parentId', 'name icon color').exec();
    }

    async create(data: Partial<Subcategory>): Promise<SubcategoryDocument> {
        // Ensure parentId is converted to ObjectId
        if (data.parentId && typeof data.parentId === 'string') {
            data.parentId = new Types.ObjectId(data.parentId) as any;
        }
        
        const subcategory = new this.subcategoryModel(data);
        await subcategory.save();

        // Invalidate caches
        await this.invalidateCache(data.parentId?.toString());

        // Populate parentId before returning
        await subcategory.populate('parentId', 'name icon color');
        return subcategory;
    }

    async update(id: string, data: Partial<Subcategory>): Promise<SubcategoryDocument> {
        const existing = await this.subcategoryModel.findById(id);
        if (!existing) throw new NotFoundException('Subcategory not found');

        const subcategory = await this.subcategoryModel.findByIdAndUpdate(id, data, { new: true });

        // Invalidate caches
        await this.invalidateCache(existing.parentId?.toString());
        if (data.parentId && data.parentId.toString() !== existing.parentId.toString()) {
            await this.invalidateCache(data.parentId.toString());
        }

        // Populate parentId before returning
        if (subcategory) {
            await subcategory.populate('parentId', 'name icon color');
        }
        return subcategory!;
    }

    async delete(id: string): Promise<void> {
        const subcategory = await this.subcategoryModel.findById(id);
        if (subcategory) {
            await this.subcategoryModel.findByIdAndDelete(id);
            await this.invalidateCache(subcategory.parentId?.toString());
        }
    }

    private async invalidateCache(parentId?: string): Promise<void> {
        await this.redisService.del('subcategories:all');
        if (parentId) {
            await this.redisService.del(`subcategories:parent:${parentId}`);
        }
    }
}
