const clients: Record<string, jest.Mock>[] = [];
let connectImpl: () => Promise<void> = () => Promise.resolve();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => {
    const make = () => {
      const client: Record<string, jest.Mock> = {
        on: jest.fn(),
        connect: jest.fn(() => connectImpl()),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn(),
      };
      client.duplicate = jest.fn(() => make());
      clients.push(client);
      return client;
    };
    return make();
  }),
);
jest.mock('@socket.io/redis-adapter', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Adapter } = require('socket.io-adapter');
  class FakeRedisAdapter extends Adapter {}
  return { FakeRedisAdapter, createAdapter: jest.fn(() => FakeRedisAdapter) };
});

import { createServer } from 'http';
import { ConfigService } from '@nestjs/config';
import * as redisAdapterModule from '@socket.io/redis-adapter';
import { RedisIoAdapter } from './redis-io.adapter';

const FakeRedisAdapter = (redisAdapterModule as any).FakeRedisAdapter;

describe('RedisIoAdapter', () => {
  const config = new ConfigService({
    nodeEnv: 'test',
    redis: { host: 'localhost', port: 6379, db: 2 },
  });

  const quiet = (adapter: RedisIoAdapter) => {
    for (const level of ['log', 'warn'] as const) {
      jest
        .spyOn((adapter as any).logger, level)
        .mockImplementation(() => undefined);
    }
  };

  beforeEach(() => {
    clients.length = 0;
    connectImpl = () => Promise.resolve();
  });

  it('registers error listeners on both clients so Redis errors cannot crash the app', async () => {
    const adapter = new RedisIoAdapter(createServer() as any, config);
    quiet(adapter);
    await adapter.connectToRedis();
    expect(clients).toHaveLength(2);
    for (const client of clients) {
      expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
    }
    await adapter.dispose();
  });

  it('applies the Redis adapter to the root server and closes clients on dispose', async () => {
    const adapter = new RedisIoAdapter(createServer() as any, config);
    quiet(adapter);
    await expect(adapter.connectToRedis()).resolves.toBe(true);
    expect(adapter.isRedisEnabled).toBe(true);

    const server = adapter.createIOServer(0);
    expect(server.adapter()).toBe(FakeRedisAdapter);
    expect(server.of('/tracking').adapter).toBeInstanceOf(FakeRedisAdapter);
    server.close();

    await adapter.dispose();
    for (const client of clients) {
      expect(client.quit).toHaveBeenCalled();
    }
  });

  it('falls back to the in-memory adapter when Redis is unreachable', async () => {
    connectImpl = () => Promise.reject(new Error('ECONNREFUSED'));
    const adapter = new RedisIoAdapter(createServer() as any, config);
    quiet(adapter);

    await expect(adapter.connectToRedis()).resolves.toBe(false);
    expect(adapter.isRedisEnabled).toBe(false);
    for (const client of clients) {
      expect(client.disconnect).toHaveBeenCalled();
    }

    const server = adapter.createIOServer(0);
    expect(server.adapter()).not.toBe(FakeRedisAdapter);
    server.close();
    await expect(adapter.dispose()).resolves.toBeUndefined();
  });
});
