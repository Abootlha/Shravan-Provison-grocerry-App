import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ _id: false })
export class NutritionInfo {
    @Prop({ required: false })
    calories?: number;

    @Prop({ required: false })
    protein?: number;

    @Prop({ required: false })
    carbs?: number;

    @Prop({ required: false })
    fat?: number;
}

export const NutritionInfoSchema = SchemaFactory.createForClass(NutritionInfo);

@Schema({ timestamps: true })
export class Product {
    @Prop({ required: true, text: true })
    name!: string;

    @Prop({ required: false })
    nameHi?: string;

    @Prop({ required: false })
    description?: string;

    @Prop({ required: false })
    descriptionHi?: string;

    @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
    categoryId!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subcategory', required: false, index: true })
    subcategoryId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Brand', required: false })
    brandId?: Types.ObjectId;

    @Prop({ required: true, min: 0 })
    price!: number;

    @Prop({ required: true, min: 0 })
    mrp!: number;

    @Prop({ required: true })
    unit!: string;

    @Prop({ required: false, min: 0 })
    weight?: number;

    @Prop({ required: false })
    image?: string;

    @Prop({ type: [String], default: [] })
    images!: string[];

    @Prop({ required: true, min: 0, default: 0 })
    stock!: number;

    @Prop({ required: false, min: 0, default: 10 })
    lowStockThreshold?: number;

    @Prop({ required: true, default: true, index: true })
    isAvailable!: boolean;

    @Prop({ required: false, default: false, index: true })
    isFeatured!: boolean;

    @Prop({ required: false, default: false })
    isOrganic!: boolean;

    @Prop({ type: [String], default: [] })
    tags!: string[];

    @Prop({ required: false, unique: true, sparse: true })
    barcode?: string;

    @Prop({ required: false })
    sku?: string;

    @Prop({ type: NutritionInfoSchema, required: false })
    nutritionInfo?: NutritionInfo;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Brand' }], default: [] })
    relatedBrandIds?: Types.ObjectId[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ barcode: 1 }, { unique: true, sparse: true });
ProductSchema.index({ categoryId: 1, isAvailable: 1 });
ProductSchema.index({ subcategoryId: 1 });
ProductSchema.index({ isFeatured: 1, isAvailable: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
