const redisCtor = jest.fn();
jest.mock('ioredis', () =>
  jest.fn().mockImplementation((options: unknown) => {
    redisCtor(options);
    const client: Record<string, jest.Mock> = {
      subscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn(),
    };
    client.duplicate = jest.fn(() => client);
    return client;
  }),
);
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => 'adapter'),
}));

import { ConfigService } from '@nestjs/config';
import { redisConnectionOptions } from './redis-options';
import { RedisService } from '../common/utils/redis.service';
import { OrdersGateway } from '../sockets/orders.gateway';
import { TrackingGateway } from '../sockets/tracking.gateway';

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
    new OrdersGateway(config, {} as any, {} as any);
    expect(redisCtor).toHaveBeenCalledWith(expect.objectContaining({ db: 1 }));
  });

  it('TrackingGateway adapter connects to the configured db', () => {
    const gateway = new TrackingGateway(
      {} as any,
      {} as any,
      {} as any,
      config,
    );
    jest
      .spyOn((gateway as any).logger, 'log')
      .mockImplementation(() => undefined);
    gateway.afterInit({ adapter: jest.fn() } as any);
    expect(redisCtor).toHaveBeenCalledWith(expect.objectContaining({ db: 1 }));
  });
});
