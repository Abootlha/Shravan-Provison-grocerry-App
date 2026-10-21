import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Put,
  Body,
  ForbiddenException,
  Post,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserRole } from '../users/schemas/user.schema';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  RiderLocationDto,
  RiderPushTokenDto,
  UpdateRiderProfileDto,
} from './dto/rider-self.dto';

import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

class CreateRiderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 15)
  phone!: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;
}

@Controller('riders')
@UseGuards(JwtAuthGuard)
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  private assertRider(req: any, message: string): void {
    if (req.user?.role !== UserRole.RIDER) {
      throw new ForbiddenException(message);
    }
  }

  @Post()
  @UseGuards(AdminGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createRider(@Body() dto: CreateRiderDto) {
    const rider = await this.ridersService.createRider(dto);
    return { rider, message: 'Rider created successfully' };
  }

  @Get('me')
  async getCurrentRider(@Request() req: any) {
    const rider = await this.ridersService.findRiderById(req.user.userId);
    return { rider };
  }

  /** Profile save from the rider app: name, vehicle type and number. */
  @Put('me')
  async updateMyProfile(
    @Request() req: any,
    @Body() body: UpdateRiderProfileDto,
  ) {
    this.assertRider(req, 'Only riders can update a rider profile');
    const rider = await this.ridersService.updateProfile(req.user.userId, body);
    return { rider };
  }

  @Put('me/availability')
  async updateMyAvailability(
    @Request() req: any,
    @Body() body: { isOnline?: boolean; isAvailable?: boolean },
  ) {
    if (req.user.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only riders can update rider availability');
    }

    const rider = await this.ridersService.updatePresence(req.user.userId, {
      isOnline: body.isOnline,
      isAvailable: body.isAvailable,
    });

    return { rider };
  }

  /** Registers this device for new-order push alerts (Expo push token). */
  @Put('me/push-token')
  @HttpCode(204)
  async registerPushToken(
    @Request() req: any,
    @Body() body: RiderPushTokenDto,
  ): Promise<void> {
    this.assertRider(req, 'Only riders can register for rider alerts');
    await this.ridersService.registerPushToken(req.user.userId, body.token);
  }

  /** Called on logout so this device stops receiving the rider's alerts. */
  @Delete('me/push-token')
  @HttpCode(204)
  async removePushToken(
    @Request() req: any,
    @Body() body: RiderPushTokenDto,
  ): Promise<void> {
    this.assertRider(req, 'Only riders can unregister rider alerts');
    await this.ridersService.removePushToken(req.user.userId, body.token);
  }

  /** Today / week / month deliveries and earnings; see RidersService.getMetrics. */
  @Get('me/metrics')
  async getMyMetrics(@Request() req: any) {
    this.assertRider(req, 'Only riders can access rider metrics');
    return this.ridersService.getMetrics(req.user.userId);
  }

  /**
   * REST fallback for the riderLocationUpdate socket event. Updates closer
   * than 2.5 s apart return { throttled: true } and are not stored.
   */
  @Put('me/location')
  async updateMyLocation(@Request() req: any, @Body() body: RiderLocationDto) {
    this.assertRider(req, 'Only riders can update rider location');
    return this.ridersService.updateLocation(req.user.userId, {
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? undefined,
      heading: knownNonNegative(body.heading),
      speed: knownNonNegative(body.speed),
    });
  }

  @Get()
  @UseGuards(AdminGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRiders(@Query('status') status?: string) {
    const riders = await this.ridersService.findAll(status);
    return { riders };
  }

  @Get('available')
  @UseGuards(AdminGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getAvailableRiders() {
    const riders = await this.ridersService.findAvailableRiders();
    return { riders };
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getRider(@Param('id') id: string) {
    const rider = await this.ridersService.findById(id);
    return { rider };
  }
}

/** iOS reports -1 for an unknown heading/speed. */
function knownNonNegative(value?: number | null): number | undefined {
  return value != null && value >= 0 ? value : undefined;
}
