import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';

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

  async addAddress(userId: string, address: any): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if matching address already exists (case & whitespace insensitive)
    const existingIndex = user.addresses.findIndex(
      (addr: any) =>
        (addr.address || '').toLowerCase().trim() ===
          (address.address || '').toLowerCase().trim() &&
        (addr.city || '').toLowerCase().trim() ===
          (address.city || '').toLowerCase().trim() &&
        addr.type === address.type,
    );

    if (existingIndex !== -1) {
      // Update existing address instead of pushing a duplicate
      user.addresses[existingIndex] = {
        ...user.addresses[existingIndex],
        ...address,
      };
    } else {
      if (address.isDefault || user.addresses.length === 0) {
        user.addresses.forEach((addr) => (addr.isDefault = false));
        address.isDefault = true;
      }
      user.addresses.push(address);
    }

    return user.save();
  }

  async updateAddress(
    userId: string,
    addressIndex: number,
    newAddress: any,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (addressIndex < 0 || addressIndex >= user.addresses.length) {
      throw new NotFoundException('Address index out of bounds');
    }

    if (newAddress.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex],
      ...newAddress,
    };

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
