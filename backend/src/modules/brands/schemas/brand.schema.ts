import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BrandDocument = Brand & Document;

@Schema({ timestamps: true })
export class Brand {
  @Prop({ required: true, unique: true, index: true })
  name!: string;

  @Prop()
  logo?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  website?: string;

  @Prop()
  description?: string;

  // For sorting popular brands first
  @Prop({ default: 0 })
  sortOrder!: number;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
