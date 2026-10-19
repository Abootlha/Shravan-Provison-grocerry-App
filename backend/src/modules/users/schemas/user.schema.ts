import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  /** Store staff: orders, riders, inventory; read-only catalogue. */
  MANAGER = 'manager',
  RIDER = 'rider',
}

/** Roles that may sign in to the admin panel. */
export const STAFF_ROLES: readonly string[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
];

export const isStaffRole = (role: unknown): boolean =>
  typeof role === 'string' && STAFF_ROLES.includes(role);

/**
 * A saved delivery address. `_id` is declared without a default on purpose:
 * addresses stored before ids existed must read back WITHOUT one (a default
 * would invent a new random id on every read), so UsersService can tell them
 * apart and persist a stable id once (see UsersService.ensureAddressIds).
 * New addresses get their id when they are created.
 */
@Schema({ _id: false })
export class Address {
  @Prop({ type: Types.ObjectId })
  _id?: Types.ObjectId;

  @Prop({ required: true })
  type!: string; // Home, Work, Other (older entries: Office, free text)

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

  /** House / flat number. */
  @Prop()
  houseNo?: string;

  @Prop()
  floor?: string;

  @Prop()
  landmark?: string;

  /** Who receives the order when it is not the account holder. */
  @Prop()
  receiverName?: string;

  @Prop()
  receiverPhone?: string;
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  profilePicture?: string;

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
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
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
UserSchema.index({ role: 1 });
// Admin customer list (role filter + newest first) and team list.
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ currentLocation: '2dsphere' });
UserSchema.index({ isOnline: 1, isAvailable: 1 });
