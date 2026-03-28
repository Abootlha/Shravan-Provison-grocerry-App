import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: Razorpay;

  constructor(private configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay credentials not configured');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
  }): Promise<{ id: string; amount: number; currency: string; receipt: string }> {
    try {
      const order = await this.razorpay.orders.create(params);
      this.logger.log(`Razorpay order created: ${order.id}`);
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt || '',
      };
    } catch (error) {
      this.logger.error('Failed to create Razorpay order', error);
      throw new InternalServerErrorException('Failed to create payment order');
    }
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    
    if (!keySecret) {
      this.logger.warn('Razorpay key secret not configured');
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    return isValid;
  }

  async getPayment(paymentId: string): Promise<Record<string, unknown>> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error(`Failed to fetch Razorpay payment: ${paymentId}`, error);
      throw new InternalServerErrorException('Failed to fetch payment details');
    }
  }

  async refundPayment(paymentId: string): Promise<{ id: string; status: string }> {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        speed: 'optimum',
      });
      this.logger.log(`Refund initiated for payment: ${paymentId}, refund id: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(`Failed to refund payment: ${paymentId}`, error);
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.warn('Razorpay webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch {
      return false;
    }
  }
}
