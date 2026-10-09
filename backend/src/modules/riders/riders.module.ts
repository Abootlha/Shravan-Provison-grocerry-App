import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { Rider, RiderSchema } from './schemas/rider.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { RedisService } from '../../common/utils/redis.service';
import { OrdersModule } from '../orders/orders.module';
import { TrackingModule } from '../../sockets/tracking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rider.name, schema: RiderSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => TrackingModule),
  ],
  controllers: [RidersController],
  providers: [RidersService, RedisService],
  exports: [
    RidersService,
    MongooseModule.forFeature([{ name: Rider.name, schema: RiderSchema }]),
  ],
})
export class RidersModule {}
