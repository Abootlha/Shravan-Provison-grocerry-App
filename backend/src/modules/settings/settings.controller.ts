import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('store')
    async getStoreSettings() {
        const settings = await this.settingsService.getStoreSettings();
        return {
            storeName: settings.storeName,
            location: settings.location,
            serviceRadiusKm: settings.serviceRadiusKm,
            estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes,
            isActive: settings.isActive,
        };
    }

    @Get('check-serviceability')
    async checkServiceability(
        @Query('latitude') latitude: string,
        @Query('longitude') longitude: string,
    ) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lon)) {
            return {
                isServiceable: false,
                message: 'Invalid coordinates provided',
            };
        }

        return this.settingsService.checkServiceability(lat, lon);
    }

    @Post('store')
    @UseGuards(JwtAuthGuard)
    async updateStoreSettings(@Body() updateData: any) {
        // In production, add admin role check
        const settings = await this.settingsService.updateStoreSettings(updateData);
        return {
            message: 'Settings updated successfully',
            settings: {
                storeName: settings.storeName,
                location: settings.location,
                serviceRadiusKm: settings.serviceRadiusKm,
                estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes,
            },
        };
    }
}
