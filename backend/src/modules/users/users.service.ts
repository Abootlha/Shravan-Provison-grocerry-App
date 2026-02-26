import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async findById(id: string): Promise<UserDocument | null> {
        return this.userModel.findById(id).exec();
    }

    async findByPhone(phone: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ phone }).exec();
    }

    async findByUsername(username: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ username }).exec();
    }

    async create(data: { name: string; phone?: string; username?: string; password?: string; email?: string; role?: UserRole }): Promise<UserDocument> {
        const user = new this.userModel(data);
        return user.save();
    }

    async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { refreshToken }).exec();
    }

    async addAddress(userId: string, address: any): Promise<UserDocument> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        // If this is the first address or marked as default, set as default
        if (address.isDefault || user.addresses.length === 0) {
            user.addresses.forEach((addr) => (addr.isDefault = false));
            address.isDefault = true;
        }

        user.addresses.push(address);
        return user.save();
    }

    async removeAddress(userId: string, addressIndex: number): Promise<UserDocument> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        user.addresses.splice(addressIndex, 1);
        return user.save();
    }

    async isAdmin(userId: string): Promise<boolean> {
        const user = await this.findById(userId);
        return user?.role === UserRole.ADMIN;
    }
}
