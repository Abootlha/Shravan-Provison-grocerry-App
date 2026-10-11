import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BannerDocument = Banner & Document;

export enum BannerTargetType {
  CATEGORY = 'category',
  PRODUCT = 'product',
  URL = 'url',
}

@Schema({ _id: false })
export class BannerTarget {
  @Prop({ type: String, enum: BannerTargetType, required: true })
  type!: BannerTargetType;

  /** Category or product id (type category/product). */
  @Prop({ type: Types.ObjectId })
  id?: Types.ObjectId;

  /** https URL (type url). */
  @Prop()
  url?: string;
}

/** Home-screen carousel banner (data-architecture §1.9). */
@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  titleHi?: string;

  /** https image URL. */
  @Prop({ required: true })
  image!: string;

  @Prop({ type: BannerTarget, required: true })
  target!: BannerTarget;

  @Prop({ default: 0 })
  sortOrder!: number;

  /** Shown from this time (inclusive); null = immediately. */
  @Prop({ type: Date, default: null })
  startsAt?: Date | null;

  /** Hidden from this time; null = no end. */
  @Prop({ type: Date, default: null })
  endsAt?: Date | null;

  @Prop({ default: true })
  isActive!: boolean;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

// Public GET /banners: active, inside the time window, by sortOrder.
BannerSchema.index({ isActive: 1, startsAt: 1, endsAt: 1, sortOrder: 1 });
// Admin list ordering.
BannerSchema.index({ sortOrder: 1, createdAt: -1 });
