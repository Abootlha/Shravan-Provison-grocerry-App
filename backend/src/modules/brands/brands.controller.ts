import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('brands')
export class BrandsController {
    constructor(private readonly brandsService: BrandsService) { }

    @Get()
    async findAll() {
        const brands = await this.brandsService.findAll();
        return { brands };
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        const brand = await this.brandsService.findById(id);
        return { brand };
    }

    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    async create(@Body() data: { name: string; logo?: string; website?: string }) {
        const brand = await this.brandsService.create(data);
        return { brand, message: 'Brand created successfully' };
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async update(@Param('id') id: string, @Body() data: Partial<{ name: string; logo: string; isActive: boolean }>) {
        const brand = await this.brandsService.update(id, data);
        return { brand, message: 'Brand updated successfully' };
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async delete(@Param('id') id: string) {
        await this.brandsService.delete(id);
        return { message: 'Brand deleted successfully' };
    }
}
