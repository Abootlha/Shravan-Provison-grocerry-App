import { randomBytes } from 'crypto';

const isProduction = () => process.env.NODE_ENV === 'production';

const MIN_SECRET_LENGTH = 32;

// Dev-only secrets are generated once per process so every module sees the same value.
const devSecrets: Record<string, string> = {};

/**
 * Resolve a required secret from the environment.
 * - production: fail fast at boot if it is missing or too short.
 * - otherwise: fall back to a random per-boot secret and warn loudly
 *   (tokens will not survive a restart until the env var is set).
 */
function requireSecret(name: string): string {
  const value = process.env[name];
  if (value && value.length >= MIN_SECRET_LENGTH) {
    return value;
  }

  if (isProduction()) {
    throw new Error(
      `[config] ${name} must be set to at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }

  if (value) {
    // Short but explicitly set in dev: honour it, but warn.
    console.warn(
      `[config] WARNING: ${name} is shorter than ${MIN_SECRET_LENGTH} characters. Do not use this value in production.`,
    );
    return value;
  }

  if (!devSecrets[name]) {
    devSecrets[name] = randomBytes(48).toString('hex');
    console.warn(
      `[config] WARNING: ${name} is not set. Using a random DEV-ONLY secret for this process; all tokens become invalid on restart. Set ${name} in .env.`,
    );
  }
  return devSecrets[name];
}

/**
 * Parse a JWT-style duration ("900", "15m", "2h", "7d") into seconds.
 * Falls back to `fallbackSeconds` when the value is missing or malformed.
 */
export function parseDurationSeconds(
  value: string | undefined,
  fallbackSeconds: number,
): number {
  const match = /^\s*(\d+)\s*([smhd]?)\s*$/i.exec(value || '');
  if (!match) return fallbackSeconds;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  const seconds = amount * factor;
  return seconds > 0 ? seconds : fallbackSeconds;
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * REDIS_DB: logical Redis database index (default 0). Two environments that
 * share one Redis server (production and development) must use different
 * indexes so sessions, OTPs, caches and BullMQ queues never mix. An invalid
 * value fails the boot instead of silently falling back to database 0.
 */
export function parseRedisDb(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 0;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `[config] REDIS_DB must be a non-negative integer (got "${value}")`,
    );
  }
  return parseInt(trimmed, 10);
}

/**
 * OTP_LENGTH: number of OTP digits, 4-6 (default 4).
 */
export function parseOtpLength(value: string | undefined): number {
  const parsed = parseInt(value || '4', 10);
  return Number.isFinite(parsed) && parsed >= 4 && parsed <= 6 ? parsed : 4;
}

/**
 * OTP_FIXED_CODE: development-only fixed OTP (e.g. 000000). When set, no SMS
 * is sent and this code is accepted. It must never reach production, so a
 * production boot with it set fails here, before anything else starts.
 */
export function parseOtpFixedCode(
  value: string | undefined,
  otpLength: number,
  production: boolean,
): string | undefined {
  const code = (value || '').trim();
  if (!code) return undefined;
  if (production) {
    throw new Error(
      '[config] OTP_FIXED_CODE is set while NODE_ENV=production. A fixed OTP would let anyone log in to any account. Remove OTP_FIXED_CODE from the production environment.',
    );
  }
  if (!/^\d+$/.test(code) || code.length !== otpLength) {
    throw new Error(
      `[config] OTP_FIXED_CODE must be exactly ${otpLength} digits (OTP_LENGTH=${otpLength})`,
    );
  }
  return code;
}

function parseList(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default () => {
  const jwtSecret = requireSecret('JWT_SECRET');
  const jwtRefreshSecret = requireSecret('JWT_REFRESH_SECRET');

  if (isProduction() && jwtSecret === jwtRefreshSecret) {
    throw new Error(
      '[config] JWT_SECRET and JWT_REFRESH_SECRET must be different in production',
    );
  }

  const otpLength = parseOtpLength(process.env.OTP_LENGTH);
  const otpFixedCode = parseOtpFixedCode(
    process.env.OTP_FIXED_CODE,
    otpLength,
    isProduction(),
  );

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shravankirana',
      name: process.env.MONGODB_DB || undefined,
    },

    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      // Logical database index. Use a different one per environment when
      // production and development share a Redis server.
      db: parseRedisDb(process.env.REDIS_DB),
    },

    jwt: {
      secret: jwtSecret,
      // Access tokens are short-lived; clients renew them with the refresh token.
      accessTtlSeconds: parseDurationSeconds(
        process.env.JWT_EXPIRES_IN,
        15 * 60,
      ),
      refreshSecret: jwtRefreshSecret,
      // Sliding idle timeout for customer and rider sessions. Every refresh
      // resets it, so an active user is never logged out. 0 = no idle expiry.
      refreshIdleDays: parseNonNegativeInt(
        process.env.JWT_REFRESH_IDLE_DAYS,
        365,
      ),
      // Staff (admin) sessions keep a shorter idle timeout. 0 is not allowed.
      adminRefreshIdleDays:
        parseNonNegativeInt(process.env.JWT_ADMIN_REFRESH_IDLE_DAYS, 28) || 28,
      // A rotated refresh token presented again within this window (e.g. the
      // client never received the previous response) is accepted once more
      // instead of being treated as theft.
      refreshReuseGraceSeconds: parseNonNegativeInt(
        process.env.JWT_REFRESH_REUSE_GRACE_SECONDS,
        300,
      ),
    },

    cors: {
      // Comma separated list of allowed browser origins (admin panel, website).
      origins: parseList(process.env.CORS_ORIGINS),
    },

    http: {
      // Value for express "trust proxy" (number of hops, or "true"/"false").
      trustProxy: process.env.TRUST_PROXY || '1',
    },

    cache: {
      ttl: {
        products: 300, // 5 minutes
        productDetail: 600, // 10 minutes
        cart: 3600, // 1 hour
        analytics: 600, // 10 minutes
      },
    },

    twofactor: {
      apiKey: process.env.TWOFACTOR_API_KEY || '',
      templateName: process.env.TWOFACTOR_TEMPLATE_NAME || 'OTP1',
      otpExpiry: 300, // 5 minutes in seconds
      // 4-6 digits. send-otp returns it so the apps render the right number of boxes.
      otpLength,
      // Development only (refused in production above): fixed OTP, no SMS sent.
      fixedCode: otpFixedCode,
    },

    store: {
      latitude: parseFloat(process.env.STORE_LATITUDE || '26.7588'),
      longitude: parseFloat(process.env.STORE_LONGITUDE || '83.3700'),
      maxDeliveryKm: parseFloat(process.env.STORE_MAX_DELIVERY_KM || '15'),
    },

    // Cloudflare R2 (S3 API). Optional: scraped product images are stored
    // inline in MongoDB when it is not configured.
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || undefined,
      accessKeyId: process.env.R2_ACCESS_KEY_ID || undefined,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || undefined,
      bucket: process.env.R2_BUCKET || undefined,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || undefined,
      endpoint: process.env.R2_ENDPOINT || undefined,
    },

    // Product scraper (admin > Product scraper).
    scraper: {
      // Replaces competitor support e-mails found in scraped copy.
      storeEmail:
        process.env.SCRAPER_STORE_EMAIL || 'support@shravanprovision.com',
      timeoutMs:
        parseNonNegativeInt(process.env.SCRAPER_TIMEOUT_MS, 30000) || 30000,
      maxImages: Math.min(
        parseNonNegativeInt(process.env.SCRAPER_MAX_IMAGES, 8) || 8,
        15,
      ),
      // auto: use Playwright when installed and a plain fetch is not enough.
      browser: process.env.SCRAPER_BROWSER === 'off' ? 'off' : 'auto',
    },

    // PayU credentials: no defaults. They must come from the environment.
    payu: {
      clientId: process.env.PAYU_CLIENT_ID,
      clientSecret: process.env.PAYU_CLIENT_SECRET,
      key: process.env.PAYU_KEY,
      salt: process.env.PAYU_SALT,
    },
  };
};
