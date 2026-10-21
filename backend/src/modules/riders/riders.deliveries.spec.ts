import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { Connection, Model, Types } from 'mongoose';
import { RidersService } from './riders.service';
import {
  Order,
  OrderSchema,
  OrderStatus,
} from '../orders/schemas/order.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

describe('RidersService.getDeliveries (MongoDB)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let orders: Model<Order>;
  let users: Model<User>;
  let service: RidersService;
  const riderId = new Types.ObjectId();
  const otherRider = new Types.ObjectId();
  // 21 Oct 2026, 17:00 IST. The IST day started at 20 Oct 18:30 UTC.
  const NOW = new Date('2026-10-21T11:30:00Z');

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    orders = connection.model(Order.name, OrderSchema);
    users = connection.model(User.name, UserSchema);
    service = new RidersService(
      {} as any,
      orders as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }, 180000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await orders.collection.deleteMany({});
    await users.collection.deleteMany({});
  });

  const insert = async (fields: Record<string, unknown>) => {
    const user = await users.collection.insertOne({
      name: 'Priya Srivastava',
      phone: `+9190000${Math.floor(Math.random() * 1e5)}`,
      role: 'customer',
    });
    return orders.collection.insertOne({
      orderId: `ORD-${new Types.ObjectId().toString()}`,
      userId: user.insertedId,
      riderId,
      orderStatus: OrderStatus.DELIVERED,
      items: [
        {
          productId: new Types.ObjectId(),
          name: 'Anik Ghee (100 ml)',
          quantity: 1,
          price: 54,
          image: 'https://cdn.test/ghee.jpg',
        },
        {
          productId: new Types.ObjectId(),
          name: 'Bourbon',
          quantity: 2,
          price: 18,
        },
      ],
      totalAmount: 98,
      deliveryFee: 25,
      paymentMethod: 'COD',
      deliveryAddress: {
        type: 'home',
        address: 'Golghar Chauraha',
        city: 'Gorakhpur',
        pincode: '273001',
        landmark: 'Near the clock tower',
      },
      timeline: [
        {
          status: OrderStatus.ASSIGNED,
          timestamp: new Date('2026-10-21T10:20:00Z'),
        },
        {
          status: OrderStatus.PICKED_UP,
          timestamp: new Date('2026-10-21T10:30:00Z'),
        },
        {
          status: OrderStatus.DELIVERED,
          timestamp: new Date('2026-10-21T10:48:00Z'),
        },
      ],
      actualDeliveryTime: new Date('2026-10-21T10:48:00Z'),
      ...fields,
    });
  };

  it("lists today's deliveries with the details behind the totals", async () => {
    const first = await insert({});
    await insert({
      paymentMethod: 'UPI',
      tip: 10,
      actualDeliveryTime: new Date('2026-10-21T09:00:00Z'),
    });
    // Delivered yesterday (IST) and by another rider: not today's / not mine.
    await insert({ actualDeliveryTime: new Date('2026-10-20T18:00:00Z') });
    await insert({ riderId: otherRider });
    // Still on the way: not a completed delivery.
    await insert({
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      actualDeliveryTime: undefined,
    });

    const res = await service.getDeliveries(
      String(riderId),
      { period: 'today' },
      NOW,
    );
    expect(res.total).toBe(2);
    expect(res.totals).toEqual({
      deliveries: 2,
      earnings: 60,
      cashCollected: 98,
    });

    const [latest, earlier] = res.deliveries;
    expect(latest).toMatchObject({
      id: String(first.insertedId),
      customerName: 'Priya Srivastava',
      address: {
        full: 'Golghar Chauraha',
        city: 'Gorakhpur',
        pincode: '273001',
        landmark: 'Near the clock tower',
      },
      itemCount: 3,
      totalAmount: 98,
      paymentMethod: 'COD',
      cashCollected: 98,
      earning: { deliveryFee: 25, tip: 0, total: 25 },
      tripMinutes: 28,
    });
    expect(latest.items[0]).toEqual({
      name: 'Anik Ghee (100 ml)',
      quantity: 1,
      price: 54,
      image: 'https://cdn.test/ghee.jpg',
    });
    expect(earlier).toMatchObject({
      paymentMethod: 'UPI',
      cashCollected: 0,
      earning: { total: 35 },
    });
  });

  it('a week view includes earlier days of the week', async () => {
    await insert({});
    await insert({ actualDeliveryTime: new Date('2026-10-20T18:00:00Z') });
    const res = await service.getDeliveries(
      String(riderId),
      { period: 'week' },
      NOW,
    );
    expect(res.total).toBe(2);
  });

  it('pages newest first', async () => {
    for (let h = 1; h <= 3; h++) {
      await insert({ actualDeliveryTime: new Date(`2026-10-21T0${h}:00:00Z`) });
    }
    const p1 = await service.getDeliveries(
      String(riderId),
      { period: 'today', limit: 2 },
      NOW,
    );
    const p2 = await service.getDeliveries(
      String(riderId),
      { period: 'today', limit: 2, page: 2 },
      NOW,
    );
    expect(p1.totalPages).toBe(2);
    expect(p1.deliveries.map((d) => d.deliveredAt!.toISOString())).toEqual([
      '2026-10-21T03:00:00.000Z',
      '2026-10-21T02:00:00.000Z',
    ]);
    expect(p2.deliveries).toHaveLength(1);
  });
});
