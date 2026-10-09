import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Creating user with phone: ${createUserDto.phone}`);
    return this.userService.create(createUserDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    this.logger.log(`Finding user by ID: ${id}`);
    return this.userService.findById(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating user: ${id}`);
    return this.userService.update(id, updateUserDto);
  }

  @Post(':id/addresses')
  async addAddress(@Param('id') id: string, @Body() addressDto: AddressDto) {
    this.logger.log(`Adding address to user: ${id}`);
    return this.userService.addAddress(id, addressDto);
  }

  @Put(':id/addresses/:addressIndex')
  async updateAddress(
    @Param('id') id: string,
    @Param('addressIndex') addressIndex: string,
    @Body() addressDto: UpdateAddressDto,
  ) {
    this.logger.log(`Updating address ${addressIndex} for user: ${id}`);
    return this.userService.updateAddress(id, parseInt(addressIndex, 10), addressDto);
  }

  @Delete(':id/addresses/:addressIndex')
  async removeAddress(
    @Param('id') id: string,
    @Param('addressIndex') addressIndex: string,
  ) {
    this.logger.log(`Removing address ${addressIndex} from user: ${id}`);
    return this.userService.removeAddress(id, parseInt(addressIndex, 10));
  }

  @Put(':id/addresses/:addressIndex/default')
  async setDefaultAddress(
    @Param('id') id: string,
    @Param('addressIndex') addressIndex: string,
  ) {
    this.logger.log(`Setting default address ${addressIndex} for user: ${id}`);
    return this.userService.setDefaultAddress(id, parseInt(addressIndex, 10));
  }
}
