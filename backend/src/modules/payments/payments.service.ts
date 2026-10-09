import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OrdersService } from '../orders/orders.service';
import { SeamlessHashDto } from './dto/seamless-hash.dto';

// PayU limits txnid to 25 characters.
const PAYU_TXNID_MAX_LENGTH = 25;
const DEFAULT_FALLBACK_EMAIL_DOMAIN = 'customers.shravankirana.in';

export type PayuCallbackResult =
  | { status: 'success'; orderId: string; changed: boolean }
  | { status: 'failed'; orderId: string; changed: boolean }
  | { status: 'pending'; orderId: string }
  | { status: 'invalid'; reason: string; orderId?: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly ordersService: OrdersService,
  ) {
    if (this.isProduction() && !this.configService.get('PAYMENT_RETURN_URL')) {
      this.logger.error(
        'PAYMENT_RETURN_URL is not set; PayU success/failure redirects will fail in production',
      );
    }
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private get key(): string {
    return this.configService.get<string>('payu.key') || '';
  }

  private get salt(): string {
    return this.configService.get<string>('payu.salt') || '';
  }

  private requireCredentials(): { key: string; salt: string } {
    const key = this.key;
    const salt = this.salt;
    if (!key || !salt) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured',
      );
    }
    return { key, salt };
  }

  /** '0' = PayU production, '1' = PayU test. */
  getPayuEnvironment(): '0' | '1' {
    const raw = (this.configService.get<string>('PAYU_ENV') || '')
      .toString()
      .trim()
      .toLowerCase();
    if (!raw) {
      return this.isProduction() ? '0' : '1';
    }
    return ['0', 'prod', 'production', 'live'].includes(raw) ? '0' : '1';
  }

  private getPublicApiUrl(): string {
    const url = this.configService.get<string>('PUBLIC_API_URL');
    if (url) return url.replace(/\/+$/, '');
    if (this.isProduction()) {
      throw new ServiceUnavailableException('PUBLIC_API_URL is not configured');
    }
    const port = this.configService.get<number>('port') || 3000;
    return `http://localhost:${port}`;
  }

  getPaymentReturnUrl(): string {
    const url = this.configService.get<string>('PAYMENT_RETURN_URL');
    if (url) return url;
    if (this.isProduction()) {
      throw new ServiceUnavailableException(
        'PAYMENT_RETURN_URL is not configured',
      );
    }
    return 'http://localhost:8081/Checkout';
  }

  buildReturnRedirect(payment: 'success' | 'failed', orderId?: string): string {
    const base = this.getPaymentReturnUrl();
    const separator = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ payment });
    if (orderId) params.set('orderId', orderId);
    return `${base}${separator}${params.toString()}`;
  }

  /** PayU fields are pipe-delimited in the hash; strip anything that could break it. */
  private sanitize(value: string, maxLength = 100): string {
    return String(value ?? '')
      .replace(/[|\r\n]/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  sha512(input: string): string {
    return crypto.createHash('sha512').update(input).digest('hex');
  }

  /**
   * Request hash: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  computeRequestHash(params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    salt: string;
  }): string {
    const { key, txnid, amount, productinfo, firstname, email, salt } = params;
    return this.sha512(
      `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`,
    );
  }

  /**
   * Reverse (response) hash:
   * [additionalCharges|]salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
   */
  computeResponseHash(
    payload: Record<string, any>,
    key: string,
    salt: string,
  ): string {
    const f = (name: string) =>
      payload[name] === undefined || payload[name] === null
        ? ''
        : String(payload[name]);
    const sequence = [
      salt,
      f('status'),
      '',
      '',
      '',
      '',
      '',
      f('udf5'),
      f('udf4'),
      f('udf3'),
      f('udf2'),
      f('udf1'),
      f('email'),
      f('firstname'),
      f('productinfo'),
      f('amount'),
      f('txnid'),
      key,
    ].join('|');
    const additionalCharges = f('additionalCharges');
    return this.sha512(
      additionalCharges ? `${additionalCharges}|${sequence}` : sequence,
    );
  }

  verifyResponseHash(payload: Record<string, any>): boolean {
    const key = this.key;
    const salt = this.salt;
    if (!key || !salt || !payload || typeof payload.hash !== 'string') {
      return false;
    }
    if (payload.key !== undefined && String(payload.key) !== key) {
      return false;
    }

    const expected = Buffer.from(
      this.computeResponseHash(payload, key, salt),
      'utf8',
    );
    const received = Buffer.from(payload.hash.trim().toLowerCase(), 'utf8');
    if (expected.length !== received.length) {
      return false;
    }
    return crypto.timingSafeEqual(expected, received);
  }

  private async findOrderForUser(
    orderRef: string,
  ): Promise<OrderDocument | null> {
    if (Types.ObjectId.isValid(orderRef) && /^[a-f0-9]{24}$/i.test(orderRef)) {
      const byId = await this.orderModel.findById(orderRef).exec();
      if (byId) return byId;
    }
    return this.orderModel.findOne({ orderId: orderRef }).exec();
  }

  private async resolveTxnId(order: OrderDocument): Promise<string> {
    if (order.payuTxnId) return order.payuTxnId;
    if (order.orderId.length <= PAYU_TXNID_MAX_LENGTH) return order.orderId;

    const txnid = `T${crypto.randomBytes(12).toString('hex')}`.slice(
      0,
      PAYU_TXNID_MAX_LENGTH,
    );
    const updated = await this.orderModel
      .findOneAndUpdate(
        { _id: order._id, payuTxnId: { $exists: false } },
        { $set: { payuTxnId: txnid } },
        { new: true },
      )
      .exec();
    if (updated?.payuTxnId) return updated.payuTxnId;

    // Another request set it first.
    const current = await this.orderModel
      .findById(order._id)
      .select('payuTxnId')
      .lean()
      .exec();
    return current?.payuTxnId || txnid;
  }

  /**
   * Builds the PayU seamless payload entirely from server-side data. The
   * client only says which order it wants to pay for.
   */
  async generateSeamlessPayload(userId: string, dto: SeamlessHashDto) {
    const { key, salt } = this.requireCredentials();

    const order = await this.findOrderForUser(dto.orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId?.toString() !== userId) {
      throw new ForbiddenException('You can only pay for your own orders');
    }
    if (order.paymentMethod === PaymentMethod.COD) {
      throw new BadRequestException(
        'Cash on delivery orders are not paid online',
      );
    }
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order has been cancelled');
    }
    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment for this order is already ${order.paymentStatus}`,
      );
    }

    const user = await this.userModel
      .findById(userId)
      .select('name email phone')
      .lean()
      .exec();

    const phoneDigits = String(user?.phone || '')
      .replace(/\D/g, '')
      .slice(-10);
    const fallbackDomain =
      this.configService.get<string>('PAYU_FALLBACK_EMAIL_DOMAIN') ||
      DEFAULT_FALLBACK_EMAIL_DOMAIN;

    const txnid = await this.resolveTxnId(order);
    const amount = Number(order.totalAmount).toFixed(2);
    const productinfo = this.sanitize(`Order ${order.orderId}`);
    const firstname = this.sanitize(user?.name || '') || 'Customer';
    const email =
      this.sanitize(user?.email || '') ||
      `${phoneDigits || 'customer'}@${fallbackDomain}`;
    const phone = phoneDigits;

    const apiUrl = this.getPublicApiUrl();
    const surl = `${apiUrl}/api/v1/payments/success`;
    const furl = `${apiUrl}/api/v1/payments/failure`;

    const hash = this.computeRequestHash({
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      salt,
    });

    return {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash,
      pg: dto.pg,
      bankcode: dto.bankcode,
      environment: this.getPayuEnvironment(),
    };
  }

  /**
   * Handles a PayU callback (browser form post to surl/furl, or server-to-
   * server webhook). Only acts on payloads with a valid reverse hash and a
   * matching amount; all state changes are idempotent.
   */
  async handlePayuCallback(
    payload: Record<string, any>,
    source: 'success' | 'failure' | 'webhook',
  ): Promise<PayuCallbackResult> {
    const txnid = typeof payload?.txnid === 'string' ? payload.txnid : '';

    if (!this.verifyResponseHash(payload || {})) {
      this.logger.warn(
        `Rejected PayU ${source} callback with invalid hash (txnid=${txnid || 'n/a'})`,
      );
      return { status: 'invalid', reason: 'INVALID_HASH' };
    }

    const order = txnid
      ? await this.orderModel
          .findOne({ $or: [{ payuTxnId: txnid }, { orderId: txnid }] })
          .exec()
      : null;

    if (!order) {
      this.logger.warn(`PayU ${source} callback for unknown txnid ${txnid}`);
      return { status: 'invalid', reason: 'ORDER_NOT_FOUND' };
    }

    const paidAmount = Number(payload.amount);
    if (
      !Number.isFinite(paidAmount) ||
      paidAmount.toFixed(2) !== Number(order.totalAmount).toFixed(2)
    ) {
      this.logger.error(
        `PayU ${source} amount mismatch for ${order.orderId}: got ${payload.amount}, expected ${Number(order.totalAmount).toFixed(2)}`,
      );
      return {
        status: 'invalid',
        reason: 'AMOUNT_MISMATCH',
        orderId: order.orderId,
      };
    }

    const status = String(payload.status || '').toLowerCase();
    const mihpayid =
      payload.mihpayid !== undefined ? String(payload.mihpayid) : undefined;

    if (status === 'success') {
      const result = await this.ordersService.markPaymentCompleted(
        order._id.toString(),
        mihpayid,
      );
      this.logger.log(
        `PayU ${source}: payment success for ${order.orderId} (changed=${result.changed})`,
      );
      if (result.requiresRefund) {
        // Order was already cancelled; it is flagged for a refund.
        return { status: 'failed', orderId: order.orderId, changed: false };
      }
      return {
        status: 'success',
        orderId: order.orderId,
        changed: result.changed,
      };
    }

    if (status === 'pending') {
      return { status: 'pending', orderId: order.orderId };
    }

    const result = await this.ordersService.markPaymentFailed(
      order._id.toString(),
      'PAYMENT_FAILED',
      mihpayid,
    );
    this.logger.log(
      `PayU ${source}: payment ${status || 'failure'} for ${order.orderId} (changed=${result.changed})`,
    );
    return {
      status: 'failed',
      orderId: order.orderId,
      changed: result.changed,
    };
  }
}
