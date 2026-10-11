import { BadRequestException } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AnalyticsService } from './analytics.service';
import {
  Order,
  OrderSchema,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/schemas/order.schema';

describe('AnalyticsService.getRevenueByCategory (MongoDB)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let orderModel: Model<Order>;
  let service: AnalyticsService;

  const fruits = new Types.ObjectId();
  const dairy = new Types.ObjectId();
  const snacks = new Types.ObjectId();
  const apple = new Types.ObjectId();
  const milk = new Types.ObjectId();
  const chips = new Types.ObjectId();
  const day = (iso: string) => new Date(iso);

  const order = (
    items: { productId: any; price: number; quantity: number }[],
    overrides: Record<string, unknown> = {},
  ) => ({
    orderId: `ORD-${new Types.ObjectId().toString()}`,
    userId: new Types.ObjectId(),
    items: items.map((i) => ({ ...i, name: 'x' })),
    itemTotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    deliveryOtp: '1234',
    totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    deliveryAddress: {
      type: 'home',
      address: '12 MG Road',
      city: 'Patna',
      pincode: '800001',
      latitude: 25.6,
      longitude: 85.1,
    },
    paymentMethod: PaymentMethod.COD,
    paymentStatus: PaymentStatus.COMPLETED,
    orderStatus: OrderStatus.DELIVERED,
    createdAt: day('2026-10-05T06:00:00Z'),
    ...overrides,
  });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    orderModel = connection.model<Order>('Order', OrderSchema);
    service = new AnalyticsService(orderModel as any, {} as any, {} as any);
  }, 180000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    const db = connection.db!;
    await Promise.all([
      db.collection('orders').deleteMany({}),
      db.collection('products').deleteMany({}),
      db.collection('categories').deleteMany({}),
    ]);
    await db.collection('categories').insertMany([
      { _id: fruits, name: 'Fruits' },
      { _id: dairy, name: 'Dairy' },
      { _id: snacks, name: 'Snacks' },
    ]);
    await db.collection('products').insertMany([
      { _id: apple, name: 'Apple', categoryId: fruits },
      // Catalogue rows imported with a string categoryId.
      { _id: milk, name: 'Milk', categoryId: dairy.toString() },
      { _id: chips, name: 'Chips', categoryId: snacks },
    ]);
  });

  it('sums delivered/paid order lines per category, including legacy string ids', async () => {
    const db = connection.db!;
    // Legacy rows written while OrderItem.productId was Mixed: string ids.
    await db.collection('orders').insertMany([
      order([
        { productId: apple.toString(), price: 120, quantity: 2 },
        { productId: milk.toString(), price: 30, quantity: 3 },
      ]),
      order([{ productId: apple.toString(), price: 120, quantity: 1 }], {
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        paymentStatus: PaymentStatus.PENDING,
      }),
      // Cancelled and out-of-range orders are excluded.
      order([{ productId: chips.toString(), price: 20, quantity: 5 }], {
        orderStatus: OrderStatus.CANCELLED,
      }),
      order([{ productId: chips.toString(), price: 20, quantity: 5 }], {
        createdAt: day('2026-09-01T06:00:00Z'),
      }),
    ]);
    // New rows are cast by the schema, so productId is stored as an ObjectId.
    // (Inserted raw to skip the user-exists pre-save hook.)
    const fresh = new orderModel(
      order([{ productId: chips.toString(), price: 20, quantity: 4 }]),
    );
    await db.collection('orders').insertOne(fresh.toObject());
    const stored = await db.collection('orders').findOne({
      'items.price': 20,
      'items.quantity': 4,
    });
    expect(stored!.items[0].productId).toBeInstanceOf(Types.ObjectId);

    const rows = await service.getRevenueByCategory(
      day('2026-10-01T00:00:00Z'),
      day('2026-10-07T23:59:59Z'),
    );

    expect(
      rows.map((r) => ({
        id: r._id.toString(),
        categoryName: r.categoryName,
        revenue: r.revenue,
        itemsSold: r.itemsSold,
      })),
    ).toEqual([
      {
        id: fruits.toString(),
        categoryName: 'Fruits',
        revenue: 360,
        itemsSold: 3,
      },
      {
        id: dairy.toString(),
        categoryName: 'Dairy',
        revenue: 90,
        itemsSold: 3,
      },
      {
        id: snacks.toString(),
        categoryName: 'Snacks',
        revenue: 80,
        itemsSold: 4,
      },
    ]);
  });

  it('skips lines whose product no longer exists', async () => {
    await connection.db!.collection('orders').insertOne(
      order([
        { productId: new Types.ObjectId(), price: 50, quantity: 1 },
        { productId: 'not-an-id', price: 50, quantity: 1 },
        { productId: apple, price: 100, quantity: 1 },
      ]),
    );
    const rows = await service.getRevenueByCategory(
      day('2026-10-01T00:00:00Z'),
      day('2026-10-07T23:59:59Z'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoryName: 'Fruits', revenue: 100 });
  });

  it('rejects missing or invalid dates instead of returning []', async () => {
    await expect(
      service.getRevenueByCategory(new Date('nope'), new Date()),
    ).rejects.toThrow(BadRequestException);
  });
});
