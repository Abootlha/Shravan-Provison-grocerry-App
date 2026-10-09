import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from './payment.schema';

@Controller()
export class PaymentGrpcController {
  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'CreatePayment')
  async createPayment(data: CreatePaymentDto) {
    return this.paymentService.createPayment(data);
  }

  @GrpcMethod('PaymentService', 'GetPayment')
  async getPayment(data: { paymentId: string }) {
    return this.paymentService.getPaymentById(data.paymentId);
  }

  @GrpcMethod('PaymentService', 'GetPaymentsByUser')
  async getPaymentsByUser(data: { userId: string }) {
    return { payments: await this.paymentService.getPaymentsByUserId(data.userId) };
  }

  @GrpcMethod('PaymentService', 'GetPaymentsByOrder')
  async getPaymentsByOrder(data: { orderId: string }) {
    return { payments: await this.paymentService.getPaymentsByOrderId(data.orderId) };
  }

  @GrpcMethod('PaymentService', 'UpdatePaymentStatus')
  async updatePaymentStatus(data: { paymentId: string; status: string }) {
    return this.paymentService.updatePaymentStatus(data.paymentId, data.status as PaymentStatus);
  }

  @GrpcMethod('PaymentService', 'MarkCodCompleted')
  async markCodCompleted(data: { paymentId: string }) {
    return this.paymentService.markCodAsCompleted(data.paymentId);
  }

  @GrpcMethod('PaymentService', 'ProcessRefund')
  async processRefund(data: { paymentId: string }) {
    return this.paymentService.processRefund(data.paymentId);
  }

  @GrpcMethod('PaymentService', 'VerifyPaymentSignature')
  async verifyPaymentSignature(data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const isValid = await this.paymentService.verifyPaymentSignature(data);
    return { verified: isValid };
  }
}
