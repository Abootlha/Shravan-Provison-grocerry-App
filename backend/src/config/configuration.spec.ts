import configuration, {
  parseOtpFixedCode,
  parseOtpLength,
  parseRedisDb,
} from './configuration';

describe('configuration', () => {
  const saved = { ...process.env };
  const secret = 'x'.repeat(40);

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  function prodEnv(extra: Record<string, string>) {
    process.env = {
      ...saved,
      NODE_ENV: 'production',
      JWT_SECRET: secret,
      JWT_REFRESH_SECRET: 'y'.repeat(40),
      ...extra,
    };
  }

  describe('OTP_FIXED_CODE', () => {
    it('refuses to boot in production when set', () => {
      prodEnv({ OTP_FIXED_CODE: '000000', OTP_LENGTH: '6' });
      expect(() => configuration()).toThrow(/OTP_FIXED_CODE.*production/);
    });

    it('is undefined in production when unset', () => {
      prodEnv({ OTP_LENGTH: '6' });
      expect(configuration().twofactor.fixedCode).toBeUndefined();
    });

    it('is loaded in development', () => {
      process.env = {
        ...saved,
        NODE_ENV: 'development',
        OTP_FIXED_CODE: '000000',
        OTP_LENGTH: '6',
      };
      const config = configuration();
      expect(config.twofactor.fixedCode).toBe('000000');
      expect(config.twofactor.otpLength).toBe(6);
    });

    it('must be digits only and match OTP_LENGTH', () => {
      expect(() => parseOtpFixedCode('0000', 6, false)).toThrow(/6 digits/);
      expect(() => parseOtpFixedCode('00a000', 6, false)).toThrow(/6 digits/);
      expect(parseOtpFixedCode('1234', 4, false)).toBe('1234');
      expect(parseOtpFixedCode('  ', 4, true)).toBeUndefined();
    });
  });

  it('OTP_LENGTH accepts 4-6 and defaults to 4', () => {
    expect(parseOtpLength(undefined)).toBe(4);
    expect(parseOtpLength('6')).toBe(6);
    expect(parseOtpLength('8')).toBe(4);
  });

  describe('REDIS_DB', () => {
    it('defaults to 0', () => {
      expect(parseRedisDb(undefined)).toBe(0);
      expect(parseRedisDb('')).toBe(0);
    });

    it('parses an index', () => {
      process.env = { ...saved, NODE_ENV: 'development', REDIS_DB: '1' };
      expect(configuration().redis.db).toBe(1);
    });

    it('rejects invalid values instead of falling back to 0', () => {
      expect(() => parseRedisDb('one')).toThrow(/REDIS_DB/);
      expect(() => parseRedisDb('-1')).toThrow(/REDIS_DB/);
    });
  });
});
