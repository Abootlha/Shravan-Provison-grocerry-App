import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackingGateway } from './tracking.gateway';
import { Order, OrderSchema } from '../modules/orders/schemas/order.schema';
import { OrdersModule } from '../modules/orders/orders.module';
import { RidersModule } from '../modules/riders/riders.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Must match the REST JwtStrategy secret so access tokens verify on both.
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: { expiresIn: '2h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => OrdersModule),
    forwardRef(() => RidersModule),
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}
