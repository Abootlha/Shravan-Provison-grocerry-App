import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

@Schema({ timestamps: true })
export class StoreSettings {
    @Prop({ required: true, unique: true, default: 'main' })
    storeId!: string;

    @Prop({ required: true, default: 'Shravan Kirana Store' })
    storeName!: string;

    @Prop({ type: StoreLocation, required: true })
    location!: StoreLocation;

    @Prop({ type: StoreTimings, required: true, default: () => ({ openTime: '08:00', closeTime: '22:00' }) })
    storeTimings!: StoreTimings;

    @Prop({ required: false, default: '+919876543210' })
    contactPhone?: string;

    @Prop({ required: true, default: 4 })
    serviceRadiusKm!: number; // Maximum delivery distance in kilometers

    @Prop({ default: true })
    isActive!: boolean;

    @Prop({ default: 10 })
    estimatedDeliveryMinutes!: number;
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings);
