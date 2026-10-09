import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService, OTP_MAX_ATTEMPTS } from './otp.service';
import { AuthKeys } from './auth.keys';

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
});
