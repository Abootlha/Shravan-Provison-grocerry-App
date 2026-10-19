const redisCtor = jest.fn();
jest.mock('ioredis', () =>
  jest.fn().mockImplementation((options: unknown) => {
    redisCtor(options);
    const client: Record<string, jest.Mock> = {
      subscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };
    client.duplicate = jest.fn(() => client);
    return client;
  }),
);
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => 'adapter'),
}));

import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisConnectionOptions, scopedPubSubChannel } from './redis-options';
import { RedisService } from '../common/utils/redis.service';
import { OrdersGateway } from '../sockets/orders.gateway';
import { RedisIoAdapter } from '../sockets/redis-io.adapter';

describe('Redis database isolation (REDIS_DB)', () => {
  const config = new ConfigService({
    redis: { host: 'redis.local', port: 6380, password: 'pw', db: 1 },
  });

  beforeEach(() => redisCtor.mockClear());

  it('builds options with the configured db', () => {
    expect(redisConnectionOptions(config)).toEqual({
      host: 'redis.local',
      port: 6380,
      password: 'pw',
      db: 1,
    });
  });

  it('defaults db to 0', () => {
    expect(redisConnectionOptions(new ConfigService({})).db).toBe(0);
  });

  it('RedisService connects to the configured db', () => {
    new RedisService(config);
    expect(redisCtor).toHaveBeenCalledWith(expect.objectContaining({ db: 1 }));
  });

  it('OrdersGateway subscriber connects to the configured db', () => {
    const gateway = new OrdersGateway(config, {} as any, {} as any);
    jest
      .spyOn((gateway as any).logger, 'log')
      .mockImplementation(() => undefined);
    gateway.afterInit();
    gateway.onModuleDestroy();
    expect(redisCtor).toHaveBeenCalledWith(expect.objectContaining({ db: 1 }));
  });

  it('Socket.IO RedisIoAdapter connects to the configured db with an env-scoped key', async () => {
    const adapter = new RedisIoAdapter({} as any, config);
    jest
      .spyOn((adapter as any).logger, 'log')
      .mockImplementation(() => undefined);
    await expect(adapter.connectToRedis()).resolves.toBe(true);
    expect(redisCtor).toHaveBeenCalledWith(expect.objectContaining({ db: 1 }));
    expect(createAdapter).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { key: scopedPubSubChannel(config, 'socket.io') },
    );
    await adapter.dispose();
  });
});
