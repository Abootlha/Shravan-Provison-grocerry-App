import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { StoreSettings, StoreSettingsSchema } from './schemas/store-settings.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: StoreSettings.name, schema: StoreSettingsSchema },
        ]),
    ],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule { }
