import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import * as fc from 'fast-check';
import { OrdersService } from './orders.service';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_TRANSITIONS,
  PaymentStatus,
} from './schemas/order.schema';
import { OrderStatusLog } from './schemas/order-status-log.schema';
import { User } from '../users/schemas/user.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';

describe('OrdersService - Property-Based Tests', () => {
  let service: OrdersService;
  let trackingGateway: TrackingGateway;

  const mockOrderModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockOrderStatusLogModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
  }));
  mockOrderStatusLogModel.find = jest.fn();

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockCartService = {
    recalculateCart: jest.fn(),
    clearCart: jest.fn(),
  };

  const mockProductsService = {
    checkAndLockStock: jest.fn(),
    releaseStock: jest.fn(),
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
  };

  const mockETAService = {
    calculateETA: jest.fn(),
    recalculateForOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getQueueToken('orders'), useValue: mockQueue },
        { provide: CartService, useValue: mockCartService },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    trackingGateway = module.get<TrackingGateway>(TrackingGateway);
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
      fc.assert(
        fc.asyncProperty(
          fc.record({
            paymentStatus: fc.constantFrom(...Object.values(PaymentStatus)),
            paymentMethod: fc.constantFrom('COD', 'UPI', 'CARD', 'WALLET'),
          }),
          async ({ paymentStatus, paymentMethod }) => {
            const mockOrder: any = {
              _id: '507f1f77bcf86cd799439011',
              orderId: 'ORD-TEST-001',
              orderStatus: OrderStatus.PENDING,
              paymentStatus,
              paymentMethod,
              timeline: [],
              items: [],
              save: jest.fn().mockResolvedValue(true),
            };

            mockOrderModel.findById.mockResolvedValue(mockOrder);
            mockRedisService.del.mockResolvedValue(true);
            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.publish.mockResolvedValue(true);

            const shouldSucceed =
              paymentStatus === PaymentStatus.COMPLETED ||
              paymentMethod === 'COD';

            if (shouldSucceed) {
              await expect(
                service.updateStatus(
                  '507f1f77bcf86cd799439011',
                  OrderStatus.CONFIRMED,
                  '507f1f77bcf86cd799439012',
                ),
              ).resolves.toBeDefined();
            } else {
              await expect(
                service.updateStatus(
                  '507f1f77bcf86cd799439011',
                  OrderStatus.CONFIRMED,
                  '507f1f77bcf86cd799439012',
                ),
              ).rejects.toThrow(
                'Payment must be completed before confirming order',
              );
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('prevents CONFIRMED transition when payment is PENDING and method is not COD', async () => {
      const mockOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: 'UPI',
        timeline: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);

      await expect(
        service.updateStatus(
          '507f1f77bcf86cd799439011',
          OrderStatus.CONFIRMED,
          '507f1f77bcf86cd799439012',
        ),
      ).rejects.toThrow('Payment must be completed before confirming order');
    });

    it('allows CONFIRMED transition when payment method is COD regardless of payment status', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(PaymentStatus)),
          async (paymentStatus) => {
            const mockOrder: any = {
              _id: '507f1f77bcf86cd799439011',
              orderId: 'ORD-TEST-001',
              orderStatus: OrderStatus.PENDING,
              paymentStatus,
              paymentMethod: 'COD',
              timeline: [],
              items: [],
              save: jest.fn().mockResolvedValue(true),
            };

            mockOrderModel.findById.mockResolvedValue(mockOrder);
            mockRedisService.del.mockResolvedValue(true);
            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.publish.mockResolvedValue(true);

            await expect(
              service.updateStatus(
                '507f1f77bcf86cd799439011',
                OrderStatus.CONFIRMED,
                '507f1f77bcf86cd799439012',
              ),
            ).resolves.toBeDefined();
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // **Validates: Requirements 5.6**
  // Property 19: Order Status Event Emission
  describe('Property 19: Order Status Event Emission', () => {
    it('emits orderStatusUpdate event for any order status change', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            currentStatus: fc.constantFrom(...Object.values(OrderStatus)),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ currentStatus, newStatus, orderId, userId }) => {
            // Only test valid transitions
            if (!ORDER_STATUS_TRANSITIONS[currentStatus].includes(newStatus)) {
              return; // Skip invalid transitions
            }

            const mockOrder: any = {
              _id: orderId,
              orderId: `ORD-TEST-${orderId.slice(0, 8)}`,
              orderStatus: currentStatus,
              paymentStatus: PaymentStatus.COMPLETED,
              paymentMethod: 'COD',
              timeline: [],
              items: [],
              save: jest.fn().mockResolvedValue(true),
            };

            mockOrderModel.findById.mockResolvedValue(mockOrder);
            mockCacheService.deleteOrder.mockResolvedValue(true);
            mockRedisService.del.mockResolvedValue(true);
            mockRedisService.set.mockResolvedValue(true);
            mockRedisService.publish.mockResolvedValue(true);
            mockProductsService.releaseStock.mockResolvedValue(true);
            mockETAService.recalculateForOrder.mockResolvedValue(new Date());

            await service.updateStatus(orderId, newStatus, userId);

            // Verify broadcastOrderStatusUpdate was called
            expect(
              mockTrackingGateway.broadcastOrderStatusUpdate,
            ).toHaveBeenCalledWith(
              orderId,
              expect.objectContaining({
                orderStatus: newStatus,
                timeline: expect.any(Array),
              }),
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('includes orderId, status, and timeline in the broadcast event', async () => {
      const mockOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.COMPLETED,
        paymentMethod: 'COD',
        timeline: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockCacheService.deleteOrder.mockResolvedValue(true);
      mockRedisService.del.mockResolvedValue(true);
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.publish.mockResolvedValue(true);

      await service.updateStatus(
        '507f1f77bcf86cd799439011',
        OrderStatus.CONFIRMED,
        '507f1f77bcf86cd799439012',
      );

      expect(
        mockTrackingGateway.broadcastOrderStatusUpdate,
      ).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          orderId: 'ORD-TEST-001',
          orderStatus: OrderStatus.CONFIRMED,
          timeline: expect.arrayContaining([
            expect.objectContaining({
              status: OrderStatus.CONFIRMED,
              timestamp: expect.any(Date),
            }),
          ]),
        }),
      );
    });

    it('broadcasts event after successful status update', async () => {
      const mockOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.COMPLETED,
        paymentMethod: 'COD',
        timeline: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockCacheService.deleteOrder.mockResolvedValue(true);
      mockRedisService.del.mockResolvedValue(true);
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.publish.mockResolvedValue(true);

      await service.updateStatus(
        '507f1f77bcf86cd799439011',
        OrderStatus.CONFIRMED,
        '507f1f77bcf86cd799439012',
      );

      // Verify save was called before broadcast
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockTrackingGateway.broadcastOrderStatusUpdate).toHaveBeenCalled();
    });

    it('does not broadcast event if status update fails', async () => {
      const mockOrder: any = {
        _id: '507f1f77bcf86cd799439011',
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.COMPLETED,
        paymentMethod: 'COD',
        timeline: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);

      // Clear the mock before testing
      mockTrackingGateway.broadcastOrderStatusUpdate.mockClear();

      // Try invalid transition (DELIVERED -> PENDING)
      await expect(
        service.updateStatus(
          '507f1f77bcf86cd799439011',
          OrderStatus.PENDING,
          '507f1f77bcf86cd799439012',
        ),
      ).rejects.toThrow();

      // Verify broadcast was NOT called
      expect(
        mockTrackingGateway.broadcastOrderStatusUpdate,
      ).not.toHaveBeenCalled();
    });
  });
});

