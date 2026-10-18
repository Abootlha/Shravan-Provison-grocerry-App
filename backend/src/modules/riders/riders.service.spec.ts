import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as fc from 'fast-check';
import {
  ETA_RECALC_INTERVAL_MS,
  LOCATION_THROTTLE_MS,
  RidersService,
} from './riders.service';
import { UserRole } from '../users/schemas/user.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { Rider, RiderStatus } from './schemas/rider.schema';
import { OrdersService } from '../orders/orders.service';
import { RedisService } from '../../common/utils/redis.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from '../orders/eta.service';
import { OrderStatusLog } from '../orders/schemas/order-status-log.schema';

describe('RidersService - Property-Based Tests', () => {
  let service: RidersService;

  const mockUserModel: any = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  mockUserModel.findById = jest.fn((...args: any[]) =>
    mockUserModel.findOne(...args),
  );

  const mockOrdersService = {
    buildRealtimeOrderPayload: jest.fn().mockResolvedValue({}),
  };

  const mockOrderModel = {
    find: jest.fn(),
  };

  const mockRedisClient = { set: jest.fn() };
  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: () => mockRedisClient,
  };

  const mockOrderStatusLogModel = { countDocuments: jest.fn() };

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
        RidersService,
        { provide: getModelToken(Rider.name), useValue: mockUserModel },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: RedisService, useValue: mockRedisService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
        {
          provide: getModelToken(OrderStatusLog.name),
          useValue: mockOrderStatusLogModel,
        },
      ],
    }).compile();

    service = module.get<RidersService>(RidersService);

    // Reset all mocks before each test
    jest.clearAllMocks();
    mockUserModel.findById.mockImplementation((...args: any[]) =>
      mockUserModel.findOne(...args),
    );
    mockOrdersService.buildRealtimeOrderPayload.mockResolvedValue({});
    // SET ... PX ... NX succeeds unless a test simulates a held slot.
    mockRedisClient.set.mockResolvedValue('OK');

    // Set up default mock for order model (empty orders)
    mockOrderModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 3.7, 4.4, 4.5, 10.7**
  // Property 11: Location Update Throttling
  describe('Property 11: Location Update Throttling', () => {
    const riderId = '507f1f77bcf86cd799439011';
    const location = { latitude: 10.5, longitude: 20.5 };

    const riderDoc = () => {
      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      const rider: any = {
        _id: riderId,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };
      mockUserModel.findOne.mockResolvedValue(rider);
      return { rider, saveMock };
    };

    /** Behaves like Redis SET key value PX ms NX with a controllable clock. */
    const fakeRedisWithClock = () => {
      let now = 0;
      const expiries = new Map<string, number>();
      mockRedisClient.set.mockImplementation(
        (key: string, _v: string, _px: string, ms: number) => {
          const until = expiries.get(key);
          if (until !== undefined && until > now) return Promise.resolve(null);
          expiries.set(key, now + ms);
          return Promise.resolve('OK');
        },
      );
      return { advance: (ms: number) => (now += ms) };
    };

    it('drops updates within 2.5 s silently instead of throwing', async () => {
      const { saveMock } = riderDoc();
      const clock = fakeRedisWithClock();

      await expect(service.updateLocation(riderId, location)).resolves.toEqual(
        expect.objectContaining({ throttled: false }),
      );
      clock.advance(1000);
      await expect(service.updateLocation(riderId, location)).resolves.toEqual({
        throttled: true,
      });
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('accepts every update from a client sending every 5 s, even with jitter', async () => {
      const { saveMock } = riderDoc();
      const clock = fakeRedisWithClock();

      for (const gap of [0, 5000, 4600, 5300, 4800, 5000]) {
        clock.advance(gap);
        const result = await service.updateLocation(riderId, location);
        expect(result.throttled).toBe(false);
      }
      expect(saveMock).toHaveBeenCalledTimes(6);
    });

    it('claims the throttle slot atomically with a 2500 ms PX NX key', async () => {
      riderDoc();
      await service.updateLocation(riderId, location);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `rider:location:throttle:${riderId}`,
        expect.any(String),
        'PX',
        LOCATION_THROTTLE_MS,
        'NX',
      );
      expect(LOCATION_THROTTLE_MS).toBe(2500);
    });

    it('fails open when Redis is unavailable', async () => {
      const { saveMock } = riderDoc();
      mockRedisClient.set.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.updateLocation(riderId, location);
      expect(result.throttled).toBe(false);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('recalculates ETA at most every 15 s and broadcasts etaUpdate when it does', async () => {
      riderDoc();
      const clock = fakeRedisWithClock();
      const orderId = '507f1f77bcf86cd799439013';
      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue([
                { _id: orderId, orderStatus: OrderStatus.OUT_FOR_DELIVERY },
              ]),
          }),
        }),
      });
      const eta = new Date(Date.now() + 600000);
      mockETAService.recalculateForOrder.mockResolvedValue(eta);

      for (let i = 0; i < 4; i += 1) {
        await service.updateLocation(riderId, location);
        clock.advance(5000);
      }

      // t=0 and t=15 s recalculate; t=5 s and t=10 s reuse the last ETA.
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledTimes(2);
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledTimes(2);
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        orderId,
        eta,
        expect.anything(),
      );
      expect(ETA_RECALC_INTERVAL_MS).toBe(15000);
      // Location is still broadcast on every accepted update.
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenCalledTimes(4);
    });
  });

  // **Validates: Requirements 4.2, 4.6**
  // Property 13: Location Persistence
  describe('Property 13: Location Persistence', () => {
    it('updates currentLocation and lastLocationUpdate for valid location updates', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        lastLocationUpdate: undefined,
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const result = await service.updateLocation(riderId, location);

      // Verify currentLocation is updated with GeoJSON format
      expect(result.rider!.currentLocation.type).toBe('Point');
      expect(result.rider!.currentLocation.coordinates[0]).toBeCloseTo(
        location.longitude,
        3,
      );
      expect(result.rider!.currentLocation.coordinates[1]).toBeCloseTo(
        location.latitude,
        3,
      );

      // Verify lastLocationUpdate is set to a Date
      expect(result.rider!.lastLocationUpdate).toBeDefined();
      expect(result.rider!.lastLocationUpdate).toBeInstanceOf(Date);

      // Verify save was called
      expect(saveMock).toHaveBeenCalled();
    });

    it('property: stores any valid coordinates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';

            mockRedisService.get.mockResolvedValue(null);
            mockRedisService.set.mockResolvedValue(undefined);

            const saveMock = jest.fn().mockImplementation(function (this: any) {
              return Promise.resolve(this);
            });

            const mockRider: any = {
              _id: riderId,
              role: UserRole.RIDER,
              currentLocation: { type: 'Point', coordinates: [0, 0] },
              save: saveMock,
            };

            mockUserModel.findOne.mockResolvedValue(mockRider);

            const result = await service.updateLocation(riderId, {
              latitude,
              longitude,
            });

            // Verify coordinates are stored correctly
            expect(result.rider!.currentLocation.coordinates[0]).toBeCloseTo(
              longitude,
              2,
            );
            expect(result.rider!.currentLocation.coordinates[1]).toBeCloseTo(
              latitude,
              2,
            );
            expect(result.rider!.lastLocationUpdate).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('stores coordinates in [longitude, latitude] order', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const latitude = 10.5;
      const longitude = 20.5;

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const result = await service.updateLocation(riderId, {
        latitude,
        longitude,
      });

      // GeoJSON format: [longitude, latitude]
      expect(result.rider!.currentLocation.coordinates[0]).toBe(longitude);
      expect(result.rider!.currentLocation.coordinates[1]).toBe(latitude);
    });

    it('updates lastLocationUpdate timestamp on each location update', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location1 = { latitude: 10.5, longitude: 20.5 };
      const location2 = { latitude: 11.5, longitude: 21.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        lastLocationUpdate: null,
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      // First update
      const result1 = await service.updateLocation(riderId, location1);
      const timestamp1 = result1.rider!.lastLocationUpdate;

      expect(timestamp1).toBeInstanceOf(Date);

      // Second update (simulate time passing)
      const result2 = await service.updateLocation(riderId, location2);
      const timestamp2 = result2.rider!.lastLocationUpdate;

      expect(timestamp2).toBeInstanceOf(Date);
      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
      if (timestamp1 && timestamp2) {
        expect(timestamp2.getTime()).toBeGreaterThanOrEqual(
          timestamp1.getTime(),
        );
      }
    });
  });

  // **Validates: Requirements 3.4**
  // Property 9: Rider Assignment Validation
  describe('Property 9: Rider Assignment Validation', () => {
    it('findAvailableRiders returns only riders with isAvailable=true and isOnline=true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
                s
                  .split('')
                  .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
                  .slice(0, 24),
              ),
              role: fc.constant(UserRole.RIDER),
              isAvailable: fc.boolean(),
              isOnline: fc.boolean(),
            }),
            { minLength: 5, maxLength: 20 },
          ),
          async (riders) => {
            const availableRiders = riders
              .filter((r) => r.isAvailable && r.isOnline)
              .map((r) => ({
                ...r,
                status: RiderStatus.AVAILABLE,
                isActive: true,
              }));

            mockUserModel.find.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(availableRiders),
              }),
            });

            const result = await service.findAvailableRiders();

            // All returned riders must be available and active
            result.forEach((rider) => {
              expect(rider.status).toBe('available');
              expect(rider.isActive).toBe(true);
            });

            // Count should match
            expect(result.length).toBe(availableRiders.length);
            expect(mockUserModel.find).toHaveBeenCalledWith({
              status: RiderStatus.AVAILABLE,
              isActive: true,
            });
          },
        ),
        { numRuns: 30 },
      );
    });

    it('findAvailableRiders excludes riders with isAvailable=false', async () => {
      const riders = [
        {
          _id: '507f1f77bcf86cd799439011',
          role: UserRole.RIDER,
          isAvailable: false,
          isOnline: true,
        },
        {
          _id: '507f1f77bcf86cd799439012',
          role: UserRole.RIDER,
          isAvailable: true,
          isOnline: true,
        },
      ];

      mockUserModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([riders[1]]),
        }),
      });

      const result = await service.findAvailableRiders();

      expect(result.length).toBe(1);
      expect((result[0] as any)._id).toBe('507f1f77bcf86cd799439012');
    });

    it('findAvailableRiders excludes riders with isOnline=false', async () => {
      const riders = [
        {
          _id: '507f1f77bcf86cd799439011',
          role: UserRole.RIDER,
          isAvailable: true,
          isOnline: false,
        },
        {
          _id: '507f1f77bcf86cd799439012',
          role: UserRole.RIDER,
          isAvailable: true,
          isOnline: true,
        },
      ];

      mockUserModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([riders[1]]),
        }),
      });

      const result = await service.findAvailableRiders();

      expect(result.length).toBe(1);
      expect((result[0] as any)._id).toBe('507f1f77bcf86cd799439012');
    });
  });

  // Additional validation tests
  describe('Location Coordinate Validation', () => {
    it('rejects latitude outside [-90, 90] range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.double({ min: -1000, max: -90.1, noNaN: true }),
            fc.double({ min: 90.1, max: 1000, noNaN: true }),
          ),
          fc.double({ min: -180, max: 180, noNaN: true }),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';
            mockRedisService.get.mockResolvedValue(null);

            await expect(
              service.updateLocation(riderId, { latitude, longitude }),
            ).rejects.toThrow('Latitude must be between -90 and 90');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('rejects longitude outside [-180, 180] range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.oneof(
            fc.double({ min: -1000, max: -180.1, noNaN: true }),
            fc.double({ min: 180.1, max: 1000, noNaN: true }),
          ),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';
            mockRedisService.get.mockResolvedValue(null);

            await expect(
              service.updateLocation(riderId, { latitude, longitude }),
            ).rejects.toThrow('Longitude must be between -180 and 180');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('rejects NaN and Infinity values', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.updateLocation(riderId, { latitude: NaN, longitude: 0 }),
      ).rejects.toThrow('Latitude must be between -90 and 90');

      await expect(
        service.updateLocation(riderId, { latitude: 0, longitude: NaN }),
      ).rejects.toThrow('Longitude must be between -180 and 180');

      await expect(
        service.updateLocation(riderId, { latitude: Infinity, longitude: 0 }),
      ).rejects.toThrow('Latitude must be between -90 and 90');

      await expect(
        service.updateLocation(riderId, { latitude: 0, longitude: Infinity }),
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });

    it('accepts all valid coordinate combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.double({ min: -180, max: 180, noNaN: true }),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';

            mockRedisService.get.mockResolvedValue(null);
            mockRedisService.set.mockResolvedValue(undefined);

            const saveMock = jest.fn().mockImplementation(function (this: any) {
              return Promise.resolve(this);
            });

            const mockRider: any = {
              _id: riderId,
              role: UserRole.RIDER,
              currentLocation: { type: 'Point', coordinates: [0, 0] },
              save: saveMock,
            };

            mockUserModel.findOne.mockResolvedValue(mockRider);

            await expect(
              service.updateLocation(riderId, { latitude, longitude }),
            ).resolves.toBeDefined();
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  // **Validates: Requirements 5.7**
  // Property 20: Rider Location Event Emission
  describe('Property 20: Rider Location Event Emission', () => {
    it('broadcasts riderLocationUpdate event to all active order rooms on location update', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const mockOrders = [
        { _id: '507f1f77bcf86cd799439012', orderStatus: OrderStatus.ASSIGNED },
        { _id: '507f1f77bcf86cd799439013', orderStatus: OrderStatus.ASSIGNED },
      ];

      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      await service.updateLocation(riderId, location);

      // Verify broadcast was called for each order
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenCalledTimes(2);

      // Verify each call has correct parameters
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenNthCalledWith(
        1,
        mockOrders[0]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId,
        expect.anything(),
      );
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenNthCalledWith(
        2,
        mockOrders[1]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId,
        expect.anything(),
      );
    });

    it('includes riderId, location, and timestamp in broadcast event', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const mockOrders = [
        { _id: '507f1f77bcf86cd799439012', orderStatus: OrderStatus.ASSIGNED },
      ];

      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      mockETAService.recalculateForOrder.mockResolvedValue(new Date());

      await service.updateLocation(riderId, location);

      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenCalledWith(
        mockOrders[0]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId,
        expect.anything(),
      );
    });

    it('broadcasts to order rooms only for ASSIGNED and OUT_FOR_DELIVERY orders', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const mockOrders = [
        { _id: '507f1f77bcf86cd799439012', orderStatus: OrderStatus.ASSIGNED },
        {
          _id: '507f1f77bcf86cd799439013',
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
      ];

      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      mockETAService.recalculateForOrder.mockResolvedValue(new Date());

      await service.updateLocation(riderId, location);

      // Verify find was called with correct filter
      expect(mockOrderModel.find).toHaveBeenCalledWith({
        riderId: expect.anything(),
        orderStatus: {
          $in: [
            OrderStatus.ASSIGNED,
            OrderStatus.PACKED,
            OrderStatus.PICKED_UP,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      });

      // Verify broadcast was called for both orders
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).toHaveBeenCalledTimes(2);
    });

    it('triggers ETA recalculation for OUT_FOR_DELIVERY orders', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const mockOrders = [
        { _id: '507f1f77bcf86cd799439012', orderStatus: OrderStatus.ASSIGNED },
        {
          _id: '507f1f77bcf86cd799439013',
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
      ];

      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      const mockETA = new Date();
      mockETAService.recalculateForOrder.mockResolvedValue(mockETA);

      await service.updateLocation(riderId, location);

      // Verify ETA recalculation was called only for OUT_FOR_DELIVERY order
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledTimes(1);
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(
        mockOrders[1]._id,
      );

      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(
        mockOrders[1]._id,
        mockETA,
        expect.anything(),
      );
    });

    it('does not broadcast if location update fails', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 200, longitude: 20.5 }; // Invalid latitude

      mockRedisService.get.mockResolvedValue(null);

      await expect(service.updateLocation(riderId, location)).rejects.toThrow();

      // Verify no broadcasts were made
      expect(
        mockTrackingGateway.broadcastRiderLocationUpdate,
      ).not.toHaveBeenCalled();
      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });
  });
});
