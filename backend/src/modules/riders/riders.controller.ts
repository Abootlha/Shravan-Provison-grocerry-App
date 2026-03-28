import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('riders')
@UseGuards(JwtAuthGuard)
export class RidersController {
    constructor(private readonly ridersService: RidersService) {}

    @Get()
    @UseGuards(AdminGuard)
    async getRiders(@Query('status') status?: string) {
        const riders = await this.ridersService.findAll(status);
        return { riders };
    }

    @Get('available')
    @UseGuards(AdminGuard)
    async getAvailableRiders() {
        const riders = await this.ridersService.findAvailableRiders();
        return { riders };
    }

    @Get(':id')
    @UseGuards(AdminGuard)
    async getRider(@Param('id') id: string) {
        const rider = await this.ridersService.findById(id);
        return { rider };
    }
}
