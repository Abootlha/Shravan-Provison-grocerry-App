import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthKeys } from './auth.keys';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserRole } from '../users/schemas/user.schema';

const ACCESS_SECRET = 'a'.repeat(64);
const REFRESH_SECRET = 'r'.repeat(64);

/** Minimal in-memory Redis stand-in covering what auth uses. */
function createRedisMock() {
  const store = new Map<string, string>();
  const client = {
    mget: jest.fn((...keys: string[]) =>
      Promise.resolve(keys.map((k) => store.get(k) ?? null)),
    ),
  };
  return {
    store,
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    getClient: () => client,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redis: ReturnType<typeof createRedisMock>;
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

  beforeEach(() => {
    jest.clearAllMocks();
    redis = createRedisMock();
    jwtService = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { expiresIn: '2h' },
    });
    configService = new ConfigService({
      jwt: { secret: ACCESS_SECRET, refreshSecret: REFRESH_SECRET },
    });
    otpService.verifyOtp.mockResolvedValue(true);
    service = new AuthService(
      usersService as any,
      ridersService as any,
      jwtService,
      configService,
      otpService as any,
      redis as any,
    );
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

      const stored = redis.store.get(AuthKeys.refreshToken('user-1'));
      expect(stored).toBeDefined();
      expect(stored).not.toEqual(result.refreshToken);
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

      // Old refresh token is no longer valid after rotation.
      await expect(
        service.refreshTokens(login.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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

      await expect(
        service.refreshTokens(login.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an access token used as a refresh token', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');

      await expect(
        service.refreshTokens(login.accessToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects garbage tokens', async () => {
      await expect(service.refreshTokens('not-a-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('deletes the refresh token and deny-lists the access token', async () => {
      usersService.findByPhone.mockResolvedValue(customer);
      const login = await service.verifyOtp('9999999999', '1234');
      const strategy = new JwtStrategy(configService, redis as any);
      const payload = jwtService.verify(login.accessToken);

      // Access token is valid before logout.
      await expect(strategy.validate(payload)).resolves.toEqual(
        expect.objectContaining({ userId: 'user-1' }),
      );

      await service.logout('user-1', { jti: payload.jti, exp: payload.exp });

      expect(redis.store.has(AuthKeys.refreshToken('user-1'))).toBe(false);
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        service.refreshTokens(login.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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
