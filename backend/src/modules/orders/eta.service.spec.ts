import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import * as fc from 'fast-check';
import axios from 'axios';
import { ETAService, LocationDto, AddressDto } from './eta.service';
import { RedisService } from '../../common/utils/redis.service';
import { Order, OrderStatus } from './schemas/order.schema';
import { Rider } from '../riders/schemas/rider.schema';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const DIRECTIONS_URL =
  'https://route.mappls.com/route/direction/route_adv/driving';

// Mappls directions response: 20 minutes, 5km
const directionsResponse = {
  data: {
    routes: [
      {
        geometry: '',
        duration: 1200,
        distance: 5000,
        legs: [{ duration: 1200, distance: 5000 }],
      },
    ],
  },
};

const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });
const orderIdArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 24,
    maxLength: 24,
  })
  .map((arr) => arr.join(''));

const riderLocation: LocationDto = { latitude: 28.6139, longitude: 77.209 };
const deliveryAddress: AddressDto = {
  street: '123 Main St',
  city: 'New Delhi',
  postalCode: '110001',
  latitude: 28.6304,
  longitude: 77.2177,
};

describe('ETAService', () => {
  let service: ETAService;
  let redisService: {
    get: jest.Mock;
    set: jest.Mock;
    getJSON: jest.Mock;
    setJSON: jest.Mock;
  };
  let orderModel: { findById: jest.Mock };
  let riderModel: { findById: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn((key: string) =>
      key === 'MAPMYINDIA_API_KEY' ? 'test-api-key' : undefined,
    );
    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      getJSON: jest.fn().mockResolvedValue(null),
      setJSON: jest.fn().mockResolvedValue('OK'),
    };
    orderModel = { findById: jest.fn() };
    riderModel = { findById: jest.fn() };
    mockedAxios.get.mockResolvedValue(directionsResponse);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ETAService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: RedisService, useValue: redisService },
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Rider.name), useValue: riderModel },
      ],
    }).compile();

    service = module.get<ETAService>(ETAService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockOrderAndRider = (
    orderId: string,
    riderLat: number,
    riderLng: number,
    destLat: number,
    destLng: number,
    previousETA: Date | null,
  ) => {
    const order = {
      _id: orderId,
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      riderId: '507f1f77bcf86cd799439011',
      deliveryAddress: {
        address: '123 Main St',
        city: 'Test City',
        pincode: '12345',
        coordinates: { type: 'Point', coordinates: [destLng, destLat] },
      },
      estimatedDeliveryTime: previousETA,
      save: jest.fn().mockResolvedValue(true),
    };
    orderModel.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(order),
    });
    riderModel.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      currentLocation: { type: 'Point', coordinates: [riderLng, riderLat] },
    });
    return order;
  };

  describe('Property 24: ETA Calculation Inputs', () => {
    it('uses rider location as origin and delivery address as destination', async () => {
      const addressArb = fc.record({
        street: fc.string({ minLength: 1, maxLength: 100 }),
        city: fc.string({ minLength: 1, maxLength: 50 }),
        postalCode: fc.string({ minLength: 5, maxLength: 10 }),
        latitude: latitudeArb,
        longitude: longitudeArb,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.record({ latitude: latitudeArb, longitude: longitudeArb }),
          addressArb,
          async (origin: LocationDto, destination: AddressDto) => {
            mockedAxios.get.mockClear();
            await service.calculateETA(origin, destination);

            // Mappls expects "lng,lat;lng,lat" with origin first
            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(mockedAxios.get.mock.calls[0][0]).toBe(
              `${DIRECTIONS_URL}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('uses the driving directions profile with the configured key', async () => {
      await service.calculateETA(riderLocation, deliveryAddress);

      const [url, config] = mockedAxios.get.mock.calls[0];
      expect(url.startsWith(`${DIRECTIONS_URL}/`)).toBe(true);
      expect(url).toContain('/driving/');
      expect(config).toEqual(
        expect.objectContaining({
          params: expect.objectContaining({ access_token: 'test-api-key' }),
        }),
      );
    });
  });

  describe('Property 25: ETA Persistence', () => {
    it('updates order estimatedDeliveryTime after successful recalculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (orderId, riderLat, riderLng, destLat, destLng) => {
            const order = mockOrderAndRider(
              orderId,
              riderLat,
              riderLng,
              destLat,
              destLng,
              null,
            );

            const result = await service.recalculateForOrder(orderId);

            expect(order.estimatedDeliveryTime).toBeInstanceOf(Date);
            expect(order.save).toHaveBeenCalled();
            expect(result).toBe(order.estimatedDeliveryTime);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('calculates future delivery time based on route duration', async () => {
      const before = Date.now();
      const result = await service.calculateETA(riderLocation, deliveryAddress);
      const after = Date.now();

      expect(result.durationMinutes).toBe(20);
      expect(result.distanceMeters).toBe(5000);
      expect(result.estimatedDeliveryTime.getTime()).toBeGreaterThanOrEqual(
        before + 1200 * 1000,
      );
      expect(result.estimatedDeliveryTime.getTime()).toBeLessThanOrEqual(
        after + 1200 * 1000,
      );
    });
  });

  describe('Property 26: ETA Calculation Error Handling', () => {
    it('retains previous ETA when the directions API fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderIdArb,
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (orderId, riderLat, riderLng, destLat, destLng) => {
            const previousETA = new Date(Date.now() + 30 * 60 * 1000);
            const order = mockOrderAndRider(
              orderId,
              riderLat,
              riderLng,
              destLat,
              destLng,
              previousETA,
            );
            mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

            const result = await service.recalculateForOrder(orderId);

            expect(order.estimatedDeliveryTime).toBe(previousETA);
            expect(order.save).not.toHaveBeenCalled();
            expect(result).toBeNull();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('retains previous ETA when the response has no route', async () => {
      const previousETA = new Date(Date.now() + 30 * 60 * 1000);
      const order = mockOrderAndRider(
        'a'.repeat(24),
        28.6,
        77.2,
        28.7,
        77.3,
        previousETA,
      );
      mockedAxios.get.mockResolvedValueOnce({ data: { routes: [] } });

      await expect(
        service.recalculateForOrder('a'.repeat(24)),
      ).resolves.toBeNull();
      expect(order.estimatedDeliveryTime).toBe(previousETA);
      expect(order.save).not.toHaveBeenCalled();
    });

    it('logs and rethrows when the directions API fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('API rate limit exceeded'),
      );
      const loggerSpy = jest.spyOn((service as any).logger, 'error');

      await expect(
        service.calculateETA(riderLocation, deliveryAddress),
      ).rejects.toThrow('API rate limit exceeded');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to calculate ETA'),
      );
      expect(redisService.set).not.toHaveBeenCalled();
    });

    describe('missing API key', () => {
      let keylessService: ETAService;

      beforeEach(() => {
        keylessService = new ETAService(
          { get: jest.fn().mockReturnValue(undefined) } as any,
          redisService as any,
          orderModel as any,
          riderModel as any,
        );
      });

      it('rejects calculateETA without calling the API', async () => {
        await expect(
          keylessService.calculateETA(riderLocation, deliveryAddress),
        ).rejects.toThrow('MAPMYINDIA_API_KEY is not configured');
        // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
        expect(mockedAxios.get).not.toHaveBeenCalled();
      });

      it('recalculateForOrder returns null and keeps previous ETA', async () => {
        const previousETA = new Date(Date.now() + 30 * 60 * 1000);
        const order = mockOrderAndRider(
          'b'.repeat(24),
          28.6,
          77.2,
          28.7,
          77.3,
          previousETA,
        );

        await expect(
          keylessService.recalculateForOrder('b'.repeat(24)),
        ).resolves.toBeNull();
        expect(order.estimatedDeliveryTime).toBe(previousETA);
        expect(order.save).not.toHaveBeenCalled();
      });

      it('falls back to MAPPLS_API_KEY', async () => {
        const fallbackService = new ETAService(
          {
            get: jest.fn((key: string) =>
              key === 'MAPPLS_API_KEY' ? 'fallback-key' : undefined,
            ),
          } as any,
          redisService as any,
          orderModel as any,
          riderModel as any,
        );

        await fallbackService.calculateETA(riderLocation, deliveryAddress);
        expect(mockedAxios.get.mock.calls[0][1]?.params.access_token).toBe(
          'fallback-key',
        );
      });
    });
  });

  describe('Property 34: ETA Response Caching', () => {
    it('uses cached ETA when available instead of calling the API', async () => {
      await fc.assert(
        fc.asyncProperty(
          latitudeArb,
          longitudeArb,
          latitudeArb,
          longitudeArb,
          async (riderLat, riderLng, destLat, destLng) => {
            mockedAxios.get.mockClear();
            const cachedDuration = 1800;
            redisService.get.mockResolvedValueOnce(cachedDuration.toString());

            const result = await service.calculateETA(
              { latitude: riderLat, longitude: riderLng },
              { ...deliveryAddress, latitude: destLat, longitude: destLng },
            );

            // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
            expect(mockedAxios.get).not.toHaveBeenCalled();
            expect(result.durationMinutes).toBe(30);
            expect(result.estimatedDeliveryTime).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('calls API and caches duration on cache miss', async () => {
      await service.calculateETA(riderLocation, deliveryAddress);

      expect(redisService.set).toHaveBeenCalledWith(
        'eta:28.6139:77.2090:28.6304:77.2177',
        '1200',
        30,
      );
    });

    it('continues without caching when Redis fails', async () => {
      redisService.get.mockRejectedValueOnce(new Error('redis down'));
      redisService.set.mockRejectedValueOnce(new Error('redis down'));

      const result = await service.calculateETA(riderLocation, deliveryAddress);
      expect(result.durationMinutes).toBe(20);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a jest mock, not invoking it
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('uses the same cache key for coordinates equal to 4 decimal places', async () => {
      await fc.assert(
        fc.asyncProperty(
          latitudeArb,
          longitudeArb,
          fc.double({ min: -0.00004, max: 0.00004, noNaN: true }),
          async (lat, lng, jitter) => {
            redisService.get.mockClear();
            const base = Number(lat.toFixed(4));
            const nudged = base + jitter;
            // Only meaningful when both round to the same 4-dp value
            fc.pre(nudged.toFixed(4) === base.toFixed(4));

            await service.calculateETA(
              { latitude: base, longitude: lng },
              deliveryAddress,
            );
            await service.calculateETA(
              { latitude: nudged, longitude: lng },
              deliveryAddress,
            );

            const [first, second] = redisService.get.mock.calls.map(
              (call) => call[0],
            );
            expect(first).toBe(second);
            expect(first).toMatch(
              /^eta:-?\d+\.\d{4}:-?\d+\.\d{4}:-?\d+\.\d{4}:-?\d+\.\d{4}$/,
            );
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
