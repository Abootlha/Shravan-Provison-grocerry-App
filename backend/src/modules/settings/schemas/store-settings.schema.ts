import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DEFAULT_FEES } from '../fees';
import { DEFAULT_TIMEZONE } from '../store-hours';

export type StoreSettingsDocument = StoreSettings & Document;

@Schema({ _id: false })
export class StoreLocation {
  @Prop({ required: true })
  latitude!: number;

  @Prop({ required: true })
  longitude!: number;

  @Prop({ required: true })
  address!: string;
}

@Schema({ _id: false })
export class StoreTimings {
  @Prop({ required: true, default: '08:00' })
  openTime!: string;

  @Prop({ required: true, default: '22:00' })
  closeTime!: string;
}

@Schema({ _id: false })
export class StoreFees {
  @Prop({ default: DEFAULT_FEES.deliveryFee, min: 0 })
  deliveryFee!: number;

  @Prop({ default: DEFAULT_FEES.freeDeliveryThreshold, min: 0 })
  freeDeliveryThreshold!: number;

  @Prop({ default: DEFAULT_FEES.packagingFee, min: 0 })
  packagingFee!: number;

  /** Fraction of the item total (0.05 = 5%). */
  @Prop({ default: DEFAULT_FEES.discountRate, min: 0, max: 1 })
  discountRate!: number;
}

@Schema({ timestamps: true })
export class StoreSettings {
  @Prop({ required: true, unique: true, default: 'main' })
  storeId!: string;

  @Prop({ required: true, default: 'Shravan Kirana Store' })
  storeName!: string;

  @Prop({ type: StoreLocation, required: true })
  location!: StoreLocation;

  @Prop({
    type: StoreTimings,
    required: true,
    default: () => ({ openTime: '08:00', closeTime: '22:00' }),
  })
  storeTimings!: StoreTimings;

  // No placeholder default: set by an admin in Settings.
  @Prop({ required: false })
  contactPhone?: string;

  @Prop()
  contactEmail?: string;

  /** Registered business address (for invoices); location.address is the pickup point. */
  @Prop()
  address?: string;

  @Prop()
  gstin?: string;

  @Prop({ default: DEFAULT_TIMEZONE })
  timezone!: string;

  @Prop({ type: StoreFees, default: () => ({ ...DEFAULT_FEES }) })
  fees!: StoreFees;

  @Prop({ required: true, default: 4 })
  serviceRadiusKm!: number; // Maximum delivery distance in kilometers

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 10 })
  estimatedDeliveryMinutes!: number;
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings);
