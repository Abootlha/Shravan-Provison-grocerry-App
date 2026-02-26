import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    async getProfile(@Request() req: any) {
        const user = await this.usersService.findById(req.user.userId);
        if (!user) return { error: 'User not found' };

        return {
            id: user._id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            addresses: user.addresses,
        };
    }

    @Post('addresses')
    async addAddress(@Request() req: any, @Body() address: any) {
        const user = await this.usersService.addAddress(req.user.userId, address);
        return { addresses: user.addresses };
    }

    @Delete('addresses/:index')
    async removeAddress(@Request() req: any, @Param('index') index: string) {
        const user = await this.usersService.removeAddress(req.user.userId, parseInt(index));
        return { addresses: user.addresses };
    }
}
