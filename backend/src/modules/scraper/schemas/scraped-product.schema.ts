import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScrapedProductDocument = ScrapedProduct & Document;

/**
 * queued -> scraping -> ready (waiting for review) -> approved | declined
 *                    \-> failed (retry puts it back to queued)
 */
export enum ScrapeStatus {
  QUEUED = 'queued',
  SCRAPING = 'scraping',
  READY = 'ready',
  FAILED = 'failed',
  APPROVING = 'approving',
  APPROVED = 'approved',
  DECLINED = 'declined',
}

/** Statuses that hold the source URL (a new submission of it is skipped). */
export const OPEN_SCRAPE_STATUSES = [
  ScrapeStatus.QUEUED,
  ScrapeStatus.SCRAPING,
  ScrapeStatus.READY,
  ScrapeStatus.FAILED,
  ScrapeStatus.APPROVING,
  ScrapeStatus.APPROVED,
];

export class ScrapedImage {
  /** URL the store serves (R2 public URL, or a data URI without R2). */
  @Prop({ required: true })
  url!: string;

  /** R2 object key; absent when stored inline. */
  @Prop()
  key?: string;

  /** Original image URL on the source site. */
  @Prop()
  sourceUrl?: string;
}

class ScrapedNutrition {
  @Prop() protein?: number;
  @Prop() carbs?: number;
  @Prop() sugar?: number;
  @Prop() fat?: number;
  @Prop() transFat?: number;
  @Prop() servingSize?: string;
}

class Suggestion {
  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subcategory' })
  subcategoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ItemGroup' })
  itemGroupId?: Types.ObjectId;

  @Prop()
  confidence?: string;

  @Prop()
  score?: number;

  @Prop({ type: [String], default: [] })
  matched!: string[];
}

@Schema({ timestamps: true, collection: 'scraped_products' })
export class ScrapedProduct {
  @Prop({ required: true, index: true })
  sourceUrl!: string;

  @Prop({ required: true })
  sourceSite!: string;

  @Prop()
  sourceId?: string;

  @Prop({
    type: String,
    enum: ScrapeStatus,
    default: ScrapeStatus.QUEUED,
    index: true,
  })
  status!: ScrapeStatus;

  /** Links submitted together share a batch id. */
  @Prop({ index: true })
  batchId?: string;

  @Prop()
  error?: string;

  /** Non-fatal problems (an image that failed to download, etc.). */
  @Prop({ type: [String], default: [] })
  warnings!: string[];

  @Prop({ default: 0 })
  attempts!: number;

  // ---- Scraped content (editable by the reviewer) ----
  @Prop()
  name?: string;

  @Prop()
  brand?: string;

  @Prop()
  description?: string;

  @Prop()
  highlights?: string;

  /** Selling price in rupees. */
  @Prop()
  price?: number;

  @Prop()
  mrp?: number;

  @Prop()
  unit?: string;

  @Prop()
  barcode?: string;

  @Prop({ default: 0, min: 0 })
  stock!: number;

  @Prop({ type: [ScrapedImage], default: [] })
  images!: ScrapedImage[];

  /** True when images live in R2; false when stored inline (R2 not configured). */
  @Prop({ default: false })
  imagesInR2!: boolean;

  @Prop({ type: [String], default: [] })
  sourceCategoryPath!: string[];

  @Prop()
  shelfLifeDays?: number;

  @Prop()
  dietary?: string;

  @Prop()
  storage?: string;

  @Prop({ type: ScrapedNutrition })
  nutrition?: ScrapedNutrition;

  // ---- Categorisation ----
  @Prop({ type: Suggestion })
  suggestion?: Suggestion;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subcategory' })
  subcategoryId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ItemGroup' })
  itemGroupId?: Types.ObjectId;

  /** Existing product with the same name or barcode, if any. */
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  duplicateOf?: Types.ObjectId;

  // ---- Review ----
  @Prop({ type: Types.ObjectId, ref: 'User' })
  requestedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  declineReason?: string;

  /** Product created on approval. */
  @Prop({ type: Types.ObjectId, ref: 'Product' })
  productId?: Types.ObjectId;
}

export const ScrapedProductSchema =
  SchemaFactory.createForClass(ScrapedProduct);

ScrapedProductSchema.index({ status: 1, createdAt: -1 });
ScrapedProductSchema.index({ sourceUrl: 1, status: 1 });
ScrapedProductSchema.index({ name: 'text', brand: 'text' });
