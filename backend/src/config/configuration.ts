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

  const otpLength = parseInt(process.env.OTP_LENGTH || '4', 10);

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
    },

    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: jwtRefreshSecret,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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
      // Mobile apps currently render a 4-digit OTP input; raise to 6 once they support it.
      otpLength:
        Number.isFinite(otpLength) && otpLength >= 4 && otpLength <= 6
          ? otpLength
          : 4,
    },

    store: {
      latitude: parseFloat(process.env.STORE_LATITUDE || '26.7588'),
      longitude: parseFloat(process.env.STORE_LONGITUDE || '83.3700'),
      maxDeliveryKm: parseFloat(process.env.STORE_MAX_DELIVERY_KM || '15'),
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
