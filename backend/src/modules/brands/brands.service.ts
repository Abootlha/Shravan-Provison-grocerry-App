import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand, BrandDocument } from './schemas/brand.schema';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<BrandDocument>,
  ) {}

  async findAll(): Promise<Brand[]> {
    return this.brandModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findById(id: string): Promise<Brand | null> {
    return this.brandModel.findById(id).exec();
  }

  async findByName(name: string): Promise<Brand | null> {
    return this.brandModel
      .findOne({ name: new RegExp(`^${name}$`, 'i') })
      .exec();
  }

  async create(data: Partial<Brand>): Promise<Brand> {
    const brand = new this.brandModel(data);
    return brand.save();
  }

  async update(id: string, data: Partial<Brand>): Promise<Brand | null> {
    return this.brandModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.brandModel.findByIdAndDelete(id).exec();
  }

  // Create brand if not exists, return existing if found
  async findOrCreate(name: string): Promise<Brand> {
    let brand = await this.findByName(name);
    if (!brand) {
      brand = await this.create({ name, isActive: true });
    }
    return brand;
  }
}
