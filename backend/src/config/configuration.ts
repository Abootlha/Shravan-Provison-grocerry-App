export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shravankirana',
    name: process.env.MONGODB_DB || undefined,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  jwt: {
    secret:
      process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'your-refresh-secret-key-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
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
    otpExpiry: 300, // 5 minutes in seconds
  },

  store: {
    latitude: parseFloat(process.env.STORE_LATITUDE || '26.7588'),
    longitude: parseFloat(process.env.STORE_LONGITUDE || '83.3700'),
    maxDeliveryKm: parseFloat(process.env.STORE_MAX_DELIVERY_KM || '15'),
  },

  payu: {
    clientId:
      process.env.PAYU_CLIENT_ID ||
      '8cf73f4d61894b252fa55459c6ec592aa8da7850e019f4e35b2177bc8df6cfaa',
    clientSecret:
      process.env.PAYU_CLIENT_SECRET ||
      'bc4ef4e4a5bb72c75bb6a1c61fc7cf5cd1039a79e521bd0d77d3fd0e2516dbc2',
  },
});
