import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fc from 'fast-check';
import { ETAService, LocationDto, AddressDto } from './eta.service';
import { RedisService } from '../../common/utils/redis.service';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

describe('ETAService', () => {
  let service: ETAService;
  let configService: ConfigService;
  let redisService: RedisService;
  let orderModel: Model<OrderDocument>;
  let userModel: Model<UserDocument>;

  // Mock Google Maps client
  const mockDistanceMatrixResponse = {
    data: {
      status: 'OK',
      rows: [
        {
          elements: [
            {
              status: 'OK',
              duration: { value: 1200 }, // 20 minutes
              distance: { value: 5000 }, // 5km
            },
          ],
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ETAService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_MAPS_API_KEY') return 'test-api-key';
              return null;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
          },
        },
        {
          provide: getModelToken(Order.name),
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ETAService>(ETAService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
    orderModel = module.get<Model<OrderDocument>>(getModelToken(Order.name));
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 24: ETA Calculation Inputs', () => {
    /**
     * **Validates: Requirements 6.3**
     *
     * For any ETA calculation, the system must use the rider's currentLocation
     * coordinates as origin and the order's deliveryAddress coordinates as
     * destination in the Distance Matrix API request.
     */
    it('should use rider location as origin and delivery address as destination', async () => {
      // Custom generators for valid coordinates
      const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
      const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

      const locationArb = fc.record({
        latitude: latitudeArb,
        longitude: longitudeArb,
      });

      const addressArb = fc.record({
        street: fc.string({ minLength: 1, maxLength: 100 }),
        city: fc.string({ minLength: 1, maxLength: 50 }),
        postalCode: fc.string({ minLength: 5, maxLength: 10 }),
        latitude: latitudeArb,
        longitude: longitudeArb,
      });

      await fc.assert(
        fc.asyncProperty(
          locationArb,
          addressArb,
          async (riderLocation: LocationDto, deliveryAddress: AddressDto) => {
            // Mock the Distance Matrix API call
            const distanceMatrixSpy = jest
              .spyOn(service as any, 'callDistanceMatrixAPI')
              .mockResolvedValue(mockDistanceMatrixResponse.data);

            try {
              await service.calculateETA(riderLocation, deliveryAddress);

              // Verify the API was called with correct origin and destination
              expect(distanceMatrixSpy).toHaveBeenCalledWith(
                `${riderLocation.latitude},${riderLocation.longitude}`,
                `${deliveryAddress.latitude},${deliveryAddress.longitude}`,
              );
            } finally {
              distanceMatrixSpy.mockRestore();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should pass driving mode to Distance Matrix API', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Spy on the actual Google Maps client call
      const googleMapsClientSpy = jest
        .spyOn((service as any).googleMapsClient, 'distancematrix')
        .mockResolvedValue(mockDistanceMatrixResponse);

      await service.calculateETA(riderLocation, deliveryAddress);

      // Verify the API was called with driving mode
      expect(googleMapsClientSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            mode: 'driving',
          }),
        }),
      );

      googleMapsClientSpy.mockRestore();
    });
  });

  describe('Property 25: ETA Persistence', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * For any successful ETA calculation, the order's estimatedDeliveryTime
     * field must be updated with the calculated delivery time.
     */
    it('should update order estimatedDeliveryTime after successful recalculation', async () => {
      // Generate valid MongoDB ObjectId (24 hex characters)
      const hexChars = '0123456789abcdef'.split('');
      const orderIdArb = fc
        .array(fc.constantFrom(...hexChars), { minLength: 24, maxLength: 24 })
        .map((arr) => arr.join(''));
      const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
      const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (
            orderId: string,
            riderLat: number,
            riderLng: number,
            destLat: number,
            destLng: number,
          ) => {
            // Create mock order
            const mockOrder = {
              _id: orderId,
              orderStatus: OrderStatus.OUT_FOR_DELIVERY,
              riderId: '507f1f77bcf86cd799439011',
              deliveryAddress: {
                address: '123 Main St',
                city: 'Test City',
                pincode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [destLng, destLat],
                },
              },
              estimatedDeliveryTime: null,
              save: jest.fn().mockResolvedValue(true),
            };

            // Create mock rider
            const mockRider = {
              _id: '507f1f77bcf86cd799439011',
              role: UserRole.RIDER,
              currentLocation: {
                type: 'Point',
                coordinates: [riderLng, riderLat],
              },
            };

            jest.spyOn(orderModel, 'findById').mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockOrder),
            } as any);

            jest
              .spyOn(userModel, 'findOne')
              .mockResolvedValue(mockRider as any);

            // Mock the Distance Matrix API call
            jest
              .spyOn(service as any, 'callDistanceMatrixAPI')
              .mockResolvedValue(mockDistanceMatrixResponse.data);

            const result = await service.recalculateForOrder(orderId);

            // Verify the order's estimatedDeliveryTime was updated
            expect(mockOrder.estimatedDeliveryTime).not.toBeNull();
            expect(mockOrder.estimatedDeliveryTime).toBeInstanceOf(Date);
            expect(mockOrder.save).toHaveBeenCalled();
            expect(result).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should calculate future delivery time based on duration', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock the Distance Matrix API call with specific duration
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      const beforeTime = Date.now();
      const result = await service.calculateETA(riderLocation, deliveryAddress);
      const afterTime = Date.now();

      // The estimated delivery time should be in the future
      expect(result.estimatedDeliveryTime.getTime()).toBeGreaterThan(
        beforeTime,
      );

      // It should be approximately 20 minutes (1200 seconds) from now
      const expectedTime = beforeTime + 1200 * 1000;
      const tolerance = 5000; // 5 seconds tolerance
      expect(result.estimatedDeliveryTime.getTime()).toBeGreaterThanOrEqual(
        expectedTime - tolerance,
      );
      expect(result.estimatedDeliveryTime.getTime()).toBeLessThanOrEqual(
        afterTime + 1200 * 1000 + tolerance,
      );
    });
  });

  describe('Property 26: ETA Calculation Error Handling', () => {
    /**
     * **Validates: Requirements 6.5, 11.4**
     *
     * For any ETA calculation that fails due to API error, the system must
     * log the error and retain the order's previous estimatedDeliveryTime
     * value without modification.
     */
    it('should retain previous ETA when API call fails', async () => {
      const hexChars = '0123456789abcdef'.split('');
      const orderIdArb = fc
        .array(fc.constantFrom(...hexChars), { minLength: 24, maxLength: 24 })
        .map((arr) => arr.join(''));
      const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
      const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (
            orderId: string,
            riderLat: number,
            riderLng: number,
            destLat: number,
            destLng: number,
          ) => {
            const previousETA = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

            // Create mock order with existing ETA
            const mockOrder = {
              _id: orderId,
              orderStatus: OrderStatus.OUT_FOR_DELIVERY,
              riderId: '507f1f77bcf86cd799439011',
              deliveryAddress: {
                address: '123 Main St',
                city: 'Test City',
                pincode: '12345',
                coordinates: {
                  type: 'Point',
                  coordinates: [destLng, destLat],
                },
              },
              estimatedDeliveryTime: previousETA,
              save: jest.fn().mockResolvedValue(true),
            };

            // Create mock rider
            const mockRider = {
              _id: '507f1f77bcf86cd799439011',
              role: UserRole.RIDER,
              currentLocation: {
                type: 'Point',
                coordinates: [riderLng, riderLat],
              },
            };

            jest.spyOn(orderModel, 'findById').mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockOrder),
            } as any);

            jest
              .spyOn(userModel, 'findOne')
              .mockResolvedValue(mockRider as any);

            // Mock the Distance Matrix API call to fail
            jest
              .spyOn(service as any, 'callDistanceMatrixAPI')
              .mockRejectedValue(new Error('API Error'));

            const result = await service.recalculateForOrder(orderId);

            // Verify the order's estimatedDeliveryTime was NOT modified
            expect(mockOrder.estimatedDeliveryTime).toEqual(previousETA);
            expect(mockOrder.save).not.toHaveBeenCalled();
            expect(result).toBeNull();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should log error when Distance Matrix API fails', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock the Distance Matrix API call to fail
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockRejectedValue(new Error('API rate limit exceeded'));

      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        service.calculateETA(riderLocation, deliveryAddress),
      ).rejects.toThrow();

      // Verify error was logged
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to calculate ETA'),
      );
    });

    it('should handle missing API key gracefully', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock config service to return null for API key
      jest.spyOn(configService, 'get').mockReturnValue(null);

      await expect(
        service.calculateETA(riderLocation, deliveryAddress),
      ).rejects.toThrow('GOOGLE_MAPS_API_KEY is not configured');
    });
  });

  describe('Property 34: ETA Response Caching', () => {
    /**
     * **Validates: Requirements 10.8**
     *
     * For any Distance Matrix API request, if a cached response exists for
     * the same origin-destination pair and is less than 2 minutes old, the
     * system must use the cached duration value instead of making a new API call.
     */
    it('should use cached ETA when available and not expired', async () => {
      const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
      const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

      await fc.assert(
        fc.asyncProperty(
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (
            riderLat: number,
            riderLng: number,
            destLat: number,
            destLng: number,
          ) => {
            const riderLocation: LocationDto = {
              latitude: riderLat,
              longitude: riderLng,
            };
            const deliveryAddress: AddressDto = {
              street: '123 Main St',
              city: 'Test City',
              postalCode: '12345',
              latitude: destLat,
              longitude: destLng,
            };

            // Mock Redis to return cached duration (1800 seconds = 30 minutes)
            const cachedDuration = 1800;
            jest
              .spyOn(redisService, 'get')
              .mockResolvedValue(cachedDuration.toString());

            // Spy on the Distance Matrix API call
            const apiSpy = jest.spyOn(service as any, 'callDistanceMatrixAPI');

            const result = await service.calculateETA(
              riderLocation,
              deliveryAddress,
            );

            // Verify the API was NOT called (cache was used)
            expect(apiSpy).not.toHaveBeenCalled();

            // Verify the result uses the cached duration
            expect(result.durationMinutes).toBe(Math.ceil(cachedDuration / 60));
            expect(result.estimatedDeliveryTime).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should call API and cache result when cache miss', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock Redis to return null (cache miss)
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const redisSetSpy = jest.spyOn(redisService, 'set');

      // Mock the Distance Matrix API call
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      await service.calculateETA(riderLocation, deliveryAddress);

      // Verify the result was cached with 2-minute TTL
      expect(redisSetSpy).toHaveBeenCalledWith(
        expect.stringContaining('eta:'),
        '1200', // Duration from mock response
        120, // 2-minute TTL
      );
    });

    it('should generate consistent cache keys for same coordinates', async () => {
      const riderLocation: LocationDto = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock Redis
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const redisSetSpy = jest.spyOn(redisService, 'set');

      // Mock the Distance Matrix API call
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      // Call twice with same coordinates
      await service.calculateETA(riderLocation, deliveryAddress);
      const firstCacheKey = redisSetSpy.mock.calls[0][0];

      jest.clearAllMocks();
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set');
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      await service.calculateETA(riderLocation, deliveryAddress);
      const secondCacheKey = redisSetSpy.mock.calls[0][0];

      // Verify both calls used the same cache key
      expect(firstCacheKey).toBe(secondCacheKey);
    });

    it('should round coordinates in cache key for better cache hits', async () => {
      // Coordinates that are very close (within 11 meters)
      const riderLocation1: LocationDto = {
        latitude: 40.71280001,
        longitude: -74.00600001,
      };
      const riderLocation2: LocationDto = {
        latitude: 40.71280002,
        longitude: -74.00600002,
      };
      const deliveryAddress: AddressDto = {
        street: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      // Mock Redis
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const redisSetSpy = jest.spyOn(redisService, 'set');

      // Mock the Distance Matrix API call
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      await service.calculateETA(riderLocation1, deliveryAddress);
      const firstCacheKey = redisSetSpy.mock.calls[0][0];

      jest.clearAllMocks();
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      jest.spyOn(redisService, 'set');
      jest
        .spyOn(service as any, 'callDistanceMatrixAPI')
        .mockResolvedValue(mockDistanceMatrixResponse.data);

      await service.calculateETA(riderLocation2, deliveryAddress);
      const secondCacheKey = redisSetSpy.mock.calls[0][0];

      // Verify both calls used the same cache key (due to rounding to 4 decimal places)
      expect(firstCacheKey).toBe(secondCacheKey);
    });
  });
});
