import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
    @Prop({ required: true })
    name!: string;

    @Prop({ required: false })
    nameHi?: string;

    @Prop({ required: false })
    description?: string;

    @Prop({ required: false })
    image?: string;

    @Prop({ type: Types.ObjectId, ref: 'Category', required: false, index: true })
    parentId?: Types.ObjectId;

    @Prop({ required: true, default: 0 })
    order!: number;

    @Prop({ required: true, default: true })
    isActive!: boolean;

    @Prop({ type: [String], default: [] })
    tags!: string[];
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ parentId: 1 });
CategorySchema.index({ isActive: 1 });
