import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AddressRef, UsersService, parseAddressRef } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

const toAddressRef = (raw: string): AddressRef => {
  const ref = parseAddressRef(raw);
  if (ref === null) {
    throw new BadRequestException('Invalid address id');
  }
  return ref;
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return { error: 'User not found' };

    return {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      profilePicture: user.profilePicture,
      role: user.role,
      addresses: user.addresses,
    };
  }

  @Put('me')
  async updateProfile(
    @Request() req: any,
    @Body() updateData: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(
      req.user.userId,
      updateData,
    );
    return {
      id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      profilePicture: user.profilePicture,
      role: user.role,
      addresses: user.addresses,
    };
  }

  @Post('addresses')
  async addAddress(@Request() req: any, @Body() address: CreateAddressDto) {
    const user = await this.usersService.addAddress(req.user.userId, address);
    return { addresses: user.addresses };
  }

  /**
   * `:ref` is the address `_id` (24-hex). A small integer is still accepted as
   * the array index used by older app builds.
   */
  @Put('addresses/:ref')
  async updateAddress(
    @Request() req: any,
    @Param('ref') ref: string,
    @Body() address: UpdateAddressDto,
  ) {
    const user = await this.usersService.updateAddress(
      req.user.userId,
      toAddressRef(ref),
      address,
    );
    return { addresses: user.addresses };
  }

  @Patch('addresses/:ref/default')
  async setDefaultAddress(@Request() req: any, @Param('ref') ref: string) {
    const user = await this.usersService.setDefaultAddress(
      req.user.userId,
      toAddressRef(ref),
    );
    return { addresses: user.addresses };
  }

  @Delete('addresses/:ref')
  async removeAddress(@Request() req: any, @Param('ref') ref: string) {
    const user = await this.usersService.removeAddress(
      req.user.userId,
      toAddressRef(ref),
    );
    return { addresses: user.addresses };
  }
}
