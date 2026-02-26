import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ItemGroupDocument = ItemGroup & Document;

@Schema({ timestamps: true })
export class ItemGroup {
    @Prop({ required: true, index: true })
    name: string;

    @Prop({ type: Types.ObjectId, ref: 'Subcategory', required: true, index: true })
    subcategoryId: Types.ObjectId;

    @Prop()
    image: string;

    @Prop()
    description: string;

    @Prop({ default: true, index: true })
    isActive: boolean;

    @Prop({ default: 0 })
    sortOrder: number;

    @Prop({ type: [String], default: [] })
    tags: string[];
}

export const ItemGroupSchema = SchemaFactory.createForClass(ItemGroup);

// Indexes
ItemGroupSchema.index({ subcategoryId: 1, isActive: 1, sortOrder: 1 });
ItemGroupSchema.index({ name: 'text' });
