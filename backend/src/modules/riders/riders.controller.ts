import { Controller, Get, Param, Query, UseGuards, Request, Put, Body, ForbiddenException } from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserRole } from '../users/schemas/user.schema';

@Controller('riders')
@UseGuards(JwtAuthGuard)
export class RidersController {
    constructor(private readonly ridersService: RidersService) {}

    @Get('me')
    async getCurrentRider(@Request() req: any) {
        const rider = await this.ridersService.findRiderForUser(req.user.userId);
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

    @Get('me/metrics')
    async getMyMetrics(@Request() req: any) {
        if (req.user.role !== UserRole.RIDER) {
            throw new ForbiddenException('Only riders can access rider metrics');
        }

        const metrics = await this.ridersService.getMetrics(req.user.userId);
        return metrics;
    }

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
