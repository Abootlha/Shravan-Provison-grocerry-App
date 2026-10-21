import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsService } from './jobs.service';
import {
  StaleOrderProcessor,
  AnomalyCheckProcessor,
  EtaRecalculationProcessor,
  RiderPresenceProcessor,
} from './jobs.processors';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    BullModule.registerQueue(
      {
        name: 'stale-order-check',
      },
      {
        name: 'anomaly-check',
      },
      {
        name: 'eta-recalculation',
      },
      {
        name: 'rider-presence',
      },
    ),
    forwardRef(() => OrdersModule),
    forwardRef(() => RidersModule),
  ],
  providers: [
    JobsService,
    StaleOrderProcessor,
    AnomalyCheckProcessor,
    EtaRecalculationProcessor,
    RiderPresenceProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
