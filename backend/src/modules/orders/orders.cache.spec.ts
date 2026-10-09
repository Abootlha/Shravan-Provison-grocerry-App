import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import * as fc from 'fast-check';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { OrderStatusLog } from './schemas/order-status-log.schema';
import { User } from '../users/schemas/user.schema';
import { Rider } from '../riders/schemas/rider.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';
import { Types } from 'mongoose';
import { createFakeModel, fakeStoreSettings } from './testing/fake-model';

describe('OrdersService - Cache Property-Based Tests', () => {
  let service: OrdersService;
  let cacheService: CacheService;
  let mockOrderModel: any;

  // Generator for valid MongoDB ObjectId strings (24 hex characters)
  const objectIdArb = fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
    s
      .split('')
      .map((c) => '0123456789abcdef'[c.charCodeAt(0) % 16])
      .join(''),
  );

  beforeEach(async () => {
    mockOrderModel = createFakeModel({ hiddenFields: ['deliveryOtp'] });

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

    const mockTrackingGateway = {
      notifyRiderOrderPacked: jest.fn(),
      broadcastOrderStatusUpdate: jest.fn(),
      broadcastETAUpdate: jest.fn(),
      broadcastRiderLocationUpdate: jest.fn(),
    };

    const mockETAService = {
      calculateETA: jest.fn(),
      recalculateForOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        CacheService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Rider.name), useValue: createFakeModel() },
        {
          provide: SettingsService,
          useValue: {
            getStoreSettings: jest.fn().mockResolvedValue(fakeStoreSettings),
          },
        },
        { provide: getQueueToken('orders'), useValue: mockQueue },
        { provide: CartService, useValue: mockCartService },
        { provide: ProductsService, useValue: mockProductsService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 10.5**
  // Property 32: Redis Cache for Active Orders
  describe('Property 32: Redis Cache for Active Orders', () => {
    it('returns cached order without querying MongoDB when cache hit occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
            totalAmount: fc.integer({ min: 100, max: 100000 }),
          }),
          async ({ orderId, userId, orderStatus, totalAmount }) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus,
              totalAmount,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Set up cache to return the order
            jest.spyOn(cacheService, 'getOrder').mockResolvedValue(mockOrder);

            // Call findById
            const result = await service.findById(orderId);

            // Verify cache was checked
            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
            expect(cacheService.getOrder).toHaveBeenCalledWith(orderId);

            // Verify MongoDB was NOT queried (cache hit)
            expect(mockOrderModel.findById).not.toHaveBeenCalled();

            // Verify result matches cached order
            expect(result).toEqual(mockOrder);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('falls back to MongoDB and caches result when cache miss occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
            totalAmount: fc.integer({ min: 100, max: 100000 }),
          }),
          async ({ orderId, userId, orderStatus, totalAmount }) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus,
              totalAmount,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Set up cache miss
            jest.spyOn(cacheService, 'getOrder').mockResolvedValue(null);
            jest.spyOn(cacheService, 'setOrder').mockResolvedValue(undefined);

            // Seed the database with the order
            mockOrderModel.insert(mockOrder);

            // Call findById
            const result = await service.findById(orderId);

            // Verify cache was checked first
            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
            expect(cacheService.getOrder).toHaveBeenCalledWith(orderId);

            // Verify MongoDB was queried (cache miss)
            expect(mockOrderModel.findById).toHaveBeenCalledWith(orderId);

            // Verify result was cached
            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
            expect(cacheService.setOrder).toHaveBeenCalledWith(
              orderId,
              mockOrder,
            );

            // Verify result matches database order
            expect(result).toEqual(mockOrder);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // **Validates: Requirements 10.6**
  // Property 33: Cache Invalidation on Status Change
  describe('Property 33: Cache Invalidation on Status Change', () => {
    it('invalidates cache when order status is updated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            currentStatus: fc.constantFrom(
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PACKED,
              OrderStatus.ASSIGNED,
              OrderStatus.OUT_FOR_DELIVERY,
            ),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          async ({ orderId, userId, currentStatus, newStatus }) => {
            // Skip invalid transitions
            if (!service.validateStatusTransition(currentStatus, newStatus)) {
              return true;
            }

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus: currentStatus,
              totalAmount: 1000,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              paymentMethod: 'COD',
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              orderId: 'ORD-' + orderId.substring(0, 8),
              createdAt: new Date(),
              updatedAt: new Date(),
              save: jest.fn().mockResolvedValue(true),
            };

            // Mock the order model to return the order
            mockOrderModel.insert({
              ...mockOrder,
              save: undefined,
              deliveryOtp: '4321',
            });

            // Spy on cache invalidation
            jest
              .spyOn(cacheService, 'deleteOrder')
              .mockResolvedValue(undefined);

            // Call updateStatus
            try {
              await service.updateStatus(orderId, newStatus, userId, {
                actorRole: 'admin',
                deliveryOtp: '4321',
              });

              // Verify cache was invalidated
              // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
              expect(cacheService.deleteOrder).toHaveBeenCalledWith(orderId);
            } catch (error) {
              // Some transitions may fail due to business logic (e.g., payment verification)
              // That's okay - we're testing cache invalidation when update succeeds
              if (
                error instanceof Error &&
                error.message.includes('payment has not been completed')
              ) {
                return true;
              }
              throw error;
            }

            return true;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('ensures subsequent queries fetch fresh data after status update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            initialStatus: fc.constantFrom(
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
            ),
            newStatus: fc.constantFrom(
              OrderStatus.CONFIRMED,
              OrderStatus.PACKED,
            ),
          }),
          async ({ orderId, userId, initialStatus, newStatus }) => {
            // Skip invalid transitions
            if (!service.validateStatusTransition(initialStatus, newStatus)) {
              return true;
            }

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus: initialStatus,
              totalAmount: 1000,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              paymentMethod: 'COD',
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              orderId: 'ORD-' + orderId.substring(0, 8),
              createdAt: new Date(),
              updatedAt: new Date(),
              save: jest.fn().mockResolvedValue(true),
            };

            const updatedOrder = { ...mockOrder, orderStatus: newStatus };

            // Mock the order model
            mockOrderModel.insert({
              ...mockOrder,
              save: undefined,
              deliveryOtp: '4321',
            });

            // Set up cache behavior
            let cacheDeleted = false;
            jest.spyOn(cacheService, 'deleteOrder').mockImplementation(() => {
              cacheDeleted = true;
              return Promise.resolve();
            });
            jest.spyOn(cacheService, 'getOrder').mockImplementation(() => {
              // Return null after cache is deleted
              return Promise.resolve(cacheDeleted ? null : mockOrder);
            });
            jest.spyOn(cacheService, 'setOrder').mockResolvedValue(undefined);

            // Update status (which should invalidate cache)
            try {
              await service.updateStatus(orderId, newStatus, userId, {
                actorRole: 'admin',
                deliveryOtp: '4321',
              });
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('payment has not been completed')
              ) {
                return true;
              }
              throw error;
            }

            // Verify cache was deleted
            expect(cacheDeleted).toBe(true);

            // Seed the database with the order
            mockOrderModel.insert(updatedOrder);

            await service.findById(orderId);

            // Verify MongoDB was queried (cache miss after invalidation)
            expect(mockOrderModel.findById).toHaveBeenCalled();

            return true;
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // **Validates: Requirements 11.8**
  // Property 40: Redis Fallback Behavior
  describe('Property 40: Redis Fallback Behavior', () => {
    it('falls back to MongoDB when Redis getOrder returns null (simulating Redis failure)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
            totalAmount: fc.integer({ min: 100, max: 100000 }),
          }),
          async ({ orderId, userId, orderStatus, totalAmount }) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus,
              totalAmount,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Simulate Redis failure by returning null (CacheService catches errors internally)
            jest.spyOn(cacheService, 'getOrder').mockResolvedValue(null);

            // Seed the database with the order
            mockOrderModel.insert(mockOrder);

            // Call findById - should work despite Redis being unavailable
            const result = await service.findById(orderId);

            // Verify MongoDB was queried (fallback)
            expect(mockOrderModel.findById).toHaveBeenCalledWith(orderId);

            // Verify result matches database order
            expect(result).toEqual(mockOrder);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('continues operation when Redis setOrder fails silently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
            totalAmount: fc.integer({ min: 100, max: 100000 }),
          }),
          async ({ orderId, userId, orderStatus, totalAmount }) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus,
              totalAmount,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Cache miss
            jest.spyOn(cacheService, 'getOrder').mockResolvedValue(null);

            // Simulate Redis set doing nothing (graceful degradation - CacheService catches errors)
            jest.spyOn(cacheService, 'setOrder').mockResolvedValue(undefined);

            // Seed the database with the order
            mockOrderModel.insert(mockOrder);

            // Call findById - should work and return result even if caching fails
            const result = await service.findById(orderId);

            // Verify MongoDB was queried
            expect(mockOrderModel.findById).toHaveBeenCalledWith(orderId);

            // Verify result is returned despite cache set potentially failing
            expect(result).toEqual(mockOrder);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('continues operation when Redis deleteOrder fails silently during status update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: objectIdArb,
            userId: objectIdArb,
            currentStatus: fc.constantFrom(
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
            ),
            newStatus: fc.constantFrom(
              OrderStatus.CONFIRMED,
              OrderStatus.PACKED,
            ),
          }),
          async ({ orderId, userId, currentStatus, newStatus }) => {
            // Skip invalid transitions
            if (!service.validateStatusTransition(currentStatus, newStatus)) {
              return true;
            }

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus: currentStatus,
              totalAmount: 1000,
              items: [],
              paymentStatus: PaymentStatus.COMPLETED,
              paymentMethod: 'COD',
              deliveryAddress: {
                street: '123 Test St',
                city: 'Test City',
                postalCode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [77.5946, 12.9716],
                },
              },
              timeline: [],
              orderId: 'ORD-' + orderId.substring(0, 8),
              createdAt: new Date(),
              updatedAt: new Date(),
              save: jest.fn().mockResolvedValue(true),
            };

            // Mock the order model
            mockOrderModel.insert({
              ...mockOrder,
              save: undefined,
              deliveryOtp: '4321',
            });

            // Simulate Redis delete doing nothing (graceful degradation - CacheService catches errors)
            jest
              .spyOn(cacheService, 'deleteOrder')
              .mockResolvedValue(undefined);

            // Call updateStatus - should work even if cache invalidation fails
            try {
              const result = await service.updateStatus(
                orderId,
                newStatus,
                userId,
                { actorRole: 'admin', deliveryOtp: '4321' },
              );

              // Verify order was updated despite cache invalidation potentially failing
              expect(result).toBeDefined();
              expect(mockOrderModel.get(orderId).orderStatus).toBe(newStatus);
            } catch (error) {
              // Some transitions may fail due to business logic
              if (
                error instanceof Error &&
                error.message.includes('payment has not been completed')
              ) {
                return true;
              }
              throw error;
            }

            return true;
          },
        ),
        { numRuns: 30 },
      );
    });
  });
});
