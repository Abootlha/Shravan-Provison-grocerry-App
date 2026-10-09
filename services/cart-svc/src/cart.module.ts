import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './cart.schema';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartGrpcController } from './cart.grpc.controller';
import { PriceCalculatorService } from './price-calculator.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Cart.name, schema: CartSchema },
        ]),
    ],
    controllers: [CartController, CartGrpcController],
    providers: [CartService, PriceCalculatorService],
    exports: [CartService, PriceCalculatorService],
})
export class CartModule {}
