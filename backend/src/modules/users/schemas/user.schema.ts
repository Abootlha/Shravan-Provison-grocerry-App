import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
    CUSTOMER = 'customer',
    ADMIN = 'admin',
    RIDER = 'rider',
}

@Schema({ _id: false })
export class Address {
    @Prop({ required: true })
    type!: string; // home, office, other

    @Prop({ required: true })
    address!: string;

    @Prop({ required: true })
    city!: string;

    @Prop({ required: true })
    pincode!: string;

    @Prop({ default: false })
    isDefault!: boolean;

    @Prop()
    latitude?: number;

    @Prop()
    longitude?: number;
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    name!: string;

    @Prop({ unique: true, sparse: true })
    phone?: string;

    @Prop()
    email?: string;

    // Admin authentication fields
    @Prop({ unique: true, sparse: true })
    username?: string;

    @Prop()
    password?: string; // Hashed password for admin users

    @Prop({ type: String, enum: UserRole, default: UserRole.CUSTOMER })
    role!: UserRole;

    @Prop({ type: [Address], default: [] })
    addresses!: Address[];

    @Prop()
    refreshToken?: string;

    @Prop({ default: true })
    isActive!: boolean;

    // Rider-specific fields
    @Prop({ default: false })
    isAvailable!: boolean;

    @Prop({ default: false })
    isOnline!: boolean;

    @Prop({
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    })
    currentLocation!: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };

    @Prop({ type: Date })
    lastLocationUpdate?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ currentLocation: '2dsphere' });
UserSchema.index({ isOnline: 1, isAvailable: 1 });
