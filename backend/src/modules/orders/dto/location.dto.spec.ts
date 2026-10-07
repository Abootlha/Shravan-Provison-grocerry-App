import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { LocationDto } from './location.dto';

describe('LocationDto Property Tests', () => {
  describe('Property 31: Location Coordinate Validation', () => {
    /**
     * **Validates: Requirements 9.8**
     *
     * For any location update, the system must validate that latitude is in range
     * [-90, 90] and longitude is in range [-180, 180], rejecting updates with
     * out-of-range values.
     */

    it('should accept valid coordinates within range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: fc.float({
              min: Math.fround(-90),
              max: Math.fround(90),
              noNaN: true,
            }),
            longitude: fc.float({
              min: Math.fround(-180),
              max: Math.fround(180),
              noNaN: true,
            }),
            accuracy: fc.option(
              fc.float({
                min: Math.fround(0),
                max: Math.fround(1000),
                noNaN: true,
              }),
              { nil: undefined },
            ),
          }),
          async (locationData) => {
            const dto = plainToInstance(LocationDto, locationData);
            const errors = await validate(dto);

            // Valid coordinates should have no validation errors
            expect(errors).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject latitude values outside [-90, 90] range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: fc.oneof(
              fc.float({
                min: Math.fround(90.01),
                max: Math.fround(200),
                noNaN: true,
              }), // > 90
              fc.float({
                min: Math.fround(-200),
                max: Math.fround(-90.01),
                noNaN: true,
              }), // < -90
            ),
            longitude: fc.float({
              min: Math.fround(-180),
              max: Math.fround(180),
              noNaN: true,
            }),
          }),
          async (locationData) => {
            const dto = plainToInstance(LocationDto, locationData);
            const errors = await validate(dto);

            // Should have validation error for out-of-range latitude
            expect(errors.length).toBeGreaterThan(0);
            const latitudeError = errors.find((e) => e.property === 'latitude');
            expect(latitudeError).toBeDefined();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should reject longitude values outside [-180, 180] range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: fc.float({
              min: Math.fround(-90),
              max: Math.fround(90),
              noNaN: true,
            }),
            longitude: fc.oneof(
              fc.float({
                min: Math.fround(180.01),
                max: Math.fround(360),
                noNaN: true,
              }), // > 180
              fc.float({
                min: Math.fround(-360),
                max: Math.fround(-180.01),
                noNaN: true,
              }), // < -180
            ),
          }),
          async (locationData) => {
            const dto = plainToInstance(LocationDto, locationData);
            const errors = await validate(dto);

            // Should have validation error for out-of-range longitude
            expect(errors.length).toBeGreaterThan(0);
            const longitudeError = errors.find(
              (e) => e.property === 'longitude',
            );
            expect(longitudeError).toBeDefined();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should accept boundary values for coordinates', async () => {
      const boundaryTests = [
        { latitude: -90, longitude: -180 },
        { latitude: -90, longitude: 180 },
        { latitude: 90, longitude: -180 },
        { latitude: 90, longitude: 180 },
        { latitude: 0, longitude: 0 },
      ];

      for (const locationData of boundaryTests) {
        const dto = plainToInstance(LocationDto, locationData);
        const errors = await validate(dto);

        // Boundary values should be valid
        expect(errors).toHaveLength(0);
      }
    });

    it('should accept optional accuracy field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            latitude: fc.float({
              min: Math.fround(-90),
              max: Math.fround(90),
              noNaN: true,
            }),
            longitude: fc.float({
              min: Math.fround(-180),
              max: Math.fround(180),
              noNaN: true,
            }),
            accuracy: fc.float({
              min: Math.fround(0),
              max: Math.fround(1000),
              noNaN: true,
            }),
          }),
          async (locationData) => {
            const dto = plainToInstance(LocationDto, locationData);
            const errors = await validate(dto);

            // Valid location with accuracy should have no errors
            expect(errors).toHaveLength(0);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should reject negative accuracy values', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: -10, // Negative accuracy
      };

      const dto = plainToInstance(LocationDto, locationData);
      const errors = await validate(dto);

      // Should have validation error for negative accuracy
      expect(errors.length).toBeGreaterThan(0);
      const accuracyError = errors.find((e) => e.property === 'accuracy');
      expect(accuracyError).toBeDefined();
    });

    it('should work without accuracy field', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.006,
        // accuracy is optional
      };

      const dto = plainToInstance(LocationDto, locationData);
      const errors = await validate(dto);

      // Should be valid without accuracy
      expect(errors).toHaveLength(0);
    });
  });
});
