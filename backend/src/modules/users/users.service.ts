import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Address, User, UserDocument, UserRole } from './schemas/user.schema';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

/** Address id (24-hex ObjectId) or legacy array index. */
export type AddressRef = string | number;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const LEGACY_INDEX_PATTERN = /^\d{1,4}$/;

/**
 * Parses an address route parameter: a 24-hex id, or a small integer index
 * sent by older app builds. Returns null for anything else.
 */
export const parseAddressRef = (raw: string): AddressRef | null => {
  const value = String(raw ?? '').trim();
  if (OBJECT_ID_PATTERN.test(value)) return value.toLowerCase();
  if (LEGACY_INDEX_PATTERN.test(value)) return Number(value);
  return null;
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * Loads a user. Saved addresses written before addresses had ids are given a
   * stable `_id` here, once (see ensureAddressIds). Addresses are never
   * reordered or removed on read: clients that still address them by index
   * rely on the order staying put.
   */
  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id).exec();
    if (!user) return null;
    return this.ensureAddressIds(user);
  }

  /**
   * Lazy backfill for addresses stored without an `_id`: assigns new ObjectIds
   * and persists them with a single conditional update (it only applies while
   * the array still has the same length and those entries still lack an id, so
   * a concurrent change is never overwritten). If another request won the race,
   * the user is re-read so both see the same ids.
   */
  private async ensureAddressIds(user: UserDocument): Promise<UserDocument> {
    const addresses: Address[] = user.addresses || [];
    const missing = addresses
      .map((addr, index) => ({ addr, index }))
      .filter(({ addr }) => !addr?._id);
    if (missing.length === 0) return user;

    const filter: Record<string, unknown> = {
      _id: user._id,
      addresses: { $size: addresses.length },
    };
    const $set: Record<string, Types.ObjectId> = {};
    const ids = missing.map(({ index }) => {
      const id = new Types.ObjectId();
      filter[`addresses.${index}._id`] = { $exists: false };
      $set[`addresses.${index}._id`] = id;
      return id;
    });

    const result = await this.userModel.updateOne(filter, { $set }).exec();
    if (!result?.modifiedCount) {
      const fresh = await this.userModel.findById(user._id).exec();
      return fresh || user;
    }
    missing.forEach(({ addr }, i) => {
      addr._id = ids[i];
    });
    return user;
  }

  /** findById for address mutations: 404 when the user is gone, ids guaranteed. */
  private async loadUserForAddresses(userId: string): Promise<UserDocument> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Resolves an address reference to its position: a 24-hex ObjectId (current
   * clients) or a small non-negative integer (older app builds that address
   * saved addresses by array index).
   */
  private resolveAddressIndex(user: UserDocument, ref: AddressRef): number {
    if (typeof ref === 'number') {
      if (!Number.isInteger(ref) || ref < 0 || ref >= user.addresses.length) {
        throw new NotFoundException('Address index out of bounds');
      }
      return ref;
    }
    const index = user.addresses.findIndex(
      (addr) => !!addr._id && String(addr._id) === ref,
    );
    if (index === -1) throw new NotFoundException('Address not found');
    return index;
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async create(data: {
    name: string;
    phone?: string;
    username?: string;
    password?: string;
    email?: string;
    role?: UserRole;
  }): Promise<UserDocument> {
    const user = new this.userModel(data);
    return user.save();
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken }).exec();
  }

  async updateProfile(
    userId: string,
    updateData: { name?: string; email?: string; profilePicture?: string },
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (updateData.name !== undefined) user.name = updateData.name;
    if (updateData.email !== undefined) user.email = updateData.email;
    if (updateData.profilePicture !== undefined)
      user.profilePicture = updateData.profilePicture;

    return user.save();
  }

  private static readonly ADDRESS_FIELDS = [
    'type',
    'address',
    'city',
    'pincode',
    'isDefault',
    'latitude',
    'longitude',
    'houseNo',
    'floor',
    'landmark',
    'receiverName',
    'receiverPhone',
  ] as const;

  /** Optional details a client may clear by sending an empty string. */
  private static readonly CLEARABLE_FIELDS: ReadonlySet<string> = new Set([
    'houseNo',
    'floor',
    'landmark',
    'receiverName',
    'receiverPhone',
  ]);

  /** Copy only whitelisted address fields (never spread client input into a subdocument). */
  private applyAddressFields(
    target: Record<string, any>,
    input: UpdateAddressDto,
  ): void {
    for (const field of UsersService.ADDRESS_FIELDS) {
      let value: unknown = input[field];
      if (value === undefined || value === null) continue;
      if (typeof value === 'string') value = value.trim();
      if (value === '' && UsersService.CLEARABLE_FIELDS.has(field)) {
        target[field] = undefined;
        continue;
      }
      if (field === 'receiverPhone') {
        value = String(value).replace(/^\+91/, '');
      }
      target[field] = value;
    }
  }

  async addAddress(
    userId: string,
    input: CreateAddressDto,
  ): Promise<UserDocument> {
    const user = await this.loadUserForAddresses(userId);

    // Check if matching address already exists (case & whitespace insensitive)
    const existingIndex = user.addresses.findIndex(
      (addr: any) =>
        (addr.address || '').toLowerCase().trim() ===
          (input.address || '').toLowerCase().trim() &&
        (addr.city || '').toLowerCase().trim() ===
          (input.city || '').toLowerCase().trim() &&
        addr.type === input.type,
    );

    const makeDefault = !!input.isDefault || user.addresses.length === 0;
    if (makeDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    if (existingIndex !== -1) {
      // Update existing address instead of pushing a duplicate
      this.applyAddressFields(user.addresses[existingIndex], input);
      if (makeDefault) user.addresses[existingIndex].isDefault = true;
    } else {
      const address: Record<string, any> = {
        _id: new Types.ObjectId(),
        isDefault: false,
      };
      this.applyAddressFields(address, input);
      address.isDefault = makeDefault;
      user.addresses.push(address as any);
    }

    return user.save();
  }

  /** `ref`: address id, or legacy array index (older app builds). */
  async updateAddress(
    userId: string,
    ref: AddressRef,
    input: UpdateAddressDto,
  ): Promise<UserDocument> {
    const user = await this.loadUserForAddresses(userId);
    const index = this.resolveAddressIndex(user, ref);

    if (input.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    this.applyAddressFields(user.addresses[index], input);

    return user.save();
  }

  /** Makes one address the default (and clears the flag on the others). */
  async setDefaultAddress(
    userId: string,
    ref: AddressRef,
  ): Promise<UserDocument> {
    const user = await this.loadUserForAddresses(userId);
    const index = this.resolveAddressIndex(user, ref);
    user.addresses.forEach((addr, i) => (addr.isDefault = i === index));
    return user.save();
  }

  /**
   * Removes an address. An unknown id is a 404; an out-of-range legacy index
   * is ignored, as before. The first remaining address becomes the default
   * when the default one was removed.
   */
  async removeAddress(userId: string, ref: AddressRef): Promise<UserDocument> {
    const user = await this.loadUserForAddresses(userId);
    if (
      typeof ref === 'number' &&
      (!Number.isInteger(ref) || ref < 0 || ref >= user.addresses.length)
    ) {
      return user;
    }
    const index = this.resolveAddressIndex(user, ref);
    user.addresses.splice(index, 1);
    if (user.addresses.length > 0 && !user.addresses.some((a) => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }
    return user.save();
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.ADMIN;
  }
}
