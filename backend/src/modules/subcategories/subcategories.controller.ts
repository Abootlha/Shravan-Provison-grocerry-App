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
import { SubcategoriesService } from './subcategories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('subcategories')
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) {}

  @Get()
  async findAll(@Query('parentId') parentId?: string) {
    const subcategories = await this.subcategoriesService.findAll(parentId);
    return { subcategories };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const subcategory = await this.subcategoriesService.findById(id);
    return { subcategory };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() data: any) {
    const subcategory = await this.subcategoriesService.create(data);
    return { subcategory };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() data: any) {
    const subcategory = await this.subcategoriesService.update(id, data);
    return { subcategory };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async delete(@Param('id') id: string) {
    await this.subcategoriesService.delete(id);
    return { message: 'Subcategory deleted' };
  }
}
