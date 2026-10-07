import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

// Category types for hierarchy
export enum CategoryType {
  CATEGORY = 'category',
  SUBCATEGORY = 'subcategory',
}

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, index: true })
  name!: string;

  @Prop() // Hindi name field
  nameHi?: string;

  @Prop({ required: true })
  icon!: string;

  @Prop({ required: true })
  color!: string;

  @Prop()
  image?: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  // Hierarchy fields
  @Prop({
    type: String,
    enum: CategoryType,
    default: CategoryType.CATEGORY,
    index: true,
  })
  type!: CategoryType;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  parentId?: Types.ObjectId;

  @Prop({ default: 0 })
  level!: number; // 0 = category, 1 = subcategory

  @Prop()
  description?: string;

  @Prop() // Hindi description field
  descriptionHi?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Indexes
CategorySchema.index({ isActive: 1, sortOrder: 1 });
CategorySchema.index({ type: 1, isActive: 1 });
CategorySchema.index({ parentId: 1, isActive: 1, sortOrder: 1 });

// Virtual for subcategories count (optional)
CategorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId',
});
