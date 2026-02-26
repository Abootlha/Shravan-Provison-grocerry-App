import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrderStatusLog, OrderStatusLogSchema } from './schemas/order-status-log.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { OrdersGateway } from '../../sockets/orders.gateway';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: OrderStatusLog.name, schema: OrderStatusLogSchema },
        ]),
        BullModule.registerQueue({ name: 'orders' }),
        CartModule,
        ProductsModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService, OrdersGateway],
    exports: [OrdersService],
})
export class OrdersModule { }
