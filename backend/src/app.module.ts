import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SubcategoriesModule } from './modules/subcategories/subcategories.module';
import { ProductsModule } from './modules/products/products.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ItemGroupsModule } from './modules/item-groups/item-groups.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MapsModule } from './modules/maps/maps.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RedisModule } from './common/utils/redis.module';
import { HttpThrottlerGuard } from './modules/auth/guards/http-throttler.guard';

// Config
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
      },
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('database.uri');
        const dbName = configService.get<string>('database.name');

        return {
          uri,
          ...(dbName ? { dbName } : {}),
        };
      },
      inject: [ConfigService],
    }),

    // Rate Limiting (default: 100 requests / minute / client IP).
    // Stricter per-route limits are set with @Throttle on auth and maps routes.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),

    // Feature Modules
    RedisModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SubcategoriesModule,
    ProductsModule,
    BrandsModule,
    CartModule,
    OrdersModule,
    AnalyticsModule,
    SettingsModule,
    ItemGroupsModule,
    JobsModule,
    MapsModule,
    PaymentsModule,
  ],
  providers: [
    // Apply rate limiting globally to all HTTP routes.
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
  ],
})
export class AppModule {}
