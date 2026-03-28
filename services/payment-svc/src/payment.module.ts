import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentGrpcController } from './payment.grpc.controller';
import { Payment, PaymentSchema } from './payment.schema';
import { RazorpayService } from './razorpay.service';
import { AmqpService } from './amqp.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentController, PaymentGrpcController],
  providers: [PaymentService, RazorpayService, AmqpService, RedisService],
  exports: [PaymentService],
})
export class PaymentModule {}
