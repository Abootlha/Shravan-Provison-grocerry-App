import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
    CUSTOMER = 'customer',
    ADMIN = 'admin',
}

@Schema({ _id: false })
export class Address {
    @Prop({ required: true })
    type: string; // home, office, other

    @Prop({ required: true })
    address: string;

    @Prop({ required: true })
    city: string;

    @Prop({ required: true })
    pincode: string;

    @Prop({ default: false })
    isDefault: boolean;
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    name: string;

    @Prop({ unique: true, sparse: true })
    phone: string;

    @Prop()
    email: string;

    // Admin authentication fields
    @Prop({ unique: true, sparse: true })
    username: string;

    @Prop()
    password: string; // Hashed password for admin users

    @Prop({ type: String, enum: UserRole, default: UserRole.CUSTOMER })
    role: UserRole;

    @Prop({ type: [Address], default: [] })
    addresses: Address[];

    @Prop()
    refreshToken: string;

    @Prop({ default: true })
    isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });
