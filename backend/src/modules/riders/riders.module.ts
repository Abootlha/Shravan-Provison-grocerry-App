import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { AdminRidersController } from './admin-riders.controller';
import { AdminRidersService } from './admin-riders.service';
import { SessionRevokerService } from '../auth/session-revoker.service';
import { Rider, RiderSchema } from './schemas/rider.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  OrderStatusLog,
  OrderStatusLogSchema,
} from '../orders/schemas/order-status-log.schema';
import { RedisService } from '../../common/utils/redis.service';
import { OrdersModule } from '../orders/orders.module';
import { TrackingModule } from '../../sockets/tracking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rider.name, schema: RiderSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatusLog.name, schema: OrderStatusLogSchema },
    ]),
    forwardRef(() => OrdersModule),
    forwardRef(() => TrackingModule),
  ],
  controllers: [RidersController, AdminRidersController],
  providers: [
    RidersService,
    RedisService,
    AdminRidersService,
    SessionRevokerService,
  ],
  exports: [
    RidersService,
    MongooseModule.forFeature([{ name: Rider.name, schema: RiderSchema }]),
  ],
})
export class RidersModule {}
