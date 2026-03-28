import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RiderDocument = Rider & Document;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], required: true })
  type: string;

  @Prop({ type: [Number], required: true })
  coordinates: number[];
}

export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: false })
export class RiderStats {
  @Prop({ default: 0 })
  totalDeliveries: number;

  @Prop({ default: 0 })
  avgRating: number;

  @Prop({ default: 0 })
  acceptanceRate: number;
}

export const RiderStatsSchema = SchemaFactory.createForClass(RiderStats);

@Schema({ timestamps: true, collection: 'riders' })
export class Rider {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: GeoPointSchema, index: '2dsphere' })
  currentLocation: GeoPoint;

  @Prop({ type: Date })
  lastLocationUpdate: Date;

  @Prop()
  heading: number;

  @Prop()
  speed: number;

  @Prop({ default: false, index: true })
  isAvailable: boolean;

  @Prop({ default: false, index: true })
  isOnline: boolean;

  @Prop({ type: RiderStatsSchema, default: () => ({}) })
  stats: RiderStats;

  @Prop({ type: String, enum: ['motorcycle', 'car', 'bicycle'], default: 'motorcycle' })
  vehicleType: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const RiderSchema = SchemaFactory.createForClass(Rider);

RiderSchema.index({ isAvailable: 1, isOnline: 1, currentLocation: '2dsphere' });
RiderSchema.index({ currentLocation: '2dsphere' });
