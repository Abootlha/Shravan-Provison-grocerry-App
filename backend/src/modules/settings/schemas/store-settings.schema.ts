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

@Schema({ timestamps: true })
export class StoreSettings {
    @Prop({ required: true, unique: true, default: 'main' })
    storeId!: string;

    @Prop({ required: true, default: 'Shravan Kirana Store' })
    storeName!: string;

    @Prop({ type: StoreLocation, required: true })
    location!: StoreLocation;

    @Prop({ required: true, default: 4 })
    serviceRadiusKm!: number; // Maximum delivery distance in kilometers

    @Prop({ default: true })
    isActive!: boolean;

    @Prop({ default: 10 })
    estimatedDeliveryMinutes!: number;
}

export const StoreSettingsSchema = SchemaFactory.createForClass(StoreSettings);
