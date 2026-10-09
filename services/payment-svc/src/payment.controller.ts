import { Controller, Post, Get, Put, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { PaymentStatus } from './payment.schema';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(dto);
  }

  @Get(':paymentId')
  async getPayment(@Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentById(paymentId);
  }

  @Get('user/:userId')
  async getPaymentsByUser(@Param('userId') userId: string) {
    return this.paymentService.getPaymentsByUserId(userId);
  }

  @Get('order/:orderId')
  async getPaymentsByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentsByOrderId(orderId);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async processCallback(@Body() dto: PaymentCallbackDto) {
    return this.paymentService.processCallback(dto);
  }

  @Post(':paymentId/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    await this.paymentService.verifyPaymentSignature(dto);
    const payment = await this.paymentService.getPaymentById(paymentId);
    return { verified: true, payment };
  }

  @Put(':paymentId/status')
  async updateStatus(
    @Param('paymentId') paymentId: string,
    @Body() dto: { status: PaymentStatus },
  ) {
    return this.paymentService.updatePaymentStatus(paymentId, dto.status);
  }

  @Put(':paymentId/cod/complete')
  async markCodCompleted(@Param('paymentId') paymentId: string) {
    return this.paymentService.markCodAsCompleted(paymentId);
  }

  @Post(':paymentId/refund')
  async refundPayment(@Param('paymentId') paymentId: string) {
    return this.paymentService.processRefund(paymentId);
  }
}
