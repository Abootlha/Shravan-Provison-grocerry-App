export default () => ({
    HTTP_PORT: parseInt(process.env.HTTP_PORT || '3005', 10),
    GRPC_PORT: parseInt(process.env.GRPC_PORT || '5005', 10),
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/product-svc',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    cache: {
        ttl: {
            products: 300,
            productDetail: 600,
            categories: 3600,
        },
    },
});
