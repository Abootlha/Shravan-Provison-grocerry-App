import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockAdjustmentDocument = StockAdjustment & Document;

export enum StockAdjustmentReason {
  RESTOCK = 'restock',
  DAMAGE = 'damage',
  CORRECTION = 'correction',
  RETURN = 'return',
  OTHER = 'other',
}

/** One manual stock change made from the admin panel (collection: stockadjustments). */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class StockAdjustment {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;

  /** Positive adds stock, negative removes it. */
  @Prop({ required: true })
  delta!: number;

  @Prop({ required: true })
  previousStock!: number;

  @Prop({ required: true })
  newStock!: number;

  @Prop({ type: String, enum: StockAdjustmentReason, required: true })
  reason!: StockAdjustmentReason;

  @Prop()
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop()
  actorRole?: string;

  createdAt?: Date;
}

export const StockAdjustmentSchema =
  SchemaFactory.createForClass(StockAdjustment);

// History of one product (newest first) and the global inventory log.
StockAdjustmentSchema.index({ productId: 1, createdAt: -1 });
StockAdjustmentSchema.index({ createdAt: -1 });
