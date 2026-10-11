import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jsonwebtoken from 'jsonwebtoken';
import { AuthService, SessionException } from './auth.service';
import { AuthKeys } from './auth.keys';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserRole } from '../users/schemas/user.schema';

const ACCESS_SECRET = 'a'.repeat(64);
const REFRESH_SECRET = 'r'.repeat(64);
const DAY = 86400;

/** Minimal in-memory Redis stand-in covering what auth uses (records TTLs). */
function createRedisMock() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  const sets = new Map<string, Set<string>>();
  const client = {
    mget: jest.fn((...keys: string[]) =>
      Promise.resolve(keys.map((k) => store.get(k) ?? null)),
    ),
    sadd: jest.fn((key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return Promise.resolve(1);
    }),
    srem: jest.fn((key: string, member: string) => {
      sets.get(key)?.delete(member);
      return Promise.resolve(1);
    }),
    smembers: jest.fn((key: string) =>
      Promise.resolve([...(sets.get(key) ?? [])]),
    ),
    expire: jest.fn(() => Promise.resolve(1)),
    persist: jest.fn(() => Promise.resolve(1)),
  };
  const set = jest.fn((key: string, value: string, ttl?: number) => {
    store.set(key, value);
    ttls.set(key, ttl);
    return Promise.resolve();
  });
  const get = jest.fn((key: string) => Promise.resolve(store.get(key) ?? null));
  return {
    store,
    ttls,
    sets,
    get,
    set,
    getJSON: jest.fn(async (key: string) => {
      const raw = await get(key);
      return raw ? JSON.parse(raw) : null;
    }),
    setJSON: jest.fn((key: string, value: unknown, ttl?: number) =>
      set(key, JSON.stringify(value), ttl),
    ),
    del: jest.fn((key: string) => {
      store.delete(key);
      sets.delete(key);
      return Promise.resolve();
    }),
    getClient: () => client,
  };
}

type RedisMock = ReturnType<typeof createRedisMock>;

/** Session records currently stored (one per signed-in device). */
const sessionKeys = (redis: RedisMock) =>
  [...redis.store.keys()].filter((k) =>
    /^refresh:(customer|admin|rider):/.test(k),
  );