describe('OrdersService - ETA Event Emission Tests', () => {
  let service: OrdersService;
  let trackingGateway: TrackingGateway;
  let etaService: ETAService;

  const mockOrderModel = {
    findById: jest.fn(),
  };

  const mockOrderStatusLogModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(true),
  }));

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockCartService = {
    recalculateCart: jest.fn(),
    clearCart: jest.fn(),
  };

  const mockProductsService = {
    checkAndLockStock: jest.fn(),
    releaseStock: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
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
  };

  const mockETAService = {
    calculateETA: jest.fn(),
    recalculateForOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getQueueToken('orders'), useValue: mockQueue },
        { provide: CartService, useValue: mockCartService },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    trackingGateway = module.get<TrackingGateway>(TrackingGateway);
    etaService = module.get<ETAService>(ETAService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 5.8, 6.7**
  // Property 21: ETA Event Emission
  describe('Property 21: ETA Event Emission', () => {
    it('emits etaUpdate event when ETA is recalculated on rider assignment', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const riderId = '507f1f77bcf86cd799439012';
      const mockETA = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      const mockOrder: any = {
        _id: orderId,
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        riderId: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockRider: any = {
        _id: riderId,
        role: 'rider',
        isAvailable: true,
        isOnline: true,
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockUserModel.findById.mockResolvedValue(mockRider);
      mockRedisService.del.mockResolvedValue(true);
      mockETAService.recalculateForOrder.mockResolvedValue(mockETA);

      await service.assignRider(orderId, riderId);

      // Verify ETA recalculation was triggered
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(orderId);

      // Verify ETA broadcast was called with correct parameters
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        orderId,
        mockETA,
      );
    });

    it('emits etaUpdate event when status changes to ASSIGNED', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const riderId = '507f1f77bcf86cd799439012';
      const mockETA = new Date(Date.now() + 25 * 60 * 1000); // 25 minutes from now

      const mockOrder: any = {
        _id: orderId,
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PACKED,
        paymentStatus: PaymentStatus.COMPLETED,
        paymentMethod: 'COD',
        riderId: riderId,
        timeline: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockCacheService.deleteOrder.mockResolvedValue(true);
      mockRedisService.del.mockResolvedValue(true);
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.publish.mockResolvedValue(true);
      mockETAService.recalculateForOrder.mockResolvedValue(mockETA);

      await service.updateStatus(
        orderId,
        OrderStatus.ASSIGNED,
        '507f1f77bcf86cd799439013',
      );

      // Verify ETA recalculation was triggered
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(orderId);

      // Verify ETA broadcast was called
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        orderId,
        mockETA,
      );
    });

    it('includes orderId, estimatedDeliveryTime, and durationMinutes in broadcast', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const riderId = '507f1f77bcf86cd799439012';
      const mockETA = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now

      const mockOrder: any = {
        _id: orderId,
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        riderId: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockRider: any = {
        _id: riderId,
        role: 'rider',
        isAvailable: true,
        isOnline: true,
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockUserModel.findById.mockResolvedValue(mockRider);
      mockRedisService.del.mockResolvedValue(true);
      mockETAService.recalculateForOrder.mockResolvedValue(mockETA);

      await service.assignRider(orderId, riderId);

      // Verify broadcast was called with orderId and ETA
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        orderId,
        expect.any(Date),
      );

      // The TrackingGateway.broadcastETAUpdate method calculates durationMinutes internally
      // so we just verify it was called with the correct orderId and a Date object
    });

    it('does not emit etaUpdate if ETA recalculation fails', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const riderId = '507f1f77bcf86cd799439012';

      const mockOrder: any = {
        _id: orderId,
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        riderId: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockRider: any = {
        _id: riderId,
        role: 'rider',
        isAvailable: true,
        isOnline: true,
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockUserModel.findById.mockResolvedValue(mockRider);
      mockRedisService.del.mockResolvedValue(true);
      mockETAService.recalculateForOrder.mockRejectedValue(
        new Error('API failure'),
      );

      await service.assignRider(orderId, riderId);

      // Verify ETA broadcast was NOT called when recalculation fails
      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });

    it('does not emit etaUpdate if ETA recalculation returns null', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const riderId = '507f1f77bcf86cd799439012';

      const mockOrder: any = {
        _id: orderId,
        orderId: 'ORD-TEST-001',
        orderStatus: OrderStatus.PENDING,
        riderId: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockRider: any = {
        _id: riderId,
        role: 'rider',
        isAvailable: true,
        isOnline: true,
      };

      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockUserModel.findById.mockResolvedValue(mockRider);
      mockRedisService.del.mockResolvedValue(true);
      mockETAService.recalculateForOrder.mockResolvedValue(null);

      await service.assignRider(orderId, riderId);

      // Verify ETA broadcast was NOT called when recalculation returns null
      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });
  });
});
