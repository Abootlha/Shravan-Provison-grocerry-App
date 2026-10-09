import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import * as fc from 'fast-check';
import { OrdersService, MAX_DELIVERY_OTP_ATTEMPTS } from './orders.service';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_TRANSITIONS,
  PaymentMethod,
  PaymentStatus,
} from './schemas/order.schema';
import { OrderStatusLog } from './schemas/order-status-log.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { Rider, RiderStatus } from '../riders/schemas/rider.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';
import {
  createFakeModel,
  buildOrderFixture,
  fakeStoreSettings,
} from './testing/fake-model';

const ADMIN_ID = new Types.ObjectId().toString();

describe('OrdersService - Property-Based Tests', () => {
  let service: OrdersService;
  let mockOrderModel: any;
  let mockRiderModel: any;

  const mockOrderStatusLogModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
  }));
  mockOrderStatusLogModel.find = jest.fn();

  const systemUserId = new Types.ObjectId();
  const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn().mockResolvedValue({ _id: systemUserId }),
    create: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockCartService = {
    recalculateCart: jest.fn(),
    clearCart: jest.fn(),
  };

  const mockProductsService = {
    findById: jest.fn(),
    checkAndLockStock: jest.fn(),
    releaseStock: jest.fn(),
  };

  const mockSettingsService = {
    getStoreSettings: jest.fn().mockResolvedValue(fakeStoreSettings),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  };

  const mockCacheService = {
    getOrder: jest.fn(),
    setOrder: jest.fn(),
    deleteOrder: jest.fn(),
  };

  const mockTrackingGateway = {
    broadcastOrderStatusUpdate: jest.fn(),
    broadcastRiderLocationUpdate: jest.fn(),
    broadcastETAUpdate: jest.fn(),
    notifyRiderOfAssignment: jest.fn(),
    notifyRiderOrderPacked: jest.fn(),
  };

  const mockETAService = {
    calculateETA: jest.fn(),
    recalculateForOrder: jest.fn(),
    buildTrackingRouteSnapshot: jest.fn(),
  };

  const seedOrder = (overrides: Record<string, any> = {}) =>
    mockOrderModel.insert(buildOrderFixture(overrides));

  const seedRider = (overrides: Record<string, any> = {}) =>
    mockRiderModel.insert({
      name: 'Rider',
      status: RiderStatus.AVAILABLE,
      isActive: true,
      totalDeliveries: 0,
      ...overrides,
    });

  beforeEach(async () => {
    mockOrderModel = createFakeModel({ hiddenFields: ['deliveryOtp'] });
    mockRiderModel = createFakeModel();
    mockSettingsService.getStoreSettings.mockResolvedValue(fakeStoreSettings);
    mockUserModel.findOne.mockResolvedValue({ _id: systemUserId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Rider.name), useValue: mockRiderModel },
        { provide: getQueueToken('orders'), useValue: mockQueue },
        { provide: CartService, useValue: mockCartService },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 1.3, 1.5, 9.3**
  // Property 2: Status Transition Validation
  describe('Property 2: Status Transition Validation', () => {
    it('validates all status transitions according to state machine', () => {
      fc.assert(
        fc.property(
          fc.record({
            currentStatus: fc.constantFrom(...Object.values(OrderStatus)),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          ({ currentStatus, newStatus }) => {
            const isValid = service.validateStatusTransition(
              currentStatus,
              newStatus,
            );
            const expectedValid =
              ORDER_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
            expect(isValid).toBe(expectedValid);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows transition to CANCELLED from any status except DELIVERED', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PACKED,
            OrderStatus.ASSIGNED,
            OrderStatus.OUT_FOR_DELIVERY,
          ),
          (currentStatus) => {
            const isValid = service.validateStatusTransition(
              currentStatus,
              OrderStatus.CANCELLED,
            );
            expect(isValid).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('prevents transition from DELIVERED to any other status', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ...Object.values(OrderStatus).filter(
              (s) => s !== OrderStatus.DELIVERED,
            ),
          ),
          (newStatus) => {
            const isValid = service.validateStatusTransition(
              OrderStatus.DELIVERED,
              newStatus,
            );
            expect(isValid).toBe(false);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('prevents transition from CANCELLED to any other status', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ...Object.values(OrderStatus).filter(
              (s) => s !== OrderStatus.CANCELLED,
            ),
          ),
          (newStatus) => {
            const isValid = service.validateStatusTransition(
              OrderStatus.CANCELLED,
              newStatus,
            );
            expect(isValid).toBe(false);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // **Validates: Requirements 1.2**
  // Property 1: Timeline Recording Invariant
  describe('Property 1: Timeline Recording Invariant', () => {
    it('adds timeline entry with status, timestamp, and changedBy for any status change', () => {
      fc.assert(
        fc.property(
          fc.record({
            status: fc.constantFrom(...Object.values(OrderStatus)),
            userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          ({ status, userId }) => {
            const mockOrder: any = {
              timeline: [],
            };

            service.addTimelineEntry(mockOrder, status, userId);

            expect(mockOrder.timeline.length).toBe(1);
            expect(mockOrder.timeline[0].status).toBe(status);
            expect(mockOrder.timeline[0].timestamp).toBeInstanceOf(Date);
            expect(mockOrder.timeline[0].changedBy.toString()).toBe(userId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('timeline grows monotonically with each status change', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom(...Object.values(OrderStatus)),
              userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
                s
                  .split('')
                  .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
                  .slice(0, 24),
              ),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          (changes) => {
            const mockOrder: any = {
              timeline: [],
            };

            changes.forEach(({ status, userId }) => {
              service.addTimelineEntry(mockOrder, status, userId);
            });

            expect(mockOrder.timeline.length).toBe(changes.length);

            // Verify each entry has required fields
            mockOrder.timeline.forEach((entry: any, index: number) => {
              expect(entry.status).toBe(changes[index].status);
              expect(entry.timestamp).toBeInstanceOf(Date);
              expect(entry.changedBy.toString()).toBe(changes[index].userId);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('timeline entries have monotonically increasing timestamps', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom(...Object.values(OrderStatus)),
              userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
                s
                  .split('')
                  .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
                  .slice(0, 24),
              ),
            }),
            { minLength: 2, maxLength: 10 },
          ),
          (changes) => {
            const mockOrder: any = {
              timeline: [],
            };

            changes.forEach(({ status, userId }) => {
              service.addTimelineEntry(mockOrder, status, userId);
            });

            // Verify timestamps are in order (or equal due to fast execution)
            for (let i = 1; i < mockOrder.timeline.length; i++) {
              expect(
                mockOrder.timeline[i].timestamp.getTime(),
              ).toBeGreaterThanOrEqual(
                mockOrder.timeline[i - 1].timestamp.getTime(),
              );
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // **Validates: Requirements 1.7**
  // Property 5: Cancellation Availability
  describe('Property 5: Cancellation Availability', () => {
    it('allows transition to CANCELLED from any status except DELIVERED', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PACKED,
            OrderStatus.ASSIGNED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.CANCELLED,
          ),
          (currentStatus) => {
            const canCancel = service.validateStatusTransition(
              currentStatus,
              OrderStatus.CANCELLED,
            );

            if (currentStatus === OrderStatus.CANCELLED) {
              // Already cancelled, cannot transition to cancelled again
              expect(canCancel).toBe(false);
            } else {
              // All other statuses can transition to cancelled
              expect(canCancel).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('prevents transition to CANCELLED from DELIVERED status', () => {
      const canCancel = service.validateStatusTransition(
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      );
      expect(canCancel).toBe(false);
    });

    it('CANCELLED is in allowed transitions for all non-terminal statuses', () => {
      const nonTerminalStatuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PACKED,
        OrderStatus.ASSIGNED,
        OrderStatus.OUT_FOR_DELIVERY,
      ];

      nonTerminalStatuses.forEach((status) => {
        const allowedTransitions = ORDER_STATUS_TRANSITIONS[status];
        expect(allowedTransitions).toContain(OrderStatus.CANCELLED);
      });
    });
  });

  // **Validates: Requirements 9.2**
  // Property 29: Payment Verification for Confirmation
  describe('Property 29: Payment Verification for Confirmation', () => {
    it('allows CONFIRMED transition only when payment is COMPLETED or method is COD', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            paymentStatus: fc.constantFrom(...Object.values(PaymentStatus)),
            paymentMethod: fc.constantFrom(...Object.values(PaymentMethod)),
          }),
          async ({ paymentStatus, paymentMethod }) => {
            const order = seedOrder({ paymentStatus, paymentMethod });

            const shouldSucceed =
              paymentStatus === PaymentStatus.COMPLETED ||
              paymentMethod === PaymentMethod.COD;

            const attempt = service.updateStatus(
              order._id.toString(),
              OrderStatus.CONFIRMED,
              ADMIN_ID,
              { actorRole: UserRole.ADMIN },
            );

            if (shouldSucceed) {
              await expect(attempt).resolves.toBeDefined();
              expect(mockOrderModel.get(order._id).orderStatus).toBe(
                OrderStatus.CONFIRMED,
              );
            } else {
              await expect(attempt).rejects.toThrow(
                'Online payment has not been completed for this order',
              );
              expect(mockOrderModel.get(order._id).orderStatus).toBe(
                OrderStatus.PENDING,
              );
            }
            // Confirming never fabricates a payment
            expect(mockOrderModel.get(order._id).paymentStatus).toBe(
              paymentStatus,
            );
          },
        ),
        { numRuns: 40 },
      );
    });

    it('does not let an unpaid online order be assigned to a rider', async () => {
      const order = seedOrder({
        paymentMethod: PaymentMethod.UPI,
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.CONFIRMED,
      });
      const rider = seedRider();

      await expect(
        service.assignRider(order._id.toString(), rider._id.toString()),
      ).rejects.toThrow('Online payment has not been completed');
      expect(mockRiderModel.get(rider._id).status).toBe(RiderStatus.AVAILABLE);
      await expect(
        service.autoAssignNearestRider(order._id.toString()),
      ).resolves.toBeNull();
    });
  });

  // **Validates: Requirements 5.6**
  // Property 19: Order Status Event Emission
  describe('Property 19: Order Status Event Emission', () => {
    it('emits orderStatusUpdate event (without the delivery OTP) for any valid status change', async () => {
      const validPairs = Object.values(OrderStatus).flatMap((from) =>
        ORDER_STATUS_TRANSITIONS[from].map((to) => ({ from, to })),
      );

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...validPairs),
          async ({ from, to }) => {
            mockTrackingGateway.broadcastOrderStatusUpdate.mockClear();
            const rider = seedRider({ status: RiderStatus.BUSY });
            const order = seedOrder({
              orderStatus: from,
              riderId: from === OrderStatus.PENDING ? undefined : rider._id,
            });

            await service.updateStatus(order._id.toString(), to, ADMIN_ID, {
              actorRole: UserRole.ADMIN,
              deliveryOtp: '4321',
            });

            expect(
              mockTrackingGateway.broadcastOrderStatusUpdate,
            ).toHaveBeenCalledWith(
              order._id.toString(),
              expect.objectContaining({
                orderStatus: to,
                timeline: expect.any(Array),
              }),
            );
            const payload =
              mockTrackingGateway.broadcastOrderStatusUpdate.mock.calls[0][1];
            expect(payload).not.toHaveProperty('deliveryOtp');
          },
        ),
        { numRuns: 40 },
      );
    });

    it('does not broadcast event if the transition is invalid', async () => {
      const order = seedOrder({ orderStatus: OrderStatus.DELIVERED });

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.PENDING,
          ADMIN_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockTrackingGateway.broadcastOrderStatusUpdate,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Atomic status transitions and stock release', () => {
    it('rejects a transition when the status changed concurrently (atomic filter)', async () => {
      const order = seedOrder({ orderStatus: OrderStatus.PENDING });
      // Simulate another request winning between our read and our write.
      const originalFindById = mockOrderModel.findById;
      mockOrderModel.findById = jest.fn((id: any) => {
        const q = originalFindById(id);
        const exec = q.exec;
        q.exec = async () => {
          const result = await exec();
          mockOrderModel.get(order._id).orderStatus = OrderStatus.CANCELLED;
          return result;
        };
        return q;
      });

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.CONFIRMED,
          ADMIN_ID,
          { actorRole: UserRole.ADMIN },
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockOrderModel.get(order._id).orderStatus).toBe(
        OrderStatus.CANCELLED,
      );
    });

    it('double-cancel (concurrent) releases stock exactly once', async () => {
      const order = seedOrder({ orderStatus: OrderStatus.CONFIRMED });

      const results = await Promise.allSettled([
        service.cancelOrder(order._id.toString(), ADMIN_ID, 'first'),
        service.cancelOrder(order._id.toString(), ADMIN_ID, 'second'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(mockProductsService.releaseStock).toHaveBeenCalledTimes(1);
      expect(mockProductsService.releaseStock).toHaveBeenCalledWith([
        {
          productId: order.items[0].productId.toString(),
          quantity: order.items[0].quantity,
        },
      ]);
      expect(mockOrderModel.get(order._id).stockReleased).toBe(true);
    });

    it('double-cancel (sequential) does not release stock twice', async () => {
      const order = seedOrder({ orderStatus: OrderStatus.PENDING });

      await service.cancelOrder(order._id.toString(), ADMIN_ID, 'first');
      await expect(
        service.cancelOrder(order._id.toString(), ADMIN_ID, 'again'),
      ).rejects.toThrow(BadRequestException);

      expect(mockProductsService.releaseStock).toHaveBeenCalledTimes(1);
    });

    it('releaseOrderStock is idempotent per order', async () => {
      const order = seedOrder();

      await expect(service.releaseOrderStock(order)).resolves.toBe(true);
      await expect(service.releaseOrderStock(order)).resolves.toBe(false);
      expect(mockProductsService.releaseStock).toHaveBeenCalledTimes(1);
    });

    it('riders cannot cancel after pickup; admin cancel keeps stock and flags manual review', async () => {
      const rider = seedRider({ status: RiderStatus.BUSY });
      const order = seedOrder({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        riderId: rider._id,
      });

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.CANCELLED,
          rider._id.toString(),
          { actorRole: UserRole.RIDER },
        ),
      ).rejects.toThrow(ForbiddenException);

      await service.updateStatus(
        order._id.toString(),
        OrderStatus.CANCELLED,
        ADMIN_ID,
        { actorRole: UserRole.ADMIN, reason: 'customer unreachable' },
      );

      const stored = mockOrderModel.get(order._id);
      expect(stored.orderStatus).toBe(OrderStatus.CANCELLED);
      expect(stored.requiresManualReview).toBe(true);
      expect(stored.cancellationReason).toBe('customer unreachable');
      expect(mockProductsService.releaseStock).not.toHaveBeenCalled();
      expect(mockRiderModel.get(rider._id).status).toBe(RiderStatus.AVAILABLE);
    });
  });

  describe('Delivery OTP', () => {
    const setupOutForDelivery = (overrides: Record<string, any> = {}) => {
      const rider = seedRider({ status: RiderStatus.BUSY });
      const order = seedOrder({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        riderId: rider._id,
        ...overrides,
      });
      return { rider, order };
    };

    it('requires the delivery OTP to mark an order DELIVERED', async () => {
      const { rider, order } = setupOutForDelivery();

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.DELIVERED,
          rider._id.toString(),
          { actorRole: UserRole.RIDER },
        ),
      ).rejects.toThrow('deliveryOtp is required');

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.DELIVERED,
          rider._id.toString(),
          { actorRole: UserRole.RIDER, deliveryOtp: '0000' },
        ),
      ).rejects.toThrow('Invalid delivery OTP');

      expect(mockOrderModel.get(order._id).orderStatus).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
      expect(mockOrderModel.get(order._id).deliveryOtpAttempts).toBe(1);
    });

    it('delivers with the correct OTP, settles COD payment and frees the rider', async () => {
      const { rider, order } = setupOutForDelivery();

      await service.updateStatus(
        order._id.toString(),
        OrderStatus.DELIVERED,
        rider._id.toString(),
        { actorRole: UserRole.RIDER, deliveryOtp: '4321' },
      );

      const stored = mockOrderModel.get(order._id);
      expect(stored.orderStatus).toBe(OrderStatus.DELIVERED);
      expect(stored.paymentStatus).toBe(PaymentStatus.COMPLETED);
      expect(stored.actualDeliveryTime).toBeInstanceOf(Date);
      const storedRider = mockRiderModel.get(rider._id);
      expect(storedRider.status).toBe(RiderStatus.AVAILABLE);
      expect(storedRider.totalDeliveries).toBe(1);
    });

    it(`locks out after ${MAX_DELIVERY_OTP_ATTEMPTS} attempts even with the right OTP`, async () => {
      const { rider, order } = setupOutForDelivery();

      for (let i = 0; i < MAX_DELIVERY_OTP_ATTEMPTS; i += 1) {
        await expect(
          service.updateStatus(
            order._id.toString(),
            OrderStatus.DELIVERED,
            rider._id.toString(),
            { actorRole: UserRole.RIDER, deliveryOtp: '9999' },
          ),
        ).rejects.toThrow(BadRequestException);
      }

      await expect(
        service.updateStatus(
          order._id.toString(),
          OrderStatus.DELIVERED,
          rider._id.toString(),
          { actorRole: UserRole.RIDER, deliveryOtp: '4321' },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockOrderModel.get(order._id).orderStatus).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
    });

    it('only includes the OTP in payloads when explicitly requested (owner)', async () => {
      const order = seedOrder();

      const forOthers = await service.buildRealtimeOrderPayload(
        order._id.toString(),
      );
      expect(forOthers).not.toHaveProperty('deliveryOtp');

      const forOwner = await service.buildRealtimeOrderPayload(
        order._id.toString(),
        { includeDeliveryOtp: true },
      );
      expect(forOwner.deliveryOtp).toBe('4321');
    });
  });

  describe('createOrder', () => {
    const userId = new Types.ObjectId().toString();
    const productId = new Types.ObjectId();
    const baseData = {
      deliveryAddress: {
        type: 'home',
        address: '1 Test St',
        city: 'City',
        pincode: '273001',
        latitude: 26.7,
        longitude: 83.3,
      },
      items: [{ productId: productId.toString(), quantity: 2 }],
    };

    beforeEach(() => {
      mockProductsService.findById.mockResolvedValue({
        _id: productId,
        name: 'Milk',
        price: 30,
        stock: 10,
        isAvailable: true,
      });
      mockProductsService.checkAndLockStock.mockResolvedValue(true);
    });

    it('always starts payment as PENDING, including online methods', async () => {
      for (const paymentMethod of Object.values(PaymentMethod)) {
        const order = await service.createOrder(userId, {
          ...baseData,
          paymentMethod,
          // A malicious client value must be ignored even if it slips through
          paymentStatus: PaymentStatus.COMPLETED,
        } as any);
        expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
      }
    });

    it('releases reserved stock when saving the order fails', async () => {
      mockOrderModel.mockImplementationOnce((data: any) => ({
        ...data,
        save: jest.fn().mockRejectedValue(new Error('db down')),
      }));

      await expect(
        service.createOrder(userId, {
          ...baseData,
          paymentMethod: PaymentMethod.COD,
        }),
      ).rejects.toThrow('db down');

      expect(mockProductsService.releaseStock).toHaveBeenCalledWith([
        { productId: productId.toString(), quantity: 2 },
      ]);
    });

    it('rejects the order when stock cannot be locked', async () => {
      mockProductsService.checkAndLockStock.mockResolvedValue(false);
      await expect(
        service.createOrder(userId, {
          ...baseData,
          paymentMethod: PaymentMethod.COD,
        }),
      ).rejects.toThrow('Some items are out of stock');
    });
  });

  describe('Payment status updates', () => {
    it('markPaymentCompleted is idempotent and broadcasts once', async () => {
      const order = seedOrder({ paymentMethod: PaymentMethod.UPI });

      await expect(
        service.markPaymentCompleted(order._id.toString(), 'MIH-1'),
      ).resolves.toEqual({ changed: true });
      await expect(
        service.markPaymentCompleted(order._id.toString(), 'MIH-1'),
      ).resolves.toEqual({ changed: false });

      const stored = mockOrderModel.get(order._id);
      expect(stored.paymentStatus).toBe(PaymentStatus.COMPLETED);
      expect(stored.mihpayid).toBe('MIH-1');
      expect(
        mockTrackingGateway.broadcastOrderStatusUpdate,
      ).toHaveBeenCalledTimes(1);
    });

    it('flags a refund when a payment succeeds for an already-cancelled order', async () => {
      const order = seedOrder({
        paymentMethod: PaymentMethod.UPI,
        paymentStatus: PaymentStatus.FAILED,
        orderStatus: OrderStatus.CANCELLED,
      });

      await expect(
        service.markPaymentCompleted(order._id.toString(), 'MIH-2'),
      ).resolves.toEqual({ changed: false, requiresRefund: true });
      const stored = mockOrderModel.get(order._id);
      expect(stored.orderStatus).toBe(OrderStatus.CANCELLED);
      expect(stored.requiresManualReview).toBe(true);
    });

    it('markPaymentFailed cancels the order and releases stock once', async () => {
      const order = seedOrder({ paymentMethod: PaymentMethod.CARD });

      await service.markPaymentFailed(order._id.toString(), 'PAYMENT_FAILED');
      await service.markPaymentFailed(order._id.toString(), 'PAYMENT_FAILED');

      const stored = mockOrderModel.get(order._id);
      expect(stored.paymentStatus).toBe(PaymentStatus.FAILED);
      expect(stored.orderStatus).toBe(OrderStatus.CANCELLED);
      expect(stored.cancellationReason).toBe('PAYMENT_FAILED');
      expect(mockProductsService.releaseStock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rider assignment', () => {
    it('confirming with no available rider keeps the order CONFIRMED and reports pending assignment', async () => {
      const order = seedOrder();

      const result: any = await service.updateStatus(
        order._id.toString(),
        OrderStatus.CONFIRMED,
        ADMIN_ID,
        { actorRole: UserRole.ADMIN },
      );

      expect(result.riderAssignmentPending).toBe(true);
      expect(mockOrderModel.get(order._id).orderStatus).toBe(
        OrderStatus.CONFIRMED,
      );
    });

    it('confirming with an available rider assigns and claims that rider', async () => {
      const order = seedOrder();
      const rider = seedRider();

      await service.updateStatus(
        order._id.toString(),
        OrderStatus.CONFIRMED,
        ADMIN_ID,
        { actorRole: UserRole.ADMIN },
      );

      expect(mockOrderModel.get(order._id).riderId.toString()).toBe(
        rider._id.toString(),
      );
      expect(mockRiderModel.get(rider._id).status).toBe(RiderStatus.BUSY);
    });

    it('never gives the same rider two orders under concurrent assignment', async () => {
      const rider = seedRider();
      const orderA = seedOrder({ orderStatus: OrderStatus.CONFIRMED });
      const orderB = seedOrder({ orderStatus: OrderStatus.CONFIRMED });

      const results = await Promise.allSettled([
        service.assignRider(orderA._id.toString(), rider._id.toString()),
        service.assignRider(orderB._id.toString(), rider._id.toString()),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as any;
      expect(rejected.reason.message).toBe('Rider is not available');
      const assigned = [orderA, orderB].filter(
        (o) => mockOrderModel.get(o._id).riderId,
      );
      expect(assigned).toHaveLength(1);
    });
  });
});

describe('OrdersService - ETA Event Emission Tests', () => {
  let service: OrdersService;
  let mockOrderModel: any;
  let mockRiderModel: any;

  const mockOrderStatusLogModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
  }));

  const mockTrackingGateway = {
    broadcastOrderStatusUpdate: jest.fn(),
    broadcastRiderLocationUpdate: jest.fn(),
    broadcastETAUpdate: jest.fn(),
    notifyRiderOfAssignment: jest.fn(),
  };

  const mockETAService = {
    calculateETA: jest.fn(),
    recalculateForOrder: jest.fn(),
    buildTrackingRouteSnapshot: jest.fn(),
  };

  beforeEach(async () => {
    mockOrderModel = createFakeModel({ hiddenFields: ['deliveryOtp'] });
    mockRiderModel = createFakeModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: { findById: jest.fn() },
        },
        { provide: getModelToken(Rider.name), useValue: mockRiderModel },
        { provide: getQueueToken('orders'), useValue: { add: jest.fn() } },
        {
          provide: CartService,
          useValue: { recalculateCart: jest.fn(), clearCart: jest.fn() },
        },
        {
          provide: ProductsService,
          useValue: { checkAndLockStock: jest.fn(), releaseStock: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: {
            getStoreSettings: jest.fn().mockResolvedValue(fakeStoreSettings),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            publish: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrder: jest.fn(),
            setOrder: jest.fn(),
            deleteOrder: jest.fn(),
          },
        },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const seedAssignable = () => {
    const order = mockOrderModel.insert(
      buildOrderFixture({ orderStatus: OrderStatus.CONFIRMED }),
    );
    const rider = mockRiderModel.insert({
      name: 'Rider',
      status: RiderStatus.AVAILABLE,
      isActive: true,
    });
    return { orderId: order._id.toString(), riderId: rider._id.toString() };
  };

  // **Validates: Requirements 5.8, 6.7**
  // Property 21: ETA Event Emission
  describe('Property 21: ETA Event Emission', () => {
    it('emits etaUpdate event when ETA is recalculated on rider assignment', async () => {
      const { orderId, riderId } = seedAssignable();
      const mockETA = new Date(Date.now() + 30 * 60 * 1000);
      mockETAService.recalculateForOrder.mockResolvedValue(mockETA);

      await service.assignRider(orderId, riderId);

      expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(orderId);
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        orderId,
        mockETA,
        expect.anything(),
      );
      expect(mockTrackingGateway.notifyRiderOfAssignment).toHaveBeenCalledWith(
        riderId,
        expect.not.objectContaining({ deliveryOtp: expect.anything() }),
      );
    });

    it('does not emit etaUpdate if ETA recalculation fails', async () => {
      const { orderId, riderId } = seedAssignable();
      mockETAService.recalculateForOrder.mockRejectedValue(
        new Error('API failure'),
      );

      await service.assignRider(orderId, riderId);

      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });

    it('does not emit etaUpdate if ETA recalculation returns null', async () => {
      const { orderId, riderId } = seedAssignable();
      mockETAService.recalculateForOrder.mockResolvedValue(null);

      await service.assignRider(orderId, riderId);

      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });
  });
});
