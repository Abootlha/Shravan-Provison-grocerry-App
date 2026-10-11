import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import {
  CreateBannerDto,
  ReorderBannersDto,
  UpdateBannerDto,
} from './dto/banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { MongoIdPipe } from '../../common/pipes/mongo-id.pipe';

/** Public: active banners inside their time window, by sortOrder. */
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  async findActive() {
    return { banners: await this.bannersService.findPublic() };
  }
}

/** Admin CRUD. Managers can view; only admins change banners. */
@Controller('admin/banners')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async findAll() {
    return { banners: await this.bannersService.adminFindAll() };
  }

  @Post()
  async create(@Body() body: CreateBannerDto) {
    return { banner: await this.bannersService.create(body) };
  }

  // Declared before :id routes so "reorder" is never read as an id.
  @Post('reorder')
  @HttpCode(200)
  async reorder(@Body() body: ReorderBannersDto) {
    return { banners: await this.bannersService.reorder(body.ids) };
  }

  @Patch(':id')
  async update(
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateBannerDto,
  ) {
    return { banner: await this.bannersService.update(id, body) };
  }

  @Delete(':id')
  async remove(@Param('id', MongoIdPipe) id: string) {
    await this.bannersService.remove(id);
    return { message: 'Banner deleted' };
  }
}
