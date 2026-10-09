export default () => ({
    HTTP_PORT: parseInt(process.env.HTTP_PORT || '3006', 10),
    GRPC_PORT: parseInt(process.env.GRPC_PORT || '5006', 10),
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/cart-svc',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    cache: {
        ttl: {
            cart: 3600,
        },
    },
});
