import { Controller, Get, UseGuards } from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('riders')
@UseGuards(JwtAuthGuard)
export class RidersController {
    constructor(private readonly ridersService: RidersService) {}

    @Get('available')
    @UseGuards(AdminGuard)
    async getAvailableRiders() {
        const riders = await this.ridersService.findAvailableRiders();
        return { riders };
    }
}
