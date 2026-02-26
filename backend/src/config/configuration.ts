export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),

    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shravankirana',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
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
});
