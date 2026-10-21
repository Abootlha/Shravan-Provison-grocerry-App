import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  JobsService,
  RIDER_PRESENCE_QUEUE,
  RIDER_STALE_AFTER_MS,
} from './jobs.service';
import {
  Order,
  OrderSchema,
  OrderStatus,
} from '../orders/schemas/order.schema';
import {
  Rider,
  RiderSchema,
  RiderStatus,
} from '../riders/schemas/rider.schema';
import { OFFER_RESPONSE_TIMEOUT_MS } from '../orders/rider-events';

describe('JobsService rider presence sweep (MongoDB)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let riders: Model<Rider>;
  let orders: Model<Order>;
  let service: JobsService;
  const ordersService = { expireRiderOffer: jest.fn() };
  const riderPush = { notify: jest.fn() };
  const NOW = new Date('2026-10-21T10:00:00Z');

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    riders = connection.model(Rider.name, RiderSchema);
    orders = connection.model(Order.name, OrderSchema);
    service = new JobsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      riders as any,
      orders as any,
      {} as any,
      ordersService as any,
      {} as any,
      { get: () => undefined } as any,
      riderPush as any,
    );
  }, 180000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await riders.deleteMany({});
    await orders.collection.deleteMany({});
    jest.clearAllMocks();
    ordersService.expireRiderOffer.mockResolvedValue({ reassigned: true });
  });

  let seq = 0;
  const rider = (status: RiderStatus, lastActiveAt?: Date) => {
    seq += 1;
    return riders.create({
      name: `Rider ${seq}`,
      username: `rider${seq}`,
      password: 'x',
      phone: `90000000${String(seq).padStart(2, '0')}`,
      status,
      isActive: true,
      lastActiveAt,
    });
  };
  const order = (fields: Record<string, unknown>) =>
    orders.collection.insertOne({
      orderId: `ORD-${new Types.ObjectId().toString()}`,
      updatedAt: NOW,
      ...fields,
    });
  const ago = (ms: number) => new Date(NOW.getTime() - ms);

  it('expires offers left unanswered past the timeout, and only those', async () => {
    const r1 = await rider(RiderStatus.BUSY, NOW);
    const r2 = await rider(RiderStatus.BUSY, NOW);
    const old = await order({
      orderStatus: OrderStatus.CONFIRMED,
      riderId: r1._id,
      riderOfferedAt: ago(OFFER_RESPONSE_TIMEOUT_MS + 1000),
    });
    await order({
      orderStatus: OrderStatus.CONFIRMED,
      riderId: r2._id,
      riderOfferedAt: ago(5_000),
    });
    // Accepted offers are not touched.
    await order({
      orderStatus: OrderStatus.ASSIGNED,
      riderId: r2._id,
      riderOfferedAt: ago(10 * 60_000),
    });

    await expect(service.expireUnansweredOffers(NOW)).resolves.toBe(1);
    expect(ordersService.expireRiderOffer).toHaveBeenCalledTimes(1);
    expect(ordersService.expireRiderOffer).toHaveBeenCalledWith(
      String(old.insertedId),
      String(r1._id),
    );
  });

  it('also expires legacy offers without riderOfferedAt once they are old', async () => {
    const r1 = await rider(RiderStatus.BUSY, NOW);
    await order({
      orderStatus: OrderStatus.CONFIRMED,
      riderId: r1._id,
      updatedAt: ago(OFFER_RESPONSE_TIMEOUT_MS * 2),
    });
    await expect(service.expireUnansweredOffers(NOW)).resolves.toBe(1);
  });

  it('frees busy riders holding no order, keeps those with one', async () => {
    const stuck = await rider(RiderStatus.BUSY, NOW);
    const delivering = await rider(RiderStatus.BUSY, NOW);
    const offered = await rider(RiderStatus.BUSY, NOW);
    await order({
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      riderId: delivering._id,
    });
    await order({ orderStatus: OrderStatus.CONFIRMED, riderId: offered._id });
    await order({ orderStatus: OrderStatus.DELIVERED, riderId: stuck._id });

    await expect(service.releaseIdleBusyRiders()).resolves.toBe(1);
    const status = async (id: unknown) =>
      (await riders.findById(id).lean())!.status;
    expect(await status(stuck._id)).toBe(RiderStatus.AVAILABLE);
    expect(await status(delivering._id)).toBe(RiderStatus.BUSY);
    expect(await status(offered._id)).toBe(RiderStatus.BUSY);
  });

  it('marks available riders unheard from for too long offline and tells them', async () => {
    const gone = await rider(
      RiderStatus.AVAILABLE,
      ago(RIDER_STALE_AFTER_MS + 60_000),
    );
    const fresh = await rider(RiderStatus.AVAILABLE, ago(60_000));
    const busyGone = await rider(
      RiderStatus.BUSY,
      ago(RIDER_STALE_AFTER_MS * 2),
    );

    await expect(service.markStaleRidersOffline(NOW)).resolves.toBe(1);
    const status = async (id: unknown) =>
      (await riders.findById(id).lean())!.status;
    expect(await status(gone._id)).toBe(RiderStatus.OFFLINE);
    expect(await status(fresh._id)).toBe(RiderStatus.AVAILABLE);
    // A busy rider is carrying an order: never dropped by the sweep.
    expect(await status(busyGone._id)).toBe(RiderStatus.BUSY);
    expect(riderPush.notify).toHaveBeenCalledWith(
      String(gone._id),
      expect.objectContaining({ title: 'You are offline' }),
    );
  });

  it('runs every step even when one fails', async () => {
    jest
      .spyOn(service, 'expireUnansweredOffers')
      .mockRejectedValueOnce(new Error('boom'));
    await rider(RiderStatus.BUSY, NOW);
    const result = await service.sweepRiderPresence();
    expect(result).toEqual({
      expiredOffers: 0,
      releasedRiders: 1,
      offlineRiders: 0,
    });
  });

  it('is processed from the rider-presence queue', async () => {
    const sweep = jest.spyOn(service, 'sweepRiderPresence').mockResolvedValue({
      expiredOffers: 0,
      releasedRiders: 0,
      offlineRiders: 0,
    });
    await service.process({ queueName: RIDER_PRESENCE_QUEUE, id: '1' } as any);
    expect(sweep).toHaveBeenCalled();
  });
});
