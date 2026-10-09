import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('store')
  async getStoreSettings() {
    const settings = await this.settingsService.getStoreSettings();
    return {
      storeName: settings.storeName,
      location: settings.location,
      storeTimings: settings.storeTimings,
      contactPhone: settings.contactPhone,
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

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      return {
        isServiceable: false,
        message: 'Invalid coordinates provided',
      };
    }

    return this.settingsService.checkServiceability(lat, lon);
  }

  @Post('store')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStoreSettings(@Body() updateData: UpdateStoreSettingsDto) {
    const settings = await this.settingsService.updateStoreSettings(updateData);
    return {
      message: 'Settings updated successfully',
      settings: {
        storeName: settings.storeName,
        location: settings.location,
        storeTimings: settings.storeTimings,
        contactPhone: settings.contactPhone,
        serviceRadiusKm: settings.serviceRadiusKm,
        estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes,
        isActive: settings.isActive,
      },
    };
  }
}
