import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AddressDocument = Address & Document;
export type UserDocument = User & Document;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], required: true })
  type: string;

  @Prop({ type: [Number], required: true })
  coordinates: number[];
}

export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: false })
export class Address {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ type: GeoPointSchema, required: true })
  coordinates: GeoPoint;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true, enum: ['customer', 'rider', 'admin'], index: true })
  role: string;

  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ 'addresses.coordinates': '2dsphere' });
