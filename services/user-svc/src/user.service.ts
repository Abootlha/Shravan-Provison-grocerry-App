import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddressDto, UpdateAddressDto } from './dto/address.dto';
import { RedisService } from './redis.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private redisService: RedisService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userModel.findOne({ phone: createUserDto.phone });
    if (existingUser) {
      throw new ConflictException('User with this phone already exists');
    }

    const user = new this.userModel({
      ...createUserDto,
      role: createUserDto.role || 'customer',
    });

    const savedUser = await user.save();
    await this.redisService.setJson(`user:${savedUser._id}`, savedUser.toObject(), 3600);
    
    this.logger.log(`Created user: ${savedUser._id}`);
    return savedUser;
  }

  async findById(id: string): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }

    const cachedUser = await this.redisService.getJson<User>(`user:${id}`);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redisService.setJson(`user:${id}`, user.toObject(), 3600);
    return user;
  }

  async findByPhone(phone: string): Promise<User> {
    const user = await this.userModel.findOne({ phone });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateUserDto },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redisService.del(`user:${id}`);
    await this.redisService.setJson(`user:${id}`, user.toObject(), 3600);
    
    this.logger.log(`Updated user: ${id}`);
    return user;
  }

  async addAddress(userId: string, addressDto: AddressDto): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newAddress = {
      label: addressDto.label,
      street: addressDto.street,
      city: addressDto.city,
      postalCode: addressDto.postalCode,
      coordinates: {
        type: 'Point' as const,
        coordinates: [addressDto.longitude, addressDto.latitude],
      },
    };

    user.addresses.push(newAddress as any);
    await user.save();

    await this.redisService.del(`user:${userId}`);
    this.logger.log(`Added address to user: ${userId}`);
    return user;
  }

  async updateAddress(userId: string, addressIndex: number, addressDto: UpdateAddressDto): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (addressIndex < 0 || addressIndex >= user.addresses.length) {
      throw new NotFoundException('Address not found');
    }

    const address = user.addresses[addressIndex];
    if (addressDto.label) address.label = addressDto.label;
    if (addressDto.street) address.street = addressDto.street;
    if (addressDto.city) address.city = addressDto.city;
    if (addressDto.postalCode) address.postalCode = addressDto.postalCode;
    if (addressDto.longitude !== undefined && addressDto.latitude !== undefined) {
      address.coordinates = {
        type: 'Point',
        coordinates: [addressDto.longitude, addressDto.latitude],
      };
    }

    await user.save();
    await this.redisService.del(`user:${userId}`);
    
    this.logger.log(`Updated address ${addressIndex} for user: ${userId}`);
    return user;
  }

  async removeAddress(userId: string, addressIndex: number): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (addressIndex < 0 || addressIndex >= user.addresses.length) {
      throw new NotFoundException('Address not found');
    }

    user.addresses.splice(addressIndex, 1);
    await user.save();

    await this.redisService.del(`user:${userId}`);
    this.logger.log(`Removed address ${addressIndex} from user: ${userId}`);
    return user;
  }

  async setDefaultAddress(userId: string, addressIndex: number): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Invalid user ID');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (addressIndex < 0 || addressIndex >= user.addresses.length) {
      throw new NotFoundException('Address not found');
    }

    const [defaultAddress] = user.addresses.splice(addressIndex, 1);
    user.addresses.unshift(defaultAddress);
    await user.save();

    await this.redisService.del(`user:${userId}`);
    this.logger.log(`Set default address for user: ${userId}`);
    return user;
  }
}
