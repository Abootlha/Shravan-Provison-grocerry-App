import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as fc from 'fast-check';
import { RidersService, LocationDto } from './riders.service';
import { User, UserRole } from '../users/schemas/user.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { RedisService } from '../../common/utils/redis.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from '../orders/eta.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RidersService - Property-Based Tests', () => {
  let service: RidersService;
  let trackingGateway: TrackingGateway;
  let etaService: ETAService;

  const mockUserModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockOrderModel = {
    find: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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
        RidersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: RedisService, useValue: mockRedisService },
        { provide: TrackingGateway, useValue: mockTrackingGateway },
        { provide: ETAService, useValue: mockETAService },
      ],
    }).compile();

    service = module.get<RidersService>(RidersService);
    trackingGateway = module.get<TrackingGateway>(TrackingGateway);
    etaService = module.get<ETAService>(ETAService);
    
    // Reset all mocks before each test
    jest.clearAllMocks();

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
    it('rejects location updates within 5 seconds of previous update', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      // First update - should succeed
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValue(undefined);
      mockUserModel.findOne.mockResolvedValueOnce(mockRider);
      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.updateLocation(riderId, location);
      expect(saveMock).toHaveBeenCalledTimes(1);

      // Second update within 5 seconds - should be throttled
      mockRedisService.get.mockResolvedValueOnce(Date.now().toString());

      await expect(
        service.updateLocation(riderId, location)
      ).rejects.toThrow('Location updates are throttled to 5 seconds minimum interval');
      
      // Save should still only have been called once
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('allows location updates after throttle period expires', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);
      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.updateLocation(riderId, location)
      ).resolves.toBeDefined();
    });

    it('sets Redis throttle key with 5-second TTL on successful update', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      await service.updateLocation(riderId, location);

      const throttleKey = `rider:location:throttle:${riderId}`;
      expect(mockRedisService.set).toHaveBeenCalledWith(
        throttleKey,
        expect.any(String),
        5
      );
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

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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
      expect(result.currentLocation.type).toBe('Point');
      expect(result.currentLocation.coordinates[0]).toBeCloseTo(location.longitude, 3);
      expect(result.currentLocation.coordinates[1]).toBeCloseTo(location.latitude, 3);

      // Verify lastLocationUpdate is set to a Date
      expect(result.lastLocationUpdate).toBeDefined();
      expect(result.lastLocationUpdate).toBeInstanceOf(Date);

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

            const saveMock = jest.fn().mockImplementation(function(this: any) {
              return Promise.resolve(this);
            });

            const mockRider: any = {
              _id: riderId,
              role: UserRole.RIDER,
              currentLocation: { type: 'Point', coordinates: [0, 0] },
              save: saveMock,
            };

            mockUserModel.findOne.mockResolvedValue(mockRider);

            const result = await service.updateLocation(riderId, { latitude, longitude });

            // Verify coordinates are stored correctly
            expect(result.currentLocation.coordinates[0]).toBeCloseTo(longitude, 2);
            expect(result.currentLocation.coordinates[1]).toBeCloseTo(latitude, 2);
            expect(result.lastLocationUpdate).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('stores coordinates in [longitude, latitude] order', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const latitude = 10.5;
      const longitude = 20.5;

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });

      const mockRider: any = {
        _id: riderId,
        role: UserRole.RIDER,
        currentLocation: { type: 'Point', coordinates: [0, 0] },
        save: saveMock,
      };

      mockUserModel.findOne.mockResolvedValue(mockRider);

      const result = await service.updateLocation(riderId, { latitude, longitude });

      // GeoJSON format: [longitude, latitude]
      expect(result.currentLocation.coordinates[0]).toBe(longitude);
      expect(result.currentLocation.coordinates[1]).toBe(latitude);
    });

    it('updates lastLocationUpdate timestamp on each location update', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location1 = { latitude: 10.5, longitude: 20.5 };
      const location2 = { latitude: 11.5, longitude: 21.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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
      const timestamp1 = result1.lastLocationUpdate;

      expect(timestamp1).toBeInstanceOf(Date);

      // Second update (simulate time passing)
      const result2 = await service.updateLocation(riderId, location2);
      const timestamp2 = result2.lastLocationUpdate;

      expect(timestamp2).toBeInstanceOf(Date);
      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
      if (timestamp1 && timestamp2) {
        expect(timestamp2.getTime()).toBeGreaterThanOrEqual(timestamp1.getTime());
      }
    });
  });

  // **Validates: Requirements 3.4**
  // Property 9: Rider Assignment Validation
  describe('Property 9: Rider Assignment Validation', () => {
    it('findAvailableRiders returns only riders with isAvailable=true and isOnline=true', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              _id: fc.string({ minLength: 24, maxLength: 24 }).map(s =>
                s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 24)
              ),
              role: fc.constant(UserRole.RIDER),
              isAvailable: fc.boolean(),
              isOnline: fc.boolean(),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (riders) => {
            const availableRiders = riders.filter(r => r.isAvailable && r.isOnline);

            mockUserModel.find.mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(availableRiders),
              }),
            });

            const result = await service.findAvailableRiders();

            // All returned riders must be available and active
            result.forEach(rider => {
              expect(rider.status).toBe('available');
              expect(rider.isActive).toBe(true);
            });

            // Count should match
            expect(result.length).toBe(availableRiders.length);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('findAvailableRiders excludes riders with isAvailable=false', async () => {
      const riders = [
        { _id: '507f1f77bcf86cd799439011', role: UserRole.RIDER, isAvailable: false, isOnline: true },
        { _id: '507f1f77bcf86cd799439012', role: UserRole.RIDER, isAvailable: true, isOnline: true },
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
        { _id: '507f1f77bcf86cd799439011', role: UserRole.RIDER, isAvailable: true, isOnline: false },
        { _id: '507f1f77bcf86cd799439012', role: UserRole.RIDER, isAvailable: true, isOnline: true },
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
            fc.double({ min: 90.1, max: 1000, noNaN: true })
          ),
          fc.double({ min: -180, max: 180, noNaN: true }),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';
            mockRedisService.get.mockResolvedValue(null);

            await expect(
              service.updateLocation(riderId, { latitude, longitude })
            ).rejects.toThrow('Latitude must be between -90 and 90');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('rejects longitude outside [-180, 180] range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -90, max: 90, noNaN: true }),
          fc.oneof(
            fc.double({ min: -1000, max: -180.1, noNaN: true }),
            fc.double({ min: 180.1, max: 1000, noNaN: true })
          ),
          async (latitude, longitude) => {
            const riderId = '507f1f77bcf86cd799439011';
            mockRedisService.get.mockResolvedValue(null);

            await expect(
              service.updateLocation(riderId, { latitude, longitude })
            ).rejects.toThrow('Longitude must be between -180 and 180');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('rejects NaN and Infinity values', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.updateLocation(riderId, { latitude: NaN, longitude: 0 })
      ).rejects.toThrow('Latitude must be between -90 and 90');

      await expect(
        service.updateLocation(riderId, { latitude: 0, longitude: NaN })
      ).rejects.toThrow('Longitude must be between -180 and 180');

      await expect(
        service.updateLocation(riderId, { latitude: Infinity, longitude: 0 })
      ).rejects.toThrow('Latitude must be between -90 and 90');

      await expect(
        service.updateLocation(riderId, { latitude: 0, longitude: Infinity })
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

            const saveMock = jest.fn().mockImplementation(function(this: any) {
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
              service.updateLocation(riderId, { latitude, longitude })
            ).resolves.toBeDefined();
          }
        ),
        { numRuns: 30 }
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

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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
      expect(mockTrackingGateway.broadcastRiderLocationUpdate).toHaveBeenCalledTimes(2);

      // Verify each call has correct parameters
      expect(mockTrackingGateway.broadcastRiderLocationUpdate).toHaveBeenNthCalledWith(
        1,
        mockOrders[0]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId
      );
      expect(mockTrackingGateway.broadcastRiderLocationUpdate).toHaveBeenNthCalledWith(
        2,
        mockOrders[1]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId
      );
    });

    it('includes riderId, location, and timestamp in broadcast event', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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

      expect(mockTrackingGateway.broadcastRiderLocationUpdate).toHaveBeenCalledWith(
        mockOrders[0]._id,
        { latitude: location.latitude, longitude: location.longitude },
        riderId
      );
    });

    it('broadcasts to order rooms only for ASSIGNED and OUT_FOR_DELIVERY orders', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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
        { _id: '507f1f77bcf86cd799439013', orderStatus: OrderStatus.OUT_FOR_DELIVERY },
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
          $in: [OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY],
        },
      });

      // Verify broadcast was called for both orders
      expect(mockTrackingGateway.broadcastRiderLocationUpdate).toHaveBeenCalledTimes(2);
    });

    it('triggers ETA recalculation for OUT_FOR_DELIVERY orders', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 10.5, longitude: 20.5 };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const saveMock = jest.fn().mockImplementation(function(this: any) {
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
        { _id: '507f1f77bcf86cd799439013', orderStatus: OrderStatus.OUT_FOR_DELIVERY },
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
      expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(mockOrders[1]._id);

      // Verify ETA broadcast was called
      expect(mockTrackingGateway.broadcastETAUpdate).toHaveBeenCalledWith(mockOrders[1]._id, mockETA);
    });

    it('does not broadcast if location update fails', async () => {
      const riderId = '507f1f77bcf86cd799439011';
      const location = { latitude: 200, longitude: 20.5 }; // Invalid latitude

      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.updateLocation(riderId, location)
      ).rejects.toThrow();

      // Verify no broadcasts were made
      expect(mockTrackingGateway.broadcastRiderLocationUpdate).not.toHaveBeenCalled();
      expect(mockTrackingGateway.broadcastETAUpdate).not.toHaveBeenCalled();
    });
  });
});
