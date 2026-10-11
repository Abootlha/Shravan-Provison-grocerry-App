import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CategoryType } from './schemas/category.schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AdminCatalogListQueryDto } from '../../common/dto/admin-catalog-query.dto';

/** Admin list including deactivated categories (?includeInactive=true). */
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Query() query: AdminCatalogListQueryDto) {
    const categories = await this.categoriesService.adminFindAll({
      includeInactive: query.includeInactive,
      type: query.type,
    });
    return { categories };
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Get all categories (with optional type filter)
  @Get()
  async findAll(@Query('type') type?: CategoryType) {
    const categories = await this.categoriesService.findAll(type);
    return { categories };
  }

  // Get categories with nested subcategories
  @Get('nested')
  async findNested() {
    const categories = await this.categoriesService.findAllWithSubcategories();
    return { categories };
  }

  // Get subcategories for a parent category
  @Get(':id/subcategories')
  async findSubcategories(@Param('id') id: string) {
    const subcategories = await this.categoriesService.findSubcategories(id);
    return { subcategories };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findById(id);
    return { category };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() data: CreateCategoryDto) {
    const category = await this.categoriesService.create(data as any);
    return { category };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() data: UpdateCategoryDto) {
    const category = await this.categoriesService.update(id, data as any);
    return { category };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return { message: 'Category deleted' };
  }
}
