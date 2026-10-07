import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import * as fc from 'fast-check';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { OrderStatusLog } from './schemas/order-status-log.schema';
import { User } from '../users/schemas/user.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';
import { Types } from 'mongoose';

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
    mockOrderModel = {
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

    const mockTrackingGateway = {
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

            // Set up MongoDB to return the order
            mockOrderModel.findById.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockOrder),
              }),
            });

            // Call findById
            const result = await service.findById(orderId);

            // Verify cache was checked first
            expect(cacheService.getOrder).toHaveBeenCalledWith(orderId);

            // Verify MongoDB was queried (cache miss)
            expect(mockOrderModel.findById).toHaveBeenCalledWith(orderId);

            // Verify result was cached
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
            mockOrderModel.findById.mockResolvedValue(mockOrder);

            // Spy on cache invalidation
            jest
              .spyOn(cacheService, 'deleteOrder')
              .mockResolvedValue(undefined);

            // Call updateStatus
            try {
              await service.updateStatus(orderId, newStatus, userId);

              // Verify cache was invalidated
              expect(cacheService.deleteOrder).toHaveBeenCalledWith(orderId);
            } catch (error) {
              // Some transitions may fail due to business logic (e.g., payment verification)
              // That's okay - we're testing cache invalidation when update succeeds
              if (
                error instanceof Error &&
                error.message.includes('Payment must be completed')
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
            mockOrderModel.findById.mockResolvedValue(mockOrder);

            // Set up cache behavior
            let cacheDeleted = false;
            jest
              .spyOn(cacheService, 'deleteOrder')
              .mockImplementation(async () => {
                cacheDeleted = true;
              });
            jest
              .spyOn(cacheService, 'getOrder')
              .mockImplementation(async () => {
                // Return null after cache is deleted
                return cacheDeleted ? null : mockOrder;
              });
            jest.spyOn(cacheService, 'setOrder').mockResolvedValue(undefined);

            // Update status (which should invalidate cache)
            try {
              await service.updateStatus(orderId, newStatus, userId);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('Payment must be completed')
              ) {
                return true;
              }
              throw error;
            }

            // Verify cache was deleted
            expect(cacheDeleted).toBe(true);

            // Now query the order again
            mockOrderModel.findById.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(updatedOrder),
              }),
            });

            const result = await service.findById(orderId);

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

            // Set up MongoDB to return the order
            mockOrderModel.findById.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockOrder),
              }),
            });

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

            // Set up MongoDB to return the order
            mockOrderModel.findById.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockOrder),
              }),
            });

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
            mockOrderModel.findById.mockResolvedValue(mockOrder);

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
              );

              // Verify order was updated despite cache invalidation potentially failing
              expect(result).toBeDefined();
              expect(mockOrder.save).toHaveBeenCalled();
            } catch (error) {
              // Some transitions may fail due to business logic
              if (
                error instanceof Error &&
                error.message.includes('Payment must be completed')
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
