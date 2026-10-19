import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { BadRequestException } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { WsJwtGuard } from '../modules/auth/guards/ws-jwt.guard';
import { AuthKeys } from '../modules/auth/auth.keys';

const SECRET = 'test-secret';

describe('TrackingGateway connection auth and rider events', () => {
  const jwtService = new JwtService({ secret: SECRET });
  const redisStore = new Map<string, string>();
  const redisClient = {
    mget: jest.fn((...keys: string[]) =>
      Promise.resolve(keys.map((k) => redisStore.get(k) ?? null)),
    ),
  };
  const redisService = { getClient: () => redisClient } as any;
  const ridersService = { updateLocation: jest.fn() };
  const ordersService = {} as any;

  let gateway: TrackingGateway;
  let middleware: (socket: any, next: (err?: any) => void) => void;
  const roomEmits: { rooms: unknown; event: string; payload: unknown }[] = [];
  const socketsLeave = jest.fn();
  const inRoom = jest.fn();

  const sign = (payload: Record<string, unknown>, expiresIn = 900) =>
    jwtService.sign(payload, { expiresIn });

  const makeSocket = (token?: string) => ({
    id: 'sock-1',
    handshake: { auth: token ? { token } : {}, query: {}, headers: {} },
    data: {} as Record<string, any>,
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
  });

  const runMiddleware = (socket: any) =>
    new Promise<any>((resolve) => middleware(socket, resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    roomEmits.length = 0;
    gateway = new TrackingGateway(
      ordersService,
      ridersService as any,
      jwtService,
      redisService,
    );
    jest.spyOn((gateway as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((gateway as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((gateway as any).logger, 'error').mockImplementation(() => {});
    inRoom.mockReturnValue({
      socketsLeave,
      fetchSockets: () => Promise.resolve([]),
    });
    gateway.server = {
      use: jest.fn((fn) => {
        middleware = fn;
      }),
      to: jest.fn((rooms: unknown) => ({
        emit: (event: string, payload: unknown) =>
          roomEmits.push({ rooms, event, payload }),
      })),
      in: inRoom,
    } as any;
    gateway.afterInit(gateway.server);
  });

  describe('handshake', () => {
    it('accepts a valid access token and stores the user', async () => {
      const socket = makeSocket(sign({ sub: 'u1', role: 'customer' }));
      await expect(runMiddleware(socket)).resolves.toBeUndefined();
      expect(socket.data.user).toMatchObject({
        userId: 'u1',
        role: 'customer',
      });
    });

    it.each([
      ['no token', undefined, 'TOKEN_MISSING'],
      ['a malformed token', 'not-a-jwt', 'TOKEN_INVALID'],
      [
        'a refresh token',
        () => sign({ sub: 'u1', role: 'customer', type: 'refresh' }),
        'REFRESH_TOKEN_NOT_ALLOWED',
      ],
      [
        'an expired token',
        () => sign({ sub: 'u1', role: 'customer' }, -10),
        'TOKEN_EXPIRED',
      ],
    ])('rejects %s with connect_error data', async (_l, token, code) => {
      const value = typeof token === 'function' ? token() : token;
      const err = await runMiddleware(makeSocket(value));
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('unauthorized');
      expect(err.data).toEqual({ code, message: expect.any(String) });
    });

    it('rejects a logged-out access token (denylisted jti)', async () => {
      redisStore.set(AuthKeys.accessDenylist('j1'), '1');
      const err = await runMiddleware(
        makeSocket(sign({ sub: 'u1', role: 'customer', jti: 'j1' })),
      );
      expect(err.data.code).toBe('TOKEN_REVOKED');
    });

    it('rejects tokens issued before logout-all', async () => {
      const token = sign({ sub: 'u1', role: 'customer' });
      redisStore.set(
        AuthKeys.revokedBefore('u1'),
        String(Math.floor(Date.now() / 1000) + 5),
      );
      const err = await runMiddleware(makeSocket(token));
      expect(err.data.code).toBe('TOKEN_REVOKED');
    });

    it('does not ask clients to refresh when Redis is down', async () => {
      redisClient.mget.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const err = await runMiddleware(
        makeSocket(sign({ sub: 'u1', role: 'customer' })),
      );
      expect(err.message).toBe('auth_unavailable');
    });
  });

  describe('handleConnection', () => {
    it('auto-joins riders to their rider room', async () => {
      const socket = makeSocket(sign({ sub: 'r1', role: 'rider' }));
      await runMiddleware(socket);
      await gateway.handleConnection(socket as any);
      expect(socket.join).toHaveBeenCalledWith('rider_r1');
      gateway.handleDisconnect(socket as any);
    });

    it('closes unauthenticated sockets with auth_error when no middleware ran', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as any);
      expect(socket.emit).toHaveBeenCalledWith('auth_error', {
        code: 'TOKEN_MISSING',
        message: expect.any(String),
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('closes the socket with auth_error when the token expires', async () => {
      jest.useFakeTimers();
      try {
        const socket = makeSocket(sign({ sub: 'u1', role: 'customer' }, 60));
        await runMiddleware(socket);
        await gateway.handleConnection(socket as any);
        expect(socket.disconnect).not.toHaveBeenCalled();
        jest.advanceTimersByTime(61_000);
        expect(socket.emit).toHaveBeenCalledWith('auth_error', {
          code: 'TOKEN_EXPIRED',
          message: expect.any(String),
        });
        expect(socket.disconnect).toHaveBeenCalledWith(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('WsJwtGuard (per message)', () => {
    const guard = new WsJwtGuard(jwtService, redisService);
    const ctx = (socket: any) =>
      ({ switchToWs: () => ({ getClient: () => socket }) }) as any;

    it('passes a valid token', async () => {
      const socket = makeSocket(sign({ sub: 'u1', role: 'customer' }));
      await expect(guard.canActivate(ctx(socket))).resolves.toBe(true);
    });

    it('emits auth_error and disconnects when the session was revoked', async () => {
      const socket = makeSocket(sign({ sub: 'u1', role: 'rider', jti: 'j9' }));
      redisStore.set(AuthKeys.accessDenylist('j9'), '1');
      await expect(guard.canActivate(ctx(socket))).rejects.toBeInstanceOf(
        WsException,
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'auth_error',
        expect.objectContaining({ code: 'TOKEN_REVOKED' }),
      );
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects refresh tokens', async () => {
      const socket = makeSocket(
        sign({ sub: 'u1', role: 'rider', type: 'refresh' }),
      );
      await expect(guard.canActivate(ctx(socket))).rejects.toBeInstanceOf(
        WsException,
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'auth_error',
        expect.objectContaining({ code: 'REFRESH_TOKEN_NOT_ALLOWED' }),
      );
    });
  });

  describe('riderLocationUpdate', () => {
    const riderSocket = () => {
      const socket = makeSocket();
      socket.data.user = { userId: 'r1', role: 'rider' };
      return socket;
    };

    it('accepts 0 as a coordinate and delegates broadcasting to the service', async () => {
      ridersService.updateLocation.mockResolvedValue({ throttled: false });
      const socket = riderSocket();
      await gateway.handleRiderLocationUpdate(socket as any, {
        latitude: 0,
        longitude: 0,
        heading: -1,
      });
      expect(ridersService.updateLocation).toHaveBeenCalledTimes(1);
      expect(ridersService.updateLocation).toHaveBeenCalledWith('r1', {
        latitude: 0,
        longitude: 0,
        accuracy: undefined,
        heading: undefined,
        speed: undefined,
      });
      // No second broadcast from the gateway itself.
      expect(roomEmits).toHaveLength(0);
      expect(socket.emit).toHaveBeenCalledWith(
        'locationUpdateAck',
        expect.objectContaining({ success: true, throttled: false }),
      );
    });

    it('acknowledges throttled updates instead of failing', async () => {
      ridersService.updateLocation.mockResolvedValue({ throttled: true });
      const socket = riderSocket();
      await gateway.handleRiderLocationUpdate(socket as any, {
        latitude: 26.7,
        longitude: 83.4,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'locationUpdateAck',
        expect.objectContaining({ success: true, throttled: true }),
      );
    });

    it.each([
      [{ longitude: 10 }],
      [{ latitude: 91, longitude: 10 }],
      [{ latitude: 'abc', longitude: 10 }],
    ])('rejects invalid coordinates %j', async (payload) => {
      await expect(
        gateway.handleRiderLocationUpdate(riderSocket() as any, payload as any),
      ).rejects.toBeInstanceOf(WsException);
      expect(ridersService.updateLocation).not.toHaveBeenCalled();
    });

    it('surfaces service validation errors as WsException', async () => {
      ridersService.updateLocation.mockRejectedValue(
        new BadRequestException('Rider not found'),
      );
      await expect(
        gateway.handleRiderLocationUpdate(riderSocket() as any, {
          latitude: 1,
          longitude: 1,
        }),
      ).rejects.toThrow('Rider not found');
    });

    it('refuses non-riders', async () => {
      const socket = makeSocket();
      socket.data.user = { userId: 'u1', role: 'customer' };
      await expect(
        gateway.handleRiderLocationUpdate(socket as any, {
          latitude: 1,
          longitude: 1,
        }),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('rider room notifications', () => {
    const order = { _id: { toString: () => 'o1' }, orderId: 'ORD-1' };

    it('sends orderCancelled to the rider room and removes them from the order room', () => {
      gateway.notifyRiderOrderCancelled('r1', order, 'Customer cancelled');
      const events = roomEmits.filter((e) => e.rooms === 'rider_r1');
      expect(events.map((e) => e.event)).toEqual([
        'orderCancelled',
        'order.cancelled',
      ]);
      expect(events[0].payload).toMatchObject({
        orderId: 'o1',
        orderNumber: 'ORD-1',
        status: 'CANCELLED',
        reason: 'Customer cancelled',
      });
      expect(inRoom).toHaveBeenCalledWith('rider_r1');
      expect(socketsLeave).toHaveBeenCalledWith('order_o1');
    });

    it('sends orderUnassigned with the reason', () => {
      gateway.notifyRiderOrderUnassigned('r1', order, 'rider_rejected');
      expect(roomEmits[0]).toMatchObject({
        rooms: 'rider_r1',
        event: 'orderUnassigned',
        payload: { orderId: 'o1', reason: 'rider_rejected' },
      });
      expect(socketsLeave).toHaveBeenCalledWith('order_o1');
    });

    it('sends status updates to the assigned rider room too, without the OTP', () => {
      gateway.broadcastOrderStatusUpdate('o1', {
        orderStatus: 'PACKED',
        rider: { id: 'r1' },
        deliveryOtp: '1234',
      });
      const status = roomEmits.find((e) => e.event === 'orderStatusUpdate');
      expect(status?.rooms).toEqual(['order_o1', 'rider_r1']);
      expect((status?.payload as any).order.deliveryOtp).toBeUndefined();
    });
  });
});
