import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubcategoryDocument = Subcategory & Document;

@Schema({ timestamps: true })
export class Subcategory {
    @Prop({ required: true, index: true })
    name: string;

    @Prop() // Hindi name field
    nameHi: string;

    @Prop({ required: true })
    icon: string;

    @Prop({ required: true })
    color: string;

    @Prop()
    image: string;

    @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
    parentId: Types.ObjectId;

    @Prop({ default: true, index: true })
    isActive: boolean;

    @Prop({ default: 0 })
    sortOrder: number;

    @Prop()
    description: string;

    @Prop() // Hindi description field
    descriptionHi: string;
}

export const SubcategorySchema = SchemaFactory.createForClass(Subcategory);

// Indexes
SubcategorySchema.index({ parentId: 1, isActive: 1, sortOrder: 1 });
SubcategorySchema.index({ isActive: 1, sortOrder: 1 });
