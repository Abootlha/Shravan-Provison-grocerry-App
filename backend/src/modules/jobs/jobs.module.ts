import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsService } from './jobs.service';
import {
  StaleOrderProcessor,
  AnomalyCheckProcessor,
  EtaRecalculationProcessor,
} from './jobs.processors';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
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
    ),
    forwardRef(() => OrdersModule),
    forwardRef(() => RidersModule),
  ],
  providers: [
    JobsService,
    StaleOrderProcessor,
    AnomalyCheckProcessor,
    EtaRecalculationProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
