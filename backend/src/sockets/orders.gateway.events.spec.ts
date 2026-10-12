/**
 * Integration test for live order events on the /orders namespace: a real
 * Nest app + Socket.IO server, real socket.io-client connections, the real
 * OrdersService publish path and RedisService, with an in-memory pub/sub
 * broker standing in for Redis.
 */
jest.mock('ioredis', () => {
  type Handler = (...args: any[]) => void;
  const broker = {
    subscribers: new Set<any>(),
    failPublish: false,
  };
  class MockRedis {
    static broker = broker;
    channels = new Set<string>();
    handlers: Record<string, Handler[]> = {};
    on(event: string, fn: Handler) {
      (this.handlers[event] ||= []).push(fn);
      return this;
    }
    subscribe(...args: any[]) {
      const cb =
        typeof args[args.length - 1] === 'function' ? args.pop() : null;
      args.forEach((c: string) => this.channels.add(c));
      broker.subscribers.add(this);
      cb?.(null, args.length);
      return Promise.resolve(args.length);
    }
    publish(channel: string, message: string) {
      if (broker.failPublish) {
        return Promise.reject(new Error('Connection is closed.'));
      }
      let delivered = 0;
      for (const sub of broker.subscribers) {
        if (!sub.channels.has(channel)) continue;
        delivered++;
        (sub.handlers.message || []).forEach((h: Handler) =>
          h(channel, message),
        );
      }
      return Promise.resolve(delivered);
    }
    quit() {
      broker.subscribers.delete(this);
      return Promise.resolve('OK');
    }
  }
  return MockRedis;
});

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import * as path from 'path';
import Redis from 'ioredis';
import { RedisService } from '../common/utils/redis.service';
import { OrdersService } from '../modules/orders/orders.service';
import { OrderStatus } from '../modules/orders/schemas/order.schema';
import { OrdersGateway } from './orders.gateway';
import { ORDER_EVENTS_ORIGIN } from './order-events';

// The backend has no runtime dependency on socket.io-client; the admin app
// does. Skip (rather than fail) when neither install provides it.
function loadClient(): { io: (url: string, opts: object) => any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(
      require.resolve('socket.io-client', {
        paths: [__dirname, path.resolve(__dirname, '../../../admin')],
      }),
    );
  } catch {
    return null;
  }
}
const clientLib = loadClient();
const describeIfClient = clientLib ? describe : describe.skip;

// Typed loosely: socket.io-client types are not installed in the backend.
type ClientSocket = any;

const broker = (Redis as any).broker as {
  subscribers: Set<any>;
  failPublish: boolean;
};

