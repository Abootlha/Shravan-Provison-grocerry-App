import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id).exec();
    if (user && user.addresses && user.addresses.length > 1) {
      // Deduplicate existing duplicate addresses in DB automatically
      const uniqueAddresses: any[] = [];
      let modified = false;
      for (const addr of user.addresses) {
        const isDuplicate = uniqueAddresses.some(
          (u) =>
            (u.address || '').toLowerCase().trim() ===
              (addr.address || '').toLowerCase().trim() &&
            (u.city || '').toLowerCase().trim() ===
              (addr.city || '').toLowerCase().trim() &&
            u.type === addr.type,
        );
        if (!isDuplicate) {
          uniqueAddresses.push(addr);
        } else {
          modified = true;
        }
      }
      if (modified) {
        user.addresses = uniqueAddresses;
        await user.save();
      }
    }
    return user;
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
  ] as const;

  /** Copy only whitelisted address fields (never spread client input into a subdocument). */
  private applyAddressFields(
    target: Record<string, any>,
    input: UpdateAddressDto,
  ): void {
    for (const field of UsersService.ADDRESS_FIELDS) {
      if (input[field] !== undefined && input[field] !== null) {
        target[field] = input[field];
      }
    }
  }

  async addAddress(
    userId: string,
    input: CreateAddressDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

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
      const address: Record<string, any> = { isDefault: false };
      this.applyAddressFields(address, input);
      address.isDefault = makeDefault;
      user.addresses.push(address as any);
    }

    return user.save();
  }

  async updateAddress(
    userId: string,
    addressIndex: number,
    input: UpdateAddressDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (
      !Number.isInteger(addressIndex) ||
      addressIndex < 0 ||
      addressIndex >= user.addresses.length
    ) {
      throw new NotFoundException('Address index out of bounds');
    }

    if (input.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    this.applyAddressFields(user.addresses[addressIndex], input);

    return user.save();
  }

  async removeAddress(
    userId: string,
    addressIndex: number,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (addressIndex >= 0 && addressIndex < user.addresses.length) {
      user.addresses.splice(addressIndex, 1);
      if (
        user.addresses.length > 0 &&
        !user.addresses.some((a) => a.isDefault)
      ) {
        user.addresses[0].isDefault = true;
      }
    }
    return user.save();
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.ADMIN;
  }
}
