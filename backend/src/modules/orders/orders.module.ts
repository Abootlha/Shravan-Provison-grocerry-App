import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Order, OrderSchema } from './schemas/order.schema';
import {
  OrderStatusLog,
  OrderStatusLogSchema,
} from './schemas/order-status-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { OrdersService } from './orders.service';
import { OrdersController, AdminOrdersController } from './orders.controller';
import { ETAService } from './eta.service';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersGateway } from '../../sockets/orders.gateway';
import { TrackingModule } from '../../sockets/tracking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatusLog.name, schema: OrderStatusLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    BullModule.registerQueue({ name: 'orders' }),
    CartModule,
    ProductsModule,
    SettingsModule,
    forwardRef(() => TrackingModule),
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrdersGateway, ETAService],
  exports: [OrdersService, ETAService],
})
export class OrdersModule {}
