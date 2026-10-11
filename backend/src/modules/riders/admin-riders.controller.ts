import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { MongoIdPipe } from '../../common/pipes/mongo-id.pipe';
import { AdminRidersService } from './admin-riders.service';
import {
  AdminRidersQueryDto,
  AdminUpdateRiderDto,
  RiderStatusDto,
} from './dto/admin-rider.dto';

/** Rider management for admins and managers. */
@Controller('admin/riders')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminRidersController {
  constructor(private readonly adminRiders: AdminRidersService) {}

  @Get()
  list(@Query() query: AdminRidersQueryDto) {
    return this.adminRiders.list(query);
  }

  @Get(':id')
  async get(@Param('id', MongoIdPipe) id: string) {
    return { rider: await this.adminRiders.get(id) };
  }

  @Get(':id/stats')
  stats(@Param('id', MongoIdPipe) id: string) {
    return this.adminRiders.stats(id);
  }

  @Patch(':id')
  async update(
    @Param('id', MongoIdPipe) id: string,
    @Body() body: AdminUpdateRiderDto,
  ) {
    return { rider: await this.adminRiders.update(id, body) };
  }

  @Patch(':id/status')
  async setStatus(
    @Param('id', MongoIdPipe) id: string,
    @Body() body: RiderStatusDto,
  ) {
    return { rider: await this.adminRiders.setActive(id, body.isActive) };
  }
}
