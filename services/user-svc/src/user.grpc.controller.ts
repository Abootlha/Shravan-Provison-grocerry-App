import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddressDto, UpdateAddressDto } from './dto/address.dto';

interface IUserService {
  create(data: CreateUserDto): Promise<any>;
  findById(data: { id: string }): Promise<any>;
  findByPhone(data: { phone: string }): Promise<any>;
  update(data: { id: string; updateUserDto: UpdateUserDto }): Promise<any>;
  addAddress(data: { userId: string; addressDto: AddressDto }): Promise<any>;
  updateAddress(data: { userId: string; addressIndex: number; addressDto: UpdateAddressDto }): Promise<any>;
  removeAddress(data: { userId: string; addressIndex: number }): Promise<any>;
  setDefaultAddress(data: { userId: string; addressIndex: number }): Promise<any>;
}

@Controller()
export class UserGrpcController implements IUserService {
  private readonly logger = new Logger(UserGrpcController.name);

  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'Create')
  async create(data: CreateUserDto) {
    this.logger.log(`gRPC: Creating user with phone: ${data.phone}`);
    return this.userService.create(data);
  }

  @GrpcMethod('UserService', 'FindById')
  async findById(data: { id: string }) {
    this.logger.log(`gRPC: Finding user by ID: ${data.id}`);
    return this.userService.findById(data.id);
  }

  @GrpcMethod('UserService', 'FindByPhone')
  async findByPhone(data: { phone: string }) {
    this.logger.log(`gRPC: Finding user by phone: ${data.phone}`);
    return this.userService.findByPhone(data.phone);
  }

  @GrpcMethod('UserService', 'Update')
  async update(data: { id: string; updateUserDto: UpdateUserDto }) {
    this.logger.log(`gRPC: Updating user: ${data.id}`);
    return this.userService.update(data.id, data.updateUserDto);
  }

  @GrpcMethod('UserService', 'AddAddress')
  async addAddress(data: { userId: string; addressDto: AddressDto }) {
    this.logger.log(`gRPC: Adding address to user: ${data.userId}`);
    return this.userService.addAddress(data.userId, data.addressDto);
  }

  @GrpcMethod('UserService', 'UpdateAddress')
  async updateAddress(data: { userId: string; addressIndex: number; addressDto: UpdateAddressDto }) {
    this.logger.log(`gRPC: Updating address ${data.addressIndex} for user: ${data.userId}`);
    return this.userService.updateAddress(data.userId, data.addressIndex, data.addressDto);
  }

  @GrpcMethod('UserService', 'RemoveAddress')
  async removeAddress(data: { userId: string; addressIndex: number }) {
    this.logger.log(`gRPC: Removing address ${data.addressIndex} from user: ${data.userId}`);
    return this.userService.removeAddress(data.userId, data.addressIndex);
  }

  @GrpcMethod('UserService', 'SetDefaultAddress')
  async setDefaultAddress(data: { userId: string; addressIndex: number }) {
    this.logger.log(`gRPC: Setting default address ${data.addressIndex} for user: ${data.userId}`);
    return this.userService.setDefaultAddress(data.userId, data.addressIndex);
  }
}
