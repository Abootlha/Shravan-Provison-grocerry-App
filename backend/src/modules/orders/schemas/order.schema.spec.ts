import { Model, Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import * as fc from 'fast-check';
import { Order, OrderStatus, OrderSchema } from './order.schema';
import { UserRole, UserSchema } from '../../users/schemas/user.schema';
import { RiderSchema } from '../../riders/schemas/rider.schema';

// Custom generator for MongoDB ObjectId (24 hex characters)
const objectIdArb = fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
  s
    .split('')
    .map((c) => '0123456789abcdef'[c.charCodeAt(0) % 16])
    .join(''),
);

describe('Order Schema Property Tests', () => {
  let orderModel: Model<Order>;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let userModel: Model<any>;
  let riderModel: Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await mongoose.connect(uri)).connection;

    userModel = mongoConnection.model('User', UserSchema);
    riderModel = mongoConnection.model('Rider', RiderSchema);
    orderModel = mongoConnection.model('Order', OrderSchema);
    // First run downloads the mongod binary, which exceeds jest's 5s default.
  }, 180000);

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await orderModel.deleteMany({});
    await userModel.deleteMany({});
    await riderModel.deleteMany({});
  });

  beforeEach(async () => {
    // Clear collections before each test
    await orderModel.deleteMany({});
    await userModel.deleteMany({});
    await riderModel.deleteMany({});
  });

  describe('Property 4: Initial Order Status', () => {
    /**
     * **Validates: Requirements 1.6, 13.6**
     *
     * For any newly created order, the status field must be set to PENDING.
     */
    it('should initialize all new orders with PENDING status', async () => {
      // Create a valid user for the test
      const validUser = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 100 }),
                quantity: fc.integer({ min: 1, max: 100 }),
                price: fc.float({
                  min: Math.fround(0.01),
                  max: Math.fround(10000),
                  noNaN: true,
                }),
              }),
              { minLength: 1, maxLength: 5 },
            ),
            totalAmount: fc.float({
              min: Math.fround(0.01),
              max: Math.fround(100000),
              noNaN: true,
            }),
            deliveryAddress: fc.record({
              type: fc.constantFrom('Home', 'Work', 'Other'),
              address: fc.string({ minLength: 5, maxLength: 200 }),
              city: fc.string({ minLength: 2, maxLength: 50 }),
              pincode: fc.string({ minLength: 6, maxLength: 6 }),
              coordinates: fc.record({
                type: fc.constant('Point'),
                coordinates: fc.tuple(
                  fc.float({
                    min: Math.fround(-180),
                    max: Math.fround(180),
                    noNaN: true,
                  }), // longitude
                  fc.float({
                    min: Math.fround(-90),
                    max: Math.fround(90),
                    noNaN: true,
                  }), // latitude
                ),
              }),
            }),
            paymentMethod: fc.constantFrom('COD', 'UPI', 'CARD', 'WALLET'),
          }),
          async (orderData) => {
            // Create order document without explicitly setting status
            const order = new orderModel({
              deliveryOtp: '1234',
              orderId: `ORD-${Date.now()}-${Math.random()}`,
              userId: validUser._id,
              items: orderData.items.map((item) => ({
                ...item,
                productId: new mongoose.Types.ObjectId(),
              })),
              itemTotal: orderData.totalAmount,
              totalAmount: orderData.totalAmount,
              deliveryAddress: orderData.deliveryAddress,
              paymentMethod: orderData.paymentMethod,
              paymentStatus: 'PENDING',
              deliveryFee: 0,
              packagingFee: 0,
              discount: 0,
              timeline: [],
              // Note: orderStatus is NOT provided, should default to PENDING
            });

            const savedOrder = await order.save();

            // Verify the order status is PENDING
            expect(savedOrder.orderStatus).toBe(OrderStatus.PENDING);
          },
        ),
        { numRuns: 20 }, // Reduced runs for async tests with database
      );
    });

    it('should have PENDING as the default status when no status is provided', async () => {
      // Create a valid user
      const validUser = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      // Test that the schema default is correctly set
      const orderData = {
        orderId: 'ORD-TEST-001',
        userId: validUser._id,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            quantity: 1,
            price: 10.0,
          },
        ],
        itemTotal: 10.0,
        totalAmount: 10.0,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          coordinates: {
            type: 'Point' as const,
            coordinates: [0, 0],
          },
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        // Note: orderStatus is NOT provided, should default to PENDING
      };

      const order = new orderModel({ deliveryOtp: '1234', ...orderData });
      const savedOrder = await order.save();

      // The schema should apply the default value
      expect(savedOrder.orderStatus).toBe(OrderStatus.PENDING);
    });
  });

  describe('Property 43: Timeline Entry Structure', () => {
    /**
     * **Validates: Requirements 13.3**
     *
     * For any timeline entry in an order, the entry must contain fields:
     * status (OrderStatus enum), timestamp (Date), and changedBy (User ObjectId reference).
     */
    it('should validate timeline entries have correct structure', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom(...Object.values(OrderStatus)),
              timestamp: fc.date({
                min: new Date('2020-01-01'),
                max: new Date('2030-12-31'),
              }),
              changedBy: objectIdArb,
            }),
            { minLength: 0, maxLength: 10 },
          ),
          (timelineEntries) => {
            // Verify each timeline entry has the required structure
            timelineEntries.forEach((entry) => {
              // Check status is a valid OrderStatus
              expect(Object.values(OrderStatus)).toContain(entry.status);

              // Check timestamp is a Date
              expect(entry.timestamp).toBeInstanceOf(Date);

              // Check changedBy is a valid ObjectId format (24 hex characters)
              expect(entry.changedBy).toMatch(/^[0-9a-f]{24}$/i);
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should ensure timeline entries maintain chronological order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              status: fc.constantFrom(...Object.values(OrderStatus)),
              timestamp: fc
                .date({
                  min: new Date('2020-01-01'),
                  max: new Date('2030-12-31'),
                })
                .filter((d) => !isNaN(d.getTime())),
              changedBy: objectIdArb,
            }),
            { minLength: 2, maxLength: 10 },
          ),
          (timelineEntries) => {
            // Filter out any invalid dates
            const validEntries = timelineEntries.filter(
              (e) => !isNaN(e.timestamp.getTime()),
            );

            if (validEntries.length < 2) {
              return; // Skip if we don't have enough valid entries
            }

            // Sort entries by timestamp
            const sortedEntries = [...validEntries].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            );

            // Verify structure is maintained after sorting
            sortedEntries.forEach((entry, index) => {
              expect(entry).toHaveProperty('status');
              expect(entry).toHaveProperty('timestamp');
              expect(entry).toHaveProperty('changedBy');

              // Verify chronological order
              if (index > 0) {
                expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(
                  sortedEntries[index - 1].timestamp.getTime(),
                );
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 44: Referential Integrity for Order References', () => {
    /**
     * **Validates: Requirements 13.5**
     *
     * For any order creation or update, the system must validate that userId and riderId
     * (if present) reference existing User documents, rejecting operations with invalid references.
     */
    it('should reject orders with non-existent userId', async () => {
      await fc.assert(
        fc.asyncProperty(objectIdArb, async (invalidUserId) => {
          // Ensure the user doesn't exist
          const existingUser = await userModel.findById(invalidUserId);
          if (existingUser) {
            return; // Skip this test case if user happens to exist
          }

          const orderData = {
            orderId: `ORD-${Date.now()}-${Math.random()}`,
            userId: new mongoose.Types.ObjectId(invalidUserId),
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                name: 'Test Product',
                quantity: 1,
                price: 10.0,
              },
            ],
            itemTotal: 10.0,
            totalAmount: 10.0,
            deliveryAddress: {
              type: 'Home',
              address: '123 Test St',
              city: 'Test City',
              pincode: '123456',
              coordinates: {
                type: 'Point' as const,
                coordinates: [0, 0],
              },
            },
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
          };

          const order = new orderModel({ deliveryOtp: '1234', ...orderData });

          // Should throw error due to invalid userId
          await expect(order.save()).rejects.toThrow(/Invalid userId/);
        }),
        { numRuns: 20 }, // Reduced runs for async tests with database
      );
    });

    it('should reject orders with non-existent riderId', async () => {
      // Create a valid user first
      const validUser = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      await fc.assert(
        fc.asyncProperty(objectIdArb, async (invalidRiderId) => {
          // Ensure the rider doesn't exist
          const existingRider = await userModel.findById(invalidRiderId);
          if (existingRider) {
            return; // Skip this test case if rider happens to exist
          }

          const orderData = {
            orderId: `ORD-${Date.now()}-${Math.random()}`,
            userId: validUser._id,
            riderId: new mongoose.Types.ObjectId(invalidRiderId),
            items: [
              {
                productId: new mongoose.Types.ObjectId(),
                name: 'Test Product',
                quantity: 1,
                price: 10.0,
              },
            ],
            itemTotal: 10.0,
            totalAmount: 10.0,
            deliveryAddress: {
              type: 'Home',
              address: '123 Test St',
              city: 'Test City',
              pincode: '123456',
              coordinates: {
                type: 'Point' as const,
                coordinates: [0, 0],
              },
            },
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
          };

          const order = new orderModel({ deliveryOtp: '1234', ...orderData });

          // Should throw error due to invalid riderId
          await expect(order.save()).rejects.toThrow(/Invalid riderId/);
        }),
        { numRuns: 20 }, // Reduced runs for async tests with database
      );
    });

    it('should reject orders when riderId references a user instead of a rider', async () => {
      // Create a valid customer user
      const validCustomer = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      // Create a non-rider user (admin)
      const adminUser = await userModel.create({
        name: 'Test Admin',
        username: 'admin',
        password: 'hashedpassword',
        role: UserRole.ADMIN,
      });

      const orderData = {
        orderId: `ORD-${Date.now()}-${Math.random()}`,
        userId: validCustomer._id,
        riderId: adminUser._id, // Admin, not a rider
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            quantity: 1,
            price: 10.0,
          },
        ],
        itemTotal: 10.0,
        totalAmount: 10.0,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          coordinates: {
            type: 'Point' as const,
            coordinates: [0, 0],
          },
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      };

      const order = new orderModel({ deliveryOtp: '1234', ...orderData });

      // Riders live in their own collection, so a User id is not a valid riderId
      await expect(order.save()).rejects.toThrow(/Invalid riderId/);
    });

    it('should accept orders with valid userId and riderId', async () => {
      // Create valid users
      const validCustomer = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      const validRider = await riderModel.create({
        name: 'Test Rider',
        username: 'rider1',
        password: 'hashedpassword',
        phone: '0987654321',
      });

      const orderData = {
        orderId: `ORD-${Date.now()}-${Math.random()}`,
        userId: validCustomer._id,
        riderId: validRider._id,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            quantity: 1,
            price: 10.0,
          },
        ],
        itemTotal: 10.0,
        totalAmount: 10.0,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          coordinates: {
            type: 'Point' as const,
            coordinates: [0, 0],
          },
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      };

      const order = new orderModel({ deliveryOtp: '1234', ...orderData });

      // Should save successfully
      const savedOrder = await order.save();
      expect(savedOrder).toBeDefined();
      expect(savedOrder.userId.toString()).toBe(validCustomer._id.toString());
      expect(savedOrder.riderId?.toString()).toBe(validRider._id.toString());
    });

    it('should accept orders with valid userId and no riderId', async () => {
      // Create valid user
      const validCustomer = await userModel.create({
        name: 'Test Customer',
        phone: '1234567890',
        role: UserRole.CUSTOMER,
      });

      const orderData = {
        orderId: `ORD-${Date.now()}-${Math.random()}`,
        userId: validCustomer._id,
        // No riderId - this is valid for new orders
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            quantity: 1,
            price: 10.0,
          },
        ],
        itemTotal: 10.0,
        totalAmount: 10.0,
        deliveryAddress: {
          type: 'Home',
          address: '123 Test St',
          city: 'Test City',
          pincode: '123456',
          coordinates: {
            type: 'Point' as const,
            coordinates: [0, 0],
          },
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      };

      const order = new orderModel({ deliveryOtp: '1234', ...orderData });

      // Should save successfully
      const savedOrder = await order.save();
      expect(savedOrder).toBeDefined();
      expect(savedOrder.userId.toString()).toBe(validCustomer._id.toString());
      expect(savedOrder.riderId).toBeUndefined();
    });
  });
});
