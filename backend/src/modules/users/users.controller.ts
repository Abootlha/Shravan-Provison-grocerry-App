import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

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

  @Put('addresses/:index')
  async updateAddress(
    @Request() req: any,
    @Param('index', ParseIntPipe) index: number,
    @Body() address: UpdateAddressDto,
  ) {
    const user = await this.usersService.updateAddress(
      req.user.userId,
      index,
      address,
    );
    return { addresses: user.addresses };
  }

  @Delete('addresses/:index')
  async removeAddress(
    @Request() req: any,
    @Param('index', ParseIntPipe) index: number,
  ) {
    const user = await this.usersService.removeAddress(req.user.userId, index);
    return { addresses: user.addresses };
  }
}