/** Asserts a 401 SessionException carrying `code`. */
async function expectSessionError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SessionException);
  const sessionError = error as SessionException;
  expect(sessionError.code).toBe(code);
  expect(sessionError.getStatus()).toBe(401);
  expect(sessionError.getResponse()).toEqual(expect.objectContaining({ code }));
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redis: RedisMock;
  let configService: ConfigService;
  const usersService = {
    findByPhone: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    create: jest.fn(),
  };
  const ridersService = {
    ensureOtpRider: jest.fn(),
    findRiderById: jest.fn(),
    findByUsername: jest.fn(),
  };
  const otpService = { verifyOtp: jest.fn(), sendOtp: jest.fn() };

  const customer = {
    _id: { toString: () => 'user-1' },
    name: 'Cust',
    phone: '9999999999',
    role: UserRole.CUSTOMER,
    isActive: true,
  };

  const makeService = (jwt: Record<string, unknown> = {}) => {
    configService = new ConfigService({
      jwt: {
        secret: ACCESS_SECRET,
        refreshSecret: REFRESH_SECRET,
        accessTtlSeconds: 900,
        refreshIdleDays: 365,
        adminRefreshIdleDays: 28,
        refreshReuseGraceSeconds: 300,
        ...jwt,
      },
    });
    service = new AuthService(
      usersService as any,
      ridersService as any,
      jwtService,
      configService,
      otpService as any,
      redis as any,
    );
  };

  const accessClaims = (token: string) => jwtService.verify(token);
  const logoutPayload = (token: string) => {
    const p = accessClaims(token);
    return { jti: p.jti, exp: p.exp, sid: p.sid, role: p.role };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redis = createRedisMock();
    jwtService = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { expiresIn: 900 },
    });
    otpService.verifyOtp.mockResolvedValue(true);
    makeService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('verifyOtp', () => {
    it('always creates new OTP users as customers', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(customer);

      await service.verifyOtp('9999999999', '1234', 'Cust');

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.CUSTOMER }),
      );
    });

    it('rejects admin role requests outright', async () => {
      await expect(
        service.verifyOtp('9999999999', '1234', 'x', UserRole.ADMIN as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(otpService.verifyOtp).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('never logs in an existing admin via OTP', async () => {
      usersService.findByPhone.mockResolvedValue({
        ...customer,
        role: UserRole.ADMIN,
      });

      await expect(
        service.verifyOtp('9999999999', '1234'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('logs in an existing rider but never creates one', async () => {
      ridersService.ensureOtpRider.mockRejectedValue(
        new UnauthorizedException(),
      );

      await expect(
        service.verifyOtp('9999999999', '1234', 'R', UserRole.RIDER),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('stores a hash (not the raw token) of the refresh token', async () => {
      usersService.findByPhone.mockResolvedValue(customer);

      const result = await service.verifyOtp('9999999999', '1234');

      const [key] = sessionKeys(redis);
      const sid = accessClaims(result.accessToken).sid;
      expect(key).toBe(AuthKeys.refreshSession('customer', 'user-1', sid));
      const stored = redis.store.get(key) || '';
      expect(stored).toContain(
        createHash('sha256').update(result.refreshToken).digest('hex'),
      );
      expect(stored).not.toContain(result.refreshToken);
    });

    it('issues short-lived access tokens from config', async () => {
      usersService.findByPhone.mockResolvedValue(customer);

      const result = await service.verifyOtp('9999999999', '1234');

      const claims = accessClaims(result.accessToken);
      expect(claims.exp - claims.iat).toBe(900);
    });
  });

  describe('refreshTokens', () => {
    it('rotates tokens without an access token and returns login shape', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      usersService.findById.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');

      const refreshed = await service.refreshTokens(login.refreshToken);

      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      expect(refreshed.refreshToken).not.toEqual(login.refreshToken);
      expect(refreshed.user).toEqual(
        expect.objectContaining({ role: UserRole.CUSTOMER }),
      );

      // Two rotations later the first token is no longer accepted.
      await service.refreshTokens(refreshed.refreshToken);
      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'REFRESH_REUSED',
      );
    });

    it('works for riders by looking up the rider collection', async () => {
      const rider = {
        _id: { toString: () => 'rider-1' },
        name: 'Rider',
        username: 'rider1',
        phone: '+919999999999',
        isActive: true,
      };
      ridersService.ensureOtpRider.mockResolvedValue(rider);
      ridersService.findRiderById.mockResolvedValue(rider);
      const login = await service.verifyOtp(
        '9999999999',
        '1234',
        undefined,
        UserRole.RIDER,
      );

      const refreshed = await service.refreshTokens(login.refreshToken);

      expect(ridersService.findRiderById).toHaveBeenCalledWith('rider-1');
      expect(refreshed.user.role).toBe('rider');
    });

    it('rejects refresh for an account disabled after login', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');
      usersService.findById.mockResolvedValue({
        ...customer,
        isActive: false,
      });

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'SESSION_REVOKED',
      );
      expect(sessionKeys(redis)).toHaveLength(0);
    });

    it('returns USER_NOT_FOUND when the account was deleted', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');
      usersService.findById.mockResolvedValue(null);

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'USER_NOT_FOUND',
      );
    });

    it('revokes the session when the account role changed', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');
      usersService.findById.mockResolvedValue({
        ...customer,
        role: UserRole.ADMIN,
      });

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'SESSION_REVOKED',
      );
    });

    it('rejects an access token used as a refresh token', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');

      await expectSessionError(
        service.refreshTokens(login.accessToken),
        'SESSION_REVOKED',
      );
    });

    it('rejects garbage tokens', async () => {
      await expectSessionError(
        service.refreshTokens('not-a-jwt'),
        'SESSION_REVOKED',
      );
    });

    it('reports SESSION_EXPIRED for a refresh JWT past its exp', async () => {
      const expired = jsonwebtoken.sign(
        {
          sub: 'user-1',
          role: 'customer',
          sid: 's-1',
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        REFRESH_SECRET,
      );

      await expectSessionError(
        service.refreshTokens(expired),
        'SESSION_EXPIRED',
      );
    });
  });

  describe('sliding sessions', () => {
    beforeEach(() => {
      usersService.findByPhone.mockResolvedValue(customer);
      usersService.findById.mockResolvedValue(customer);
    });

    it('resets the idle TTL on every refresh', async () => {
      const login = await service.verifyOtp('9999999999', '1234');
      const [key] = sessionKeys(redis);
      expect(redis.ttls.get(key)).toBe(365 * DAY);

      redis.ttls.set(key, 10); // nearly idle-expired
      const refreshed = await service.refreshTokens(login.refreshToken);

      expect(sessionKeys(redis)).toEqual([key]); // same session id
      expect(redis.ttls.get(key)).toBe(365 * DAY);
      const claims = jwtService.decode(refreshed.refreshToken);
      expect(claims.exp - claims.iat).toBe(365 * DAY);
    });

    it('keeps one session per device', async () => {
      const phone = await service.verifyOtp('9999999999', '1234');
      const tablet = await service.verifyOtp('9999999999', '1234');

      expect(sessionKeys(redis)).toHaveLength(2);
      await expect(
        service.refreshTokens(phone.refreshToken),
      ).resolves.toBeDefined();
      await expect(
        service.refreshTokens(tablet.refreshToken),
      ).resolves.toBeDefined();
    });

    it('uses no Redis TTL and a far JWT exp when idle days is 0', async () => {
      makeService({ refreshIdleDays: 0 });

      const login = await service.verifyOtp('9999999999', '1234');
      const [key] = sessionKeys(redis);
      expect(redis.ttls.get(key)).toBeUndefined();
      const claims = jwtService.decode(login.refreshToken);
      expect(claims.exp - claims.iat).toBeGreaterThan(50 * 365 * DAY);

      const refreshed = await service.refreshTokens(login.refreshToken);
      expect(refreshed.refreshToken).not.toEqual(login.refreshToken);
      expect(redis.ttls.get(key)).toBeUndefined();
    });

    it('gives admins the shorter staff idle timeout', async () => {
      usersService.findByUsername.mockResolvedValue({
        _id: { toString: () => 'admin-1' },
        username: 'admin',
        password: await bcrypt.hash('secret', 4),
        role: UserRole.ADMIN,
        isActive: true,
      });

      await service.adminLogin('admin', 'secret');

      const [key] = sessionKeys(redis);
      expect(key).toMatch(/^refresh:admin:admin-1:/);
      expect(redis.ttls.get(key)).toBe(28 * DAY);
    });

    it('reports SESSION_EXPIRED once the idle record is gone', async () => {
      const login = await service.verifyOtp('9999999999', '1234');
      redis.store.delete(sessionKeys(redis)[0]); // Redis TTL elapsed

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'SESSION_EXPIRED',
      );
    });
  });

  describe('refresh token reuse detection', () => {
    beforeEach(() => {
      usersService.findByPhone.mockResolvedValue(customer);
      usersService.findById.mockResolvedValue(customer);
    });

    it('revokes the session when a rotated token is replayed', async () => {
      const login = await service.verifyOtp('9999999999', '1234');
      const first = await service.refreshTokens(login.refreshToken);
      jest.useFakeTimers({ now: Date.now() + 301_000 }); // past the grace window

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'REFRESH_REUSED',
      );
      // The holder of the newest token is signed out as well.
      await expectSessionError(
        service.refreshTokens(first.refreshToken),
        'SESSION_REVOKED',
      );
      expect(sessionKeys(redis)).toHaveLength(0);
    });

    it('accepts the previous token inside the grace window (lost response)', async () => {
      const login = await service.verifyOtp('9999999999', '1234');
      await service.refreshTokens(login.refreshToken); // response never arrived

      const retried = await service.refreshTokens(login.refreshToken);
      expect(retried.accessToken).toBeDefined();
      await expect(
        service.refreshTokens(retried.refreshToken),
      ).resolves.toBeDefined();
    });

    it('does not let grace-window replays extend the window', async () => {
      const login = await service.verifyOtp('9999999999', '1234');
      await service.refreshTokens(login.refreshToken);
      await service.refreshTokens(login.refreshToken); // within grace
      jest.useFakeTimers({ now: Date.now() + 301_000 });

      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'REFRESH_REUSED',
      );
    });
  });

  describe('legacy refresh tokens', () => {
    it('migrates a pre-session token to a session without logging out', async () => {
      usersService.findById.mockResolvedValue(customer);
      const legacy = jwtService.sign(
        { sub: 'user-1', role: 'customer', type: 'refresh' },
        { secret: REFRESH_SECRET, expiresIn: 3600 },
      );
      redis.store.set(
        AuthKeys.legacyRefreshToken('user-1'),
        createHash('sha256').update(legacy).digest('hex'),
      );

      const result = await service.refreshTokens(legacy);

      expect(jwtService.decode(result.refreshToken).sid).toBeDefined();
      expect(redis.store.has(AuthKeys.legacyRefreshToken('user-1'))).toBe(
        false,
      );
      await expectSessionError(
        service.refreshTokens(legacy),
        'SESSION_EXPIRED',
      );
    });
  });

  describe('logout', () => {
    it('deletes the session and deny-lists the access token', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');
      const strategy = new JwtStrategy(configService, redis as any);
      const payload = accessClaims(login.accessToken);

      // Access token is valid before logout.
      await expect(strategy.validate(payload)).resolves.toEqual(
        expect.objectContaining({ userId: 'user-1', sid: payload.sid }),
      );

      await service.logout('user-1', logoutPayload(login.accessToken));

      expect(sessionKeys(redis)).toHaveLength(0);
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expectSessionError(
        service.refreshTokens(login.refreshToken),
        'SESSION_EXPIRED',
      );
    });

    it('signs out only the current device', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      usersService.findById.mockResolvedValue(customer);
      const phone = await service.verifyOtp('9999999999', '1234');
      const tablet = await service.verifyOtp('9999999999', '1234');

      await service.logout('user-1', logoutPayload(phone.accessToken));

      await expect(
        service.refreshTokens(phone.refreshToken),
      ).rejects.toBeInstanceOf(SessionException);
      await expect(service.refreshTokens(tablet.refreshToken)).resolves.toEqual(
        expect.objectContaining({ accessToken: expect.any(String) }),
      );
    });

    it('logout-all signs out every device and existing access tokens', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      usersService.findById.mockResolvedValue(customer);
      const phone = await service.verifyOtp('9999999999', '1234');
      const tablet = await service.verifyOtp('9999999999', '1234');
      const strategy = new JwtStrategy(configService, redis as any);
      const payload = accessClaims(tablet.accessToken);
      jest.useFakeTimers({ now: Date.now() + 2000 });

      await expect(service.logoutAll('user-1', 'customer')).resolves.toBe(2);

      await expectSessionError(
        service.refreshTokens(phone.refreshToken),
        'SESSION_REVOKED',
      );
      await expectSessionError(
        service.refreshTokens(tablet.refreshToken),
        'SESSION_REVOKED',
      );
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes legacy tokens without jti via revoked-before marker', async () => {
      const strategy = new JwtStrategy(configService, redis as any);
      const legacyPayload = {
        sub: 'user-1',
        role: 'customer',
        iat: Math.floor(Date.now() / 1000) - 60,
      };

      await service.logout('user-1', {});

      await expect(strategy.validate(legacyPayload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('JwtStrategy', () => {
    it('rejects refresh tokens presented as access tokens', async () => {
      const strategy = new JwtStrategy(configService, redis as any);
      await expect(
        strategy.validate({ sub: 'user-1', role: 'customer', type: 'refresh' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
