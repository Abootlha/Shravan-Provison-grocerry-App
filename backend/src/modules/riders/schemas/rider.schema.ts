import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RiderDocument = Rider & Document;

export enum RiderStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export enum VehicleType {
  TWO_WHEELER = 'Two Wheeler',
  BICYCLE = 'Bicycle',
  ELECTRIC_BIKE = 'Electric Bike',
  THREE_WHEELER = 'Three Wheeler',
  FOUR_WHEELER = 'Four Wheeler',
}

@Schema({ timestamps: true, collection: 'riders' })
export class Rider {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  username!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true, unique: true })
  phone!: string;

  @Prop({ type: String, enum: VehicleType, default: VehicleType.TWO_WHEELER })
  vehicleType!: VehicleType;

  /** Registration plate, upper-cased (e.g. "UP53 AB 1234"). */
  @Prop({ trim: true })
  vehicleNumber?: string;

  @Prop({ type: String, enum: RiderStatus, default: RiderStatus.OFFLINE })
  status!: RiderStatus;

  @Prop({ default: false })
  isActive!: boolean;

  @Prop({ default: 0 })
  totalDeliveries!: number;

  @Prop({ default: 0 })
  rating!: number;

  @Prop({ default: 0 })
  totalRatings!: number;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  currentLocation!: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ type: Date })
  lastLocationUpdate?: Date;

  @Prop({ type: Date })
  lastActiveAt?: Date;
}

export const RiderSchema = SchemaFactory.createForClass(Rider);

RiderSchema.index({ currentLocation: '2dsphere' });
RiderSchema.index({ status: 1, isActive: 1 });

// Never serialise the password hash (documents returned from controllers).
RiderSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    delete ret.password;
    return ret;
  },
});
