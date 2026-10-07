import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ItemGroup, ItemGroupDocument } from './schemas/item-group.schema';

@Injectable()
export class ItemGroupsService {
  constructor(
    @InjectModel(ItemGroup.name)
    private itemGroupModel: Model<ItemGroupDocument>,
  ) {}

  // Get all item groups (with optional subcategory filter)
  async findAll(subcategoryId?: string): Promise<ItemGroupDocument[]> {
    const query: any = {}; // Remove isActive filter to show all item groups
    if (subcategoryId) {
      // Query with both ObjectId and string to handle legacy data
      query.$or = [
        { subcategoryId: new Types.ObjectId(subcategoryId) },
        { subcategoryId: subcategoryId },
      ];
    }

    return this.itemGroupModel
      .find(query)
      .sort({ sortOrder: 1 })
      .populate('subcategoryId', 'name parentId')
      .exec();
  }

  // Get item group by ID
  async findById(id: string): Promise<ItemGroupDocument | null> {
    return this.itemGroupModel
      .findById(id)
      .populate('subcategoryId', 'name parentId')
      .exec();
  }

  // Create new item group
  async create(data: Partial<ItemGroup>): Promise<ItemGroupDocument> {
    // Ensure subcategoryId is converted to ObjectId
    if (data.subcategoryId && typeof data.subcategoryId === 'string') {
      data.subcategoryId = new Types.ObjectId(data.subcategoryId) as any;
    }

    const itemGroup = new this.itemGroupModel(data);
    await itemGroup.save();
    return itemGroup.populate('subcategoryId', 'name parentId');
  }

  // Update item group
  async update(
    id: string,
    data: Partial<ItemGroup>,
  ): Promise<ItemGroupDocument> {
    const itemGroup = await this.itemGroupModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!itemGroup) throw new NotFoundException('Item Group not found');
    return itemGroup.populate('subcategoryId', 'name parentId');
  }

  // Delete item group
  async delete(id: string): Promise<void> {
    await this.itemGroupModel.findByIdAndDelete(id);
  }

  // Get count by subcategory
  async countBySubcategory(subcategoryId: string): Promise<number> {
    return this.itemGroupModel.countDocuments({
      subcategoryId: new Types.ObjectId(subcategoryId),
      isActive: true,
    });
  }
}