describeIfClient('OrdersGateway live events (integration)', () => {
  const secret = 'test-secret';
  const config = new ConfigService({
    nodeEnv: 'test',
    jwt: { secret },
    redis: { host: 'localhost', port: 6379, db: 4 },
  });
  const jwt = new JwtService({ secret });
  const access = {
    findAccessInfoByOrderId: jest.fn((orderId: string) =>
      Promise.resolve(
        orderId === 'ORD-1'
          ? { orderId, userId: 'cust-1', riderId: null }
          : null,
      ),
    ),
  };

  let app: INestApplication;
  let baseUrl: string;
  let ordersService: OrdersService;
  const sockets: ClientSocket[] = [];

  const connect = (sub: string, role: string): Promise<ClientSocket> =>
    new Promise((resolve, reject) => {
      const socket = clientLib!.io(`${baseUrl}/orders`, {
        auth: { token: jwt.sign({ sub, role }) },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const once = <T = any>(socket: ClientSocket, event: string, ms = 2000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${event}`)),
        ms,
      );
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

  /** Resolves with every `event` received within `ms`. */
  const collect = (socket: ClientSocket, event: string, ms = 300) =>
    new Promise<any[]>((resolve) => {
      const seen: any[] = [];
      const fn = (data: any) => seen.push(data);
      socket.on(event, fn);
      setTimeout(() => {
        socket.off(event, fn);
        resolve(seen);
      }, ms);
    });

  const joinAdmin = async (socket: ClientSocket) => {
    const ack = once(socket, 'joinedAdminOrders');
    socket.emit('joinAdminOrders');
    await ack;
  };

  const order = (overrides: Record<string, unknown> = {}) => ({
    _id: '665f00000000000000000001',
    orderId: 'ORD-1',
    orderStatus: OrderStatus.PENDING,
    paymentStatus: 'PENDING',
    paymentMethod: 'COD',
    totalAmount: 120,
    items: [{}, {}],
    userId: 'cust-1',
    riderId: null,
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersGateway,
        { provide: ConfigService, useValue: config },
        { provide: JwtService, useValue: jwt },
        { provide: OrdersService, useValue: access },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    // Real publish path: OrdersService -> RedisService(ioredis) + local bus.
    const nil = undefined as any;
    ordersService = new OrdersService(
      nil,
      nil,
      nil,
      nil,
      nil,
      nil,
      nil,
      new RedisService(config),
      nil,
      nil,
      nil,
    );
    jest
      .spyOn((ordersService as any).logger, 'warn')
      .mockReturnValue(undefined);
  });

  afterEach(() => {
    broker.failPublish = false;
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('delivers order:new and order:updated to admin sockets', async () => {
    const admin = await connect('admin-1', 'admin');
    await joinAdmin(admin);

    const created = once(admin, 'order:new');
    await ordersService.publishAdminOrderEvent('order:new', order());
    expect(await created).toMatchObject({
      orderId: 'ORD-1',
      orderStatus: 'PENDING',
      itemCount: 2,
    });

    const updated = once(admin, 'order:updated');
    await ordersService.publishAdminOrderEvent(
      'order:updated',
      order({ orderStatus: OrderStatus.CONFIRMED, riderId: 'rider-9' }),
    );
    expect(await updated).toMatchObject({
      orderStatus: 'CONFIRMED',
      riderId: 'rider-9',
    });
  });

  it('auto-joins staff on connect (no explicit join needed)', async () => {
    const manager = await connect('mgr-1', 'manager');
    // Let the async handleConnection finish joining the room.
    await new Promise((r) => setTimeout(r, 100));
    const received = once(manager, 'order:new');
    await ordersService.publishAdminOrderEvent('order:new', order());
    await expect(received).resolves.toMatchObject({ orderId: 'ORD-1' });
  });

  it('still delivers in-process when Redis publish fails', async () => {
    const admin = await connect('admin-1', 'admin');
    await joinAdmin(admin);
    broker.failPublish = true;
    const received = once(admin, 'order:new');
    await ordersService.publishAdminOrderEvent('order:new', order());
    await expect(received).resolves.toMatchObject({ orderId: 'ORD-1' });
  });

  it('delivers each event exactly once (Redis echo of own events is skipped)', async () => {
    const admin = await connect('admin-1', 'admin');
    await joinAdmin(admin);
    const seen = collect(admin, 'order:updated');
    await ordersService.publishAdminOrderEvent('order:updated', order());
    expect(await seen).toHaveLength(1);
  });

  it('relays events published by other instances of the same environment only', async () => {
    const admin = await connect('admin-1', 'admin');
    await joinAdmin(admin);
    const seen = collect(admin, 'order:new');
    const publisher = new Redis();
    const message = (origin: string) =>
      JSON.stringify({
        event: 'order:new',
        order: { orderId: 'ORD-R' },
        origin,
      });

    await publisher.publish('test:4:admin-order-events', message('other-pid'));
    await publisher.publish('production:0:admin-order-events', message('prod'));
    await publisher.publish('admin-order-events', message('legacy'));
    await publisher.publish(
      'test:4:admin-order-events',
      message(ORDER_EVENTS_ORIGIN),
    );

    expect(await seen).toEqual([{ orderId: 'ORD-R' }]);
  });

  it('sends statusUpdate to the customer order room, not admin events', async () => {
    const customer = await connect('cust-1', 'customer');
    const joined = once(customer, 'joined');
    customer.emit('joinOrder', 'ORD-1');
    await joined;

    const adminEvents = collect(customer, 'order:new');
    const status = once(customer, 'statusUpdate');
    await (ordersService as any).broadcastOrderEvent('order-updates', {
      orderId: 'ORD-1',
      status: OrderStatus.CONFIRMED,
    });
    await ordersService.publishAdminOrderEvent('order:new', order());

    expect(await status).toEqual({
      orderId: 'ORD-1',
      status: OrderStatus.CONFIRMED,
    });
    expect(await adminEvents).toEqual([]);
  });
});
