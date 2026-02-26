import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ItemGroupsService } from './item-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('item-groups')
export class ItemGroupsController {
    constructor(private readonly itemGroupsService: ItemGroupsService) { }

    // Get all item groups (with optional subcategory filter)
    @Get()
    async findAll(@Query('subcategoryId') subcategoryId?: string) {
        const itemGroups = await this.itemGroupsService.findAll(subcategoryId);
        return { itemGroups };
    }

    // Get single item group
    @Get(':id')
    async findOne(@Param('id') id: string) {
        const itemGroup = await this.itemGroupsService.findById(id);
        return { itemGroup };
    }

    // Create item group (admin only)
    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    async create(@Body() data: any) {
        const itemGroup = await this.itemGroupsService.create(data);
        return { itemGroup };
    }

    // Update item group (admin only)
    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async update(@Param('id') id: string, @Body() data: any) {
        const itemGroup = await this.itemGroupsService.update(id, data);
        return { itemGroup };
    }

    // Delete item group (admin only)
    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async delete(@Param('id') id: string) {
        await this.itemGroupsService.delete(id);
        return { message: 'Item Group deleted' };
    }
}
