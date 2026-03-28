import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument, PaymentStatus, PaymentMethod } from './payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { RazorpayService } from './razorpay.service';
import { AmqpService } from './amqp.service';
import { RedisService } from './redis.service';
import { PaymentResponse } from './interfaces/payment.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private razorpayService: RazorpayService,
    private amqpService: AmqpService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  private generatePaymentId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const uniquePart = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `PAY-${dateStr}-${uniquePart}`;
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    try {
      if (dto.method === PaymentMethod.COD) {
        return this.createCodPayment(dto);
      }
      return this.createOnlinePayment(dto);
    } catch (error) {
      this.logger.error('Failed to create payment', error);
      throw new InternalServerErrorException('Failed to create payment');
    }
  }

  private async createCodPayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    const payment = new this.paymentModel({
      paymentId: this.generatePaymentId(),
      orderId: new Types.ObjectId(dto.orderId),
      userId: new Types.ObjectId(dto.userId),
      amount: dto.amount,
      currency: dto.currency || 'INR',
      method: PaymentMethod.COD,
      status: PaymentStatus.PENDING,
      metadata: dto.metadata || {},
    });

    const savedPayment = await payment.save();
    this.logger.log(`COD payment created: ${savedPayment.paymentId}`);

    await this.cachePayment(savedPayment);

    return this.toResponse(savedPayment);
  }

  private async createOnlinePayment(dto: CreatePaymentDto): Promise<PaymentResponse> {
    const razorpayOrder = await this.razorpayService.createOrder({
      amount: Math.round(dto.amount * 100),
      currency: dto.currency || 'INR',
      receipt: dto.orderId,
    });

    const payment = new this.paymentModel({
      paymentId: this.generatePaymentId(),
      orderId: new Types.ObjectId(dto.orderId),
      userId: new Types.ObjectId(dto.userId),
      amount: dto.amount,
      currency: dto.currency || 'INR',
      method: dto.method,
      status: PaymentStatus.PENDING,
      razorpayOrderId: razorpayOrder.id,
      metadata: dto.metadata || {},
    });

    const savedPayment = await payment.save();
    this.logger.log(`Online payment created: ${savedPayment.paymentId}, Razorpay order: ${razorpayOrder.id}`);

    await this.cachePayment(savedPayment);

    const response = this.toResponse(savedPayment);
    response.razorpayOrderId = razorpayOrder.id;

    return response;
  }

  async verifyPaymentSignature(dto: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<boolean> {
    const isValid = this.razorpayService.verifySignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    return true;
  }

  async processCallback(dto: PaymentCallbackDto): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findOne({
      razorpayOrderId: dto.razorpayOrderId,
    });

    if (!payment) {
      throw new NotFoundException(`Payment with Razorpay order ${dto.razorpayOrderId} not found`);
    }

    if (dto.status === 'authorized') {
      if (!dto.razorpaySignature) {
        throw new BadRequestException('Razorpay signature is required');
      }
      const isValid = this.razorpayService.verifySignature(
        dto.razorpayOrderId,
        dto.razorpayPaymentId,
        dto.razorpaySignature,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid payment signature');
      }

      payment.razorpayPaymentId = dto.razorpayPaymentId;
      payment.razorpaySignature = dto.razorpaySignature;
      payment.status = PaymentStatus.COMPLETED;
      await payment.save();

      await this.redisService.invalidatePaymentCache(payment.paymentId);
      await this.amqpService.publishPaymentCompleted(this.toResponse(payment) as unknown as Record<string, unknown>);

      this.logger.log(`Payment completed: ${payment.paymentId}`);
    }

    return this.toResponse(payment);
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findOne({ paymentId });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const previousStatus = payment.status;
    payment.status = status;
    await payment.save();

    await this.redisService.invalidatePaymentCache(paymentId);

    if (status === PaymentStatus.COMPLETED) {
      await this.amqpService.publishPaymentCompleted(this.toResponse(payment) as unknown as Record<string, unknown>);
    } else if (status === PaymentStatus.FAILED) {
      await this.amqpService.publishPaymentFailed({
        paymentId,
        orderId: payment.orderId.toString(),
        reason: 'Payment failed',
      });
    }

    this.logger.log(`Payment ${paymentId} status updated from ${previousStatus} to ${status}`);

    return this.toResponse(payment);
  }

  async markCodAsCompleted(paymentId: string): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findOne({ paymentId });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.method !== PaymentMethod.COD) {
      throw new BadRequestException('Payment is not a COD payment');
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.transactionId = `COD-${this.generatePaymentId()}`;
    await payment.save();

    await this.redisService.invalidatePaymentCache(paymentId);
    await this.amqpService.publishPaymentCompleted(this.toResponse(payment) as unknown as Record<string, unknown>);

    this.logger.log(`COD payment marked as completed: ${paymentId}`);

    return this.toResponse(payment);
  }

  async getPaymentById(paymentId: string): Promise<PaymentResponse> {
    const cached = await this.redisService.get<PaymentResponse>(
      this.redisService.getPaymentCacheKey(paymentId),
    );
    if (cached) {
      this.logger.debug(`Cache hit for payment: ${paymentId}`);
      return cached;
    }

    const payment = await this.paymentModel
      .findOne({ paymentId })
      .populate('orderId', 'orderId totalAmount')
      .populate('userId', 'name email phone');

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    await this.cachePayment(payment);
    return this.toResponse(payment);
  }

  async getPaymentsByUserId(userId: string): Promise<PaymentResponse[]> {
    const payments = await this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });

    return payments.map((payment) => this.toResponse(payment));
  }

  async getPaymentsByOrderId(orderId: string): Promise<PaymentResponse[]> {
    const payments = await this.paymentModel
      .find({ orderId: new Types.ObjectId(orderId) })
      .sort({ createdAt: -1 });

    return payments.map((payment) => this.toResponse(payment));
  }

  async processRefund(paymentId: string): Promise<PaymentResponse> {
    const payment = await this.paymentModel.findOne({ paymentId });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    if (payment.razorpayPaymentId) {
      await this.razorpayService.refundPayment(payment.razorpayPaymentId);
    }

    payment.status = PaymentStatus.REFUNDED;
    await payment.save();

    await this.redisService.invalidatePaymentCache(paymentId);
    await this.amqpService.publishPaymentRefunded(this.toResponse(payment) as unknown as Record<string, unknown>);

    this.logger.log(`Payment refunded: ${paymentId}`);

    return this.toResponse(payment);
  }

  private async cachePayment(payment: PaymentDocument): Promise<void> {
    try {
      await this.redisService.set(
        this.redisService.getPaymentCacheKey(payment.paymentId),
        this.toResponse(payment),
      );
    } catch (error) {
      this.logger.warn(`Failed to cache payment ${payment.paymentId}`, error);
    }
  }

  private toResponse(payment: PaymentDocument): PaymentResponse {
    return {
      id: payment._id.toString(),
      paymentId: payment.paymentId,
      orderId: payment.orderId.toString(),
      userId: payment.userId.toString(),
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      transactionId: payment.transactionId,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpaySignature: payment.razorpaySignature,
      metadata: payment.metadata,
      createdAt: (payment as any).createdAt,
      updatedAt: (payment as any).updatedAt,
    };
  }
}
