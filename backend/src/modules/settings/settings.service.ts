import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  StoreSettings,
  StoreSettingsDocument,
} from './schemas/store-settings.schema';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(StoreSettings.name)
    private settingsModel: Model<StoreSettingsDocument>,
  ) {}

  async getStoreSettings(): Promise<StoreSettingsDocument> {
    let settings = await this.settingsModel.findOne({ storeId: 'main' }).exec();

    // Create default settings if not exists
    if (!settings) {
      settings = await this.settingsModel.create({
        storeId: 'main',
        storeName: 'Shravan Kirana Store',
        location: {
          // Default store location (update with actual coordinates)
          latitude: 28.6139,
          longitude: 77.209,
          address: 'New Delhi, India',
        },
        serviceRadiusKm: 4,
        isActive: true,
        estimatedDeliveryMinutes: 10,
      });
    }

    return settings;
  }

  async updateStoreSettings(
    updateData: UpdateStoreSettingsDto,
  ): Promise<StoreSettingsDocument> {
    // Only copy whitelisted fields (never storeId or arbitrary keys).
    const update: Partial<StoreSettings> = {};
    if (updateData.storeName !== undefined)
      update.storeName = updateData.storeName;
    if (updateData.location !== undefined) {
      update.location = {
        latitude: updateData.location.latitude,
        longitude: updateData.location.longitude,
        address: updateData.location.address,
      };
    }
    if (updateData.storeTimings !== undefined) {
      update.storeTimings = {
        openTime: updateData.storeTimings.openTime,
        closeTime: updateData.storeTimings.closeTime,
      };
    }
    if (updateData.contactPhone !== undefined)
      update.contactPhone = updateData.contactPhone;
    if (updateData.serviceRadiusKm !== undefined)
      update.serviceRadiusKm = updateData.serviceRadiusKm;
    if (updateData.estimatedDeliveryMinutes !== undefined)
      update.estimatedDeliveryMinutes = updateData.estimatedDeliveryMinutes;
    if (updateData.isActive !== undefined)
      update.isActive = updateData.isActive;

    const settings = await this.settingsModel
      .findOneAndUpdate(
        { storeId: 'main' },
        { $set: update },
        { new: true, upsert: true },
      )
      .exec();

    return settings;
  }

  async checkServiceability(
    latitude: number,
    longitude: number,
  ): Promise<{
    isServiceable: boolean;
    distanceKm: number;
    serviceRadiusKm: number;
    message: string;
  }> {
    const settings = await this.getStoreSettings();

    // Calculate distance using Haversine formula
    const distanceKm = this.calculateDistance(
      settings.location.latitude,
      settings.location.longitude,
      latitude,
      longitude,
    );

    const isServiceable = distanceKm <= settings.serviceRadiusKm;

    return {
      isServiceable,
      distanceKm: Math.round(distanceKm * 10) / 10, // Round to 1 decimal
      serviceRadiusKm: settings.serviceRadiusKm,
      message: isServiceable
        ? 'Great! We deliver to your location.'
        : `We are not serviceable at this location. Please select a location within ${settings.serviceRadiusKm}km.`,
    };
  }

  // Haversine formula to calculate distance between two coordinates
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
