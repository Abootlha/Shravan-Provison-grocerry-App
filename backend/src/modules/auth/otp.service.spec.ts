import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService, OTP_MAX_ATTEMPTS } from './otp.service';
import { AuthKeys } from './auth.keys';

const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockAxiosGet(...args) },
}));

function createRedisMock() {
  const store = new Map<string, string>();
  const client = {
    set: jest.fn((key: string, value: string, ...args: any[]) => {
      if (args.includes('NX') && store.has(key)) return Promise.resolve(null);
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    incr: jest.fn((key: string) => {
      const next = Number(store.get(key) || '0') + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
    expire: jest.fn(() => Promise.resolve(1)),
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

describe('OtpService', () => {
  const phone = '9999999999';
  let redis: ReturnType<typeof createRedisMock>;
  let service: OtpService;
  let warnSpy: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    redis = createRedisMock();
    service = new OtpService(
      new ConfigService({ twofactor: { apiKey: '', otpLength: 4 } }),
      redis as any,
    );
    warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
  });

  const storedOtp = () =>
    (redis.store.get(AuthKeys.otpSession(phone)) || '').split(':')[1];

  it('generates a numeric OTP of the configured length', async () => {
    await service.sendOtp(phone);
    expect(storedOtp()).toMatch(/^[0-9]{4}$/);
  });

  it('rate limits sends per phone (30s cooldown)', async () => {
    await service.sendOtp(phone);
    await expect(service.sendOtp(phone)).rejects.toBeInstanceOf(HttpException);
  });

  it('rate limits sends per phone (5 per hour)', async () => {
    for (let i = 0; i < 5; i++) {
      redis.store.delete(AuthKeys.otpCooldown(phone));
      await service.sendOtp(phone);
    }
    redis.store.delete(AuthKeys.otpCooldown(phone));
    await expect(service.sendOtp(phone)).rejects.toMatchObject({
      status: 429,
    });
  });

  it('deletes the OTP on success', async () => {
    await service.sendOtp(phone);
    await expect(service.verifyOtp(phone, storedOtp())).resolves.toBe(true);
    expect(redis.store.has(AuthKeys.otpSession(phone))).toBe(false);
  });

  it(`invalidates the OTP after ${OTP_MAX_ATTEMPTS} wrong attempts`, async () => {
    await service.sendOtp(phone);
    const correct = storedOtp();
    const wrong = correct === '0000' ? '1111' : '0000';

    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await expect(service.verifyOtp(phone, wrong)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }

    // Even the correct code no longer works.
    await expect(service.verifyOtp(phone, correct)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to run without an SMS provider outside development', async () => {
    process.env.NODE_ENV = 'production';
    const prodService = new OtpService(
      new ConfigService({ twofactor: { apiKey: '' } }),
      redis as any,
    );
    jest
      .spyOn((prodService as any).logger, 'error')
      .mockImplementation(() => undefined);
    await expect(prodService.sendOtp(phone)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('returns otpLength in the send response', async () => {
    await expect(service.sendOtp(phone)).resolves.toMatchObject({
      otpLength: 4,
    });
  });

  describe('normal 2Factor path (OTP_FIXED_CODE unset)', () => {
    beforeEach(() => {
      mockAxiosGet.mockReset();
      service = new OtpService(
        new ConfigService({
          twofactor: { apiKey: 'test-key', templateName: 'OTP1', otpLength: 6 },
        }),
        redis as any,
      );
      jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);
    });

    it('sends a random OTP through 2Factor', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { Status: 'Success', Details: 'abc' },
      });
      await expect(service.sendOtp(phone)).resolves.toEqual({
        message: 'OTP sent successfully',
        sessionId: 'abc',
        otpLength: 6,
      });
      const otp = storedOtp();
      expect(otp).toMatch(/^[0-9]{6}$/);
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect(mockAxiosGet.mock.calls[0][0]).toContain(
        `/SMS/${phone}/${otp}/OTP1`,
      );
      await expect(service.verifyOtp(phone, otp)).resolves.toBe(true);
    });
  });

  describe('fixed development OTP (OTP_FIXED_CODE)', () => {
    let fixed: OtpService;
    let fixedWarn: jest.SpyInstance;

    beforeEach(() => {
      mockAxiosGet.mockReset();
      process.env.NODE_ENV = 'development';
      const config = new ConfigService({
        twofactor: { apiKey: 'test-key', otpLength: 6, fixedCode: '000000' },
      });
      fixedWarn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      fixed = new OtpService(config, redis as any);
      jest
        .spyOn((fixed as any).logger, 'log')
        .mockImplementation(() => undefined);
    });

    afterEach(() => fixedWarn.mockRestore());

    it('warns once at construction that SMS is disabled', () => {
      expect(fixedWarn).toHaveBeenCalledTimes(1);
      expect(String(fixedWarn.mock.calls[0][0])).toContain(
        'Fixed OTP mode enabled',
      );
    });

    it('stores the fixed code, does not call 2Factor, and verifies', async () => {
      await expect(fixed.sendOtp(phone)).resolves.toMatchObject({
        otpLength: 6,
      });
      expect(mockAxiosGet).not.toHaveBeenCalled();
      expect(storedOtp()).toBe('000000');
      await expect(fixed.verifyOtp(phone, '000000')).resolves.toBe(true);
    });

    it('keeps the send rate limit', async () => {
      await fixed.sendOtp(phone);
      await expect(fixed.sendOtp(phone)).rejects.toMatchObject({
        status: 429,
      });
    });

    it('counts wrong codes and locks out after the attempt limit', async () => {
      await fixed.sendOtp(phone);
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        await expect(fixed.verifyOtp(phone, '123456')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(redis.store.has(AuthKeys.otpSession(phone))).toBe(false);
      await expect(fixed.verifyOtp(phone, '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('is ignored when NODE_ENV=production (second guard)', async () => {
      process.env.NODE_ENV = 'production';
      mockAxiosGet.mockResolvedValue({
        data: { Status: 'Success', Details: 'abc' },
      });
      const prod = new OtpService(
        new ConfigService({
          twofactor: { apiKey: 'test-key', otpLength: 6, fixedCode: '000000' },
        }),
        redis as any,
      );
      jest
        .spyOn((prod as any).logger, 'log')
        .mockImplementation(() => undefined);
      await prod.sendOtp(phone);
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });
  });
});
