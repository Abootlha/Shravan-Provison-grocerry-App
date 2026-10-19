import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import {
  redisConnectionOptions,
  scopedPubSubChannel,
} from '../config/redis-options';

const CONNECT_TIMEOUT_MS = 5000;

type AdapterConstructor = ReturnType<typeof createAdapter>;

/**
 * Socket.IO adapter that shares rooms across backend instances through Redis
 * pub/sub, so an event emitted on one process reaches sockets connected to
 * another (PM2 cluster, several containers).
 *
 * The adapter has to be applied to the root Server when it is created: the
 * gateways only see their Namespace, which has no adapter() setter.
 *
 * If Redis cannot be reached at startup the app keeps running on the default
 * in-memory adapter (correct for a single instance) instead of crashing.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: AdapterConstructor;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  /** True when rooms are shared through Redis. */
  get isRedisEnabled(): boolean {
    return !!this.adapterConstructor;
  }

  /**
   * Connects the pub/sub clients. Never throws: on failure it logs, closes
   * the clients and leaves the in-memory adapter in place.
   */
  async connectToRedis(): Promise<boolean> {
    const options = redisConnectionOptions(this.configService);
    const pubClient = new Redis({
      ...options,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    const subClient = pubClient.duplicate();

    // Without listeners ioredis reports connection errors as unhandled
    // 'error' events, which crash the process.
    let healthy = true;
    const onError = (role: string) => (err: Error) => {
      if (healthy) {
        this.logger.warn(
          `Socket.IO Redis ${role} client error: ${err.message}`,
        );
      }
      healthy = false;
    };
    const onReady = () => {
      healthy = true;
    };
    pubClient.on('error', onError('pub'));
    subClient.on('error', onError('sub'));
    pubClient.on('ready', onReady);
    subClient.on('ready', onReady);

    try {
      await withTimeout(
        Promise.all([pubClient.connect(), subClient.connect()]),
        CONNECT_TIMEOUT_MS,
      );
    } catch (error) {
      this.logger.warn(
        `Socket.IO Redis adapter disabled, using in-memory rooms (single instance only): ${(error as Error).message}`,
      );
      pubClient.disconnect();
      subClient.disconnect();
      return false;
    }

    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient, {
      // Channels are global to the Redis server; scope them per environment.
      key: scopedPubSubChannel(this.configService, 'socket.io'),
    });
    this.logger.log(
      `Socket.IO Redis adapter enabled at ${options.host}:${options.port} (db ${options.db})`,
    );
    return true;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  /** Called by Nest on app shutdown, after the servers are closed. */
  async dispose(): Promise<void> {
    await super.dispose();
    const clients = [this.pubClient, this.subClient];
    this.pubClient = undefined;
    this.subClient = undefined;
    await Promise.all(
      clients
        .filter((client): client is Redis => !!client)
        .map((client) =>
          client.quit().catch(() => {
            client.disconnect();
          }),
        ),
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis connection timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
