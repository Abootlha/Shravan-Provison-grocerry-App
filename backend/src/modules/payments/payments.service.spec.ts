import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { User } from '../users/schemas/user.schema';
import { OrdersService } from '../orders/orders.service';
import {
  createFakeModel,
  buildOrderFixture,
} from '../orders/testing/fake-model';

const KEY = 'testKey';
const SALT = 'testSalt';

const sha512 = (value: string) =>
  crypto.createHash('sha512').update(value).digest('hex');

/** Builds a PayU-style callback payload with a correct reverse hash. */
function signedPayload(fields: Record<string, string>) {
  const p: Record<string, string> = {
    key: KEY,
    udf1: '',
    udf2: '',
    udf3: '',
    udf4: '',
    udf5: '',
    ...fields,
  };
  const seq = [
    SALT,
    p.status,
    '',
    '',
    '',
    '',
    '',
    p.udf5,
    p.udf4,
    p.udf3,
    p.udf2,
    p.udf1,
    p.email,
    p.firstname,
    p.productinfo,
    p.amount,
    p.txnid,
    KEY,
  ].join('|');
  p.hash = sha512(p.additionalCharges ? `${p.additionalCharges}|${seq}` : seq);
  return p;
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let orderModel: any;
  let config: Record<string, any>;
  const userId = new Types.ObjectId();

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockOrdersService = {
    markPaymentCompleted: jest.fn(),
    markPaymentFailed: jest.fn(),
  };

  const seedOnlineOrder = (overrides: Record<string, any> = {}) =>
    orderModel.insert(
      buildOrderFixture({
        userId,
        paymentMethod: PaymentMethod.UPI,
        totalAmount: 87,
        ...overrides,
      }),
    );

  const baseCallback = (order: any, extra: Record<string, string> = {}) =>
    signedPayload({
      txnid: order.orderId,
      amount: '87.00',
      productinfo: `Order ${order.orderId}`,
      firstname: 'Asha',
      email: 'asha@example.com',
      status: 'success',
      mihpayid: '403993715531077182',
      ...extra,
    });

  beforeEach(async () => {
    orderModel = createFakeModel({ hiddenFields: ['deliveryOtp'] });
    config = {
      'payu.key': KEY,
      'payu.salt': SALT,
      PUBLIC_API_URL: 'https://api.example.com/',
      PAYMENT_RETURN_URL: 'https://app.example.com/Checkout',
      PAYU_ENV: 'test',
    };
    mockUserModel.findById.mockReturnValue({
      select: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve({
              name: 'Asha',
              email: 'asha@example.com',
              phone: '+91 98765 43210',
            }),
        }),
      }),
    });
    mockOrdersService.markPaymentCompleted.mockResolvedValue({
      changed: true,
    });
    mockOrdersService.markPaymentFailed.mockResolvedValue({ changed: true });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => config[k]) },
        },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateSeamlessPayload', () => {
    it('builds the payload from server-side order and user data', async () => {
      const order = seedOnlineOrder();

      const payload = await service.generateSeamlessPayload(userId.toString(), {
        orderId: order.orderId,
        pg: 'UPI',
        bankcode: 'INTENT',
      });

      expect(payload).toMatchObject({
        key: KEY,
        txnid: order.orderId,
        amount: '87.00',
        productinfo: `Order ${order.orderId}`,
        firstname: 'Asha',
        email: 'asha@example.com',
        phone: '9876543210',
        surl: 'https://api.example.com/api/v1/payments/success',
        furl: 'https://api.example.com/api/v1/payments/failure',
        pg: 'UPI',
        bankcode: 'INTENT',
        environment: '1',
      });
      expect(payload.hash).toBe(
        sha512(
          `${KEY}|${order.orderId}|87.00|Order ${order.orderId}|Asha|asha@example.com|||||||||||${SALT}`,
        ),
      );
    });

    it('accepts the Mongo _id as orderId too', async () => {
      const order = seedOnlineOrder();
      const payload = await service.generateSeamlessPayload(userId.toString(), {
        orderId: order._id.toString(),
      });
      expect(payload.txnid).toBe(order.orderId);
    });

    it('uses fallbacks for missing name/email', async () => {
      config.PAYU_FALLBACK_EMAIL_DOMAIN = 'pay.example.org';
      mockUserModel.findById.mockReturnValue({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve({ phone: '9876543210' }),
          }),
        }),
      });
      const order = seedOnlineOrder();

      const payload = await service.generateSeamlessPayload(userId.toString(), {
        orderId: order.orderId,
      });

      expect(payload.firstname).toBe('Customer');
      expect(payload.email).toBe('9876543210@pay.example.org');
    });

    it('stores a separate PayU txnid when orderId exceeds 25 chars', async () => {
      const order = seedOnlineOrder({
        orderId: 'ORD-20260101-THIS-IS-A-VERY-LONG-ID',
      });

      const payload = await service.generateSeamlessPayload(userId.toString(), {
        orderId: order.orderId,
      });

      expect(payload.txnid.length).toBeLessThanOrEqual(25);
      expect(orderModel.get(order._id).payuTxnId).toBe(payload.txnid);
    });

    it('reports environment 0 for production PayU', async () => {
      config.PAYU_ENV = 'production';
      const order = seedOnlineOrder();
      const payload = await service.generateSeamlessPayload(userId.toString(), {
        orderId: order.orderId,
      });
      expect(payload.environment).toBe('0');
    });

    it('rejects orders of other users, COD, paid and cancelled orders', async () => {
      const other = seedOnlineOrder({ userId: new Types.ObjectId() });
      await expect(
        service.generateSeamlessPayload(userId.toString(), {
          orderId: other.orderId,
        }),
      ).rejects.toThrow(ForbiddenException);

      const cod = seedOnlineOrder({ paymentMethod: PaymentMethod.COD });
      await expect(
        service.generateSeamlessPayload(userId.toString(), {
          orderId: cod.orderId,
        }),
      ).rejects.toThrow(BadRequestException);

      const paid = seedOnlineOrder({ paymentStatus: PaymentStatus.COMPLETED });
      await expect(
        service.generateSeamlessPayload(userId.toString(), {
          orderId: paid.orderId,
        }),
      ).rejects.toThrow(BadRequestException);

      const cancelled = seedOnlineOrder({ orderStatus: OrderStatus.CANCELLED });
      await expect(
        service.generateSeamlessPayload(userId.toString(), {
          orderId: cancelled.orderId,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.generateSeamlessPayload(userId.toString(), {
          orderId: 'ORD-DOES-NOT-EXIST',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PayU callback verification', () => {
    it('accepts a valid success callback and completes payment', async () => {
      const order = seedOnlineOrder();

      const result = await service.handlePayuCallback(
        baseCallback(order),
        'webhook',
      );

      expect(result).toEqual({
        status: 'success',
        orderId: order.orderId,
        changed: true,
      });
      expect(mockOrdersService.markPaymentCompleted).toHaveBeenCalledWith(
        order._id.toString(),
        '403993715531077182',
      );
    });

    it('verifies hashes that include additionalCharges', async () => {
      const order = seedOnlineOrder();
      const result = await service.handlePayuCallback(
        baseCallback(order, { additionalCharges: '2.50' }),
        'success',
      );
      expect(result.status).toBe('success');
    });

    it('rejects an invalid hash without touching the order', async () => {
      const order = seedOnlineOrder();
      const forged = { ...baseCallback(order), hash: 'a'.repeat(128) };

      const result = await service.handlePayuCallback(forged, 'success');

      expect(result).toEqual({ status: 'invalid', reason: 'INVALID_HASH' });
      expect(mockOrdersService.markPaymentCompleted).not.toHaveBeenCalled();
      expect(mockOrdersService.markPaymentFailed).not.toHaveBeenCalled();
    });

    it('rejects a tampered field (status flipped to success)', async () => {
      const order = seedOnlineOrder();
      const failed = baseCallback(order, { status: 'failure' });
      const tampered = { ...failed, status: 'success' };

      const result = await service.handlePayuCallback(tampered, 'webhook');

      expect(result.status).toBe('invalid');
      expect(mockOrdersService.markPaymentCompleted).not.toHaveBeenCalled();
    });

    it('rejects a correctly signed callback whose amount does not match the order', async () => {
      const order = seedOnlineOrder();

      const result = await service.handlePayuCallback(
        baseCallback(order, { amount: '1.00' }),
        'webhook',
      );

      expect(result).toMatchObject({
        status: 'invalid',
        reason: 'AMOUNT_MISMATCH',
      });
      expect(mockOrdersService.markPaymentCompleted).not.toHaveBeenCalled();
    });

    it('is idempotent when PayU retries the same success', async () => {
      const order = seedOnlineOrder();
      mockOrdersService.markPaymentCompleted
        .mockResolvedValueOnce({ changed: true })
        .mockResolvedValueOnce({ changed: false });

      const first = await service.handlePayuCallback(
        baseCallback(order),
        'success',
      );
      const second = await service.handlePayuCallback(
        baseCallback(order),
        'webhook',
      );

      expect(first).toMatchObject({ status: 'success', changed: true });
      expect(second).toMatchObject({ status: 'success', changed: false });
    });

    it('marks payment failed (and cancels via orders service) on a valid failure', async () => {
      const order = seedOnlineOrder();

      const result = await service.handlePayuCallback(
        baseCallback(order, { status: 'failure' }),
        'failure',
      );

      expect(result.status).toBe('failed');
      expect(mockOrdersService.markPaymentFailed).toHaveBeenCalledWith(
        order._id.toString(),
        'PAYMENT_FAILED',
        '403993715531077182',
      );
    });

    it('reports failed when a late success arrives for a cancelled order', async () => {
      const order = seedOnlineOrder();
      mockOrdersService.markPaymentCompleted.mockResolvedValue({
        changed: false,
        requiresRefund: true,
      });

      const result = await service.handlePayuCallback(
        baseCallback(order),
        'success',
      );
      expect(result.status).toBe('failed');
    });

    it('finds orders by stored payuTxnId', async () => {
      const order = seedOnlineOrder({ payuTxnId: 'Tabc123' });
      const result = await service.handlePayuCallback(
        baseCallback(order, { txnid: 'Tabc123' }),
        'webhook',
      );
      expect(result.status).toBe('success');
    });
  });

  describe('PaymentsController', () => {
    let controller: PaymentsController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentsController],
        providers: [{ provide: PaymentsService, useValue: service }],
      }).compile();
      controller = module.get(PaymentsController);
    });

    const fakeRes = () => ({ redirect: jest.fn() });

    it('redirects success returns to PAYMENT_RETURN_URL with the order id', async () => {
      const order = seedOnlineOrder();
      const res = fakeRes();

      await controller.handleSuccess(baseCallback(order), res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        `https://app.example.com/Checkout?payment=success&orderId=${order.orderId}`,
      );
    });

    it('redirects with payment=failed when the hash is invalid', async () => {
      const order = seedOnlineOrder();
      const res = fakeRes();

      await controller.handleSuccess(
        { ...baseCallback(order), hash: 'bad' },
        res as any,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'https://app.example.com/Checkout?payment=failed',
      );
      expect(mockOrdersService.markPaymentCompleted).not.toHaveBeenCalled();
    });

    it('webhook rejects invalid hashes with 400', async () => {
      await expect(
        controller.handleWebhook({ txnid: 'x', hash: 'bad' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('webhook acknowledges valid notifications', async () => {
      const order = seedOnlineOrder();
      await expect(
        controller.handleWebhook(baseCallback(order)),
      ).resolves.toEqual({ success: true, data: { status: 'success' } });
    });
  });
});
