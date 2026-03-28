import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as fc from 'fast-check';
import { CreateOrderDto, OrderItemDto, AddressDto } from './create-order.dto';
import { PaymentMethod, PaymentStatus } from '../schemas/order.schema';

// Custom generator for MongoDB ObjectId (24 hex characters)
const objectIdArb = fc
  .string({ minLength: 24, maxLength: 24 })
  .map((s) =>
    s
      .split('')
      .map((c) => '0123456789abcdef'[c.charCodeAt(0) % 16])
      .join('')
  );

describe('CreateOrderDto Property Tests', () => {
  describe('Property 28: Order Creation Validation', () => {
    /**
     * **Validates: Requirements 9.1**
     *
     * For any order creation request, the system must validate all fields using
     * class-validator decorators and reject requests with invalid items, negative
     * totalAmount, invalid deliveryAddress coordinates, or invalid paymentStatus enum values.
     */

    it('should accept valid order creation data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                productId: objectIdArb,
                name: fc.string({ minLength: 1, maxLength: 100 }),
                quantity: fc.integer({ min: 1, max: 100 }),
                price: fc.float({
                  min: Math.fround(0),
                  max: Math.fround(10000),
                  noNaN: true,
                }),
                image: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
                  nil: undefined,
                }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
            itemTotal: fc.float({
              min: Math.fround(0),
              max: Math.fround(100000),
              noNaN: true,
            }),
            deliveryFee: fc.option(
              fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
              { nil: undefined }
            ),
            packagingFee: fc.option(
              fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }),
              { nil: undefined }
            ),
            discount: fc.option(
              fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
              { nil: undefined }
            ),
            totalAmount: fc.float({
              min: Math.fround(0),
              max: Math.fround(100000),
              noNaN: true,
            }),
            deliveryAddress: fc.record({
              type: fc.constantFrom('Home', 'Work', 'Other'),
              address: fc.string({ minLength: 5, maxLength: 200 }),
              city: fc.string({ minLength: 2, maxLength: 50 }),
              pincode: fc.string({ minLength: 6, maxLength: 6 }),
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
            }),
            paymentMethod: fc.constantFrom(...Object.values(PaymentMethod)),
            paymentStatus: fc.constantFrom(...Object.values(PaymentStatus)),
            deliveryInstructions: fc.option(
              fc.string({ minLength: 1, maxLength: 500 }),
              { nil: undefined }
            ),
          }),
          async (orderData) => {
            const dto = plainToInstance(CreateOrderDto, orderData);
            const errors = await validate(dto);

            // Valid data should have no validation errors
            expect(errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject orders with negative totalAmount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                productId: objectIdArb,
                name: fc.string({ minLength: 1, maxLength: 100 }),
                quantity: fc.integer({ min: 1, max: 100 }),
                price: fc.float({
                  min: Math.fround(0),
                  max: Math.fround(10000),
                  noNaN: true,
                }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
            itemTotal: fc.float({
              min: Math.fround(0),
              max: Math.fround(100000),
              noNaN: true,
            }),
            totalAmount: fc.float({
              min: Math.fround(-10000),
              max: Math.fround(-0.01),
              noNaN: true,
            }), // Negative amount
            deliveryAddress: fc.record({
              type: fc.constantFrom('Home', 'Work', 'Other'),
              address: fc.string({ minLength: 5, maxLength: 200 }),
              city: fc.string({ minLength: 2, maxLength: 50 }),
              pincode: fc.string({ minLength: 6, maxLength: 6 }),
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
            }),
            paymentMethod: fc.constantFrom(...Object.values(PaymentMethod)),
            paymentStatus: fc.constantFrom(...Object.values(PaymentStatus)),
          }),
          async (orderData) => {
            const dto = plainToInstance(CreateOrderDto, orderData);
            const errors = await validate(dto);

            // Should have validation error for negative totalAmount
            expect(errors.length).toBeGreaterThan(0);
            const totalAmountError = errors.find((e) => e.property === 'totalAmount');
            expect(totalAmountError).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject orders with invalid coordinate ranges', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                productId: objectIdArb,
                name: fc.string({ minLength: 1, maxLength: 100 }),
                quantity: fc.integer({ min: 1, max: 100 }),
                price: fc.float({
                  min: Math.fround(0),
                  max: Math.fround(10000),
                  noNaN: true,
                }),
              }),
              { minLength: 1, maxLength: 10 }
            ),
            itemTotal: fc.float({
              min: Math.fround(0),
              max: Math.fround(100000),
              noNaN: true,
            }),
            totalAmount: fc.float({
              min: Math.fround(0),
              max: Math.fround(100000),
              noNaN: true,
            }),
            deliveryAddress: fc.record({
              type: fc.constantFrom('Home', 'Work', 'Other'),
              address: fc.string({ minLength: 5, maxLength: 200 }),
              city: fc.string({ minLength: 2, maxLength: 50 }),
              pincode: fc.string({ minLength: 6, maxLength: 6 }),
              latitude: fc.oneof(
                fc.float({ min: Math.fround(90.01), max: Math.fround(200), noNaN: true }), // > 90
                fc.float({ min: Math.fround(-200), max: Math.fround(-90.01), noNaN: true }) // < -90
              ),
              longitude: fc.float({
                min: Math.fround(-180),
                max: Math.fround(180),
                noNaN: true,
              }),
            }),
            paymentMethod: fc.constantFrom(...Object.values(PaymentMethod)),
            paymentStatus: fc.constantFrom(...Object.values(PaymentStatus)),
          }),
          async (orderData) => {
            const dto = plainToInstance(CreateOrderDto, orderData);
            const errors = await validate(dto);

            // Should have validation error for invalid latitude
            expect(errors.length).toBeGreaterThan(0);
            const addressError = errors.find((e) => e.property === 'deliveryAddress');
            expect(addressError).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject orders with empty items array', async () => {
      const orderData = {
        items: [], // Empty array
        itemTotal: 100,
        totalAmount: 100,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          latitude: 40.7128,
          longitude: -74.006,
        },
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
      };

      const dto = plainToInstance(CreateOrderDto, orderData);
      const errors = await validate(dto);

      // Should have validation error for empty items array
      expect(errors.length).toBeGreaterThan(0);
      const itemsError = errors.find((e) => e.property === 'items');
      expect(itemsError).toBeDefined();
    });

    it('should reject orders with invalid payment status enum', async () => {
      const orderData = {
        items: [
          {
            productId: '507f1f77bcf86cd799439011',
            name: 'Test Product',
            quantity: 1,
            price: 100,
          },
        ],
        itemTotal: 100,
        totalAmount: 100,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          latitude: 40.7128,
          longitude: -74.006,
        },
        paymentMethod: PaymentMethod.COD,
        paymentStatus: 'INVALID_STATUS', // Invalid enum value
      };

      const dto = plainToInstance(CreateOrderDto, orderData);
      const errors = await validate(dto);

      // Should have validation error for invalid payment status
      expect(errors.length).toBeGreaterThan(0);
      const paymentStatusError = errors.find((e) => e.property === 'paymentStatus');
      expect(paymentStatusError).toBeDefined();
    });
  });
});
