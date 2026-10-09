# Real-Time Order Tracking System - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Customer App Setup](#customer-app-setup)
4. [Admin Dashboard Setup](#admin-dashboard-setup)
5. [Database Configuration](#database-configuration)
6. [Redis Configuration](#redis-configuration)
7. [Socket.io Scaling](#socketio-scaling)
8. [Production Deployment](#production-deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying the Real-Time Order Tracking System, ensure you have:

### Required Software
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **MongoDB**: v6.x or higher
- **Redis**: v7.x or higher

### Required Services
- **Google Maps API Key**: For Distance Matrix API and Maps display
- **MongoDB Database**: Local or cloud (MongoDB Atlas)
- **Redis Server**: Local or cloud (Redis Cloud, AWS ElastiCache)

### Development Tools
- **Git**: For version control
- **Docker** (optional): For containerized deployment
- **PM2** (optional): For process management in production

---

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/shravankirana

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production-minimum-32-chars
JWT_EXPIRES_IN=7d

# Google Maps API (Required for Order Tracking)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Socket.io Configuration
SOCKET_IO_CORS_ORIGIN=http://localhost:3000,http://localhost:19006

# Order Tracking Configuration
STALE_ORDER_THRESHOLD_MINUTES=10
ANOMALY_THRESHOLD_HOURS=2
ETA_RECALC_INTERVAL_MINUTES=5

# Performance Configuration
REDIS_CACHE_TTL_SECONDS=300
ETA_CACHE_TTL_SECONDS=120
LOCATION_THROTTLE_SECONDS=5
MAX_CONCURRENT_JOBS=5
```

### 3. Build the Backend

```bash
npm run build
```

### 4. Start the Backend

**Development Mode:**
```bash
npm run start:dev
```

**Production Mode:**
```bash
npm run start:prod
```

### 5. Verify Backend is Running

```bash
curl http://localhost:3000/health
# Expected response: {"status":"ok"}
```

---

## Customer App Setup

### 1. Install Dependencies

```bash
# From project root
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# API Configuration
API_BASE_URL=http://localhost:3000
SOCKET_URL=http://localhost:3000

# For development on physical device, use your local IP
# Example: API_BASE_URL=http://192.168.1.100:3000

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Socket.io Configuration
SOCKET_RECONNECTION_ATTEMPTS=5
SOCKET_RECONNECTION_DELAY=1000

# Feature Flags
ENABLE_ORDER_TRACKING=true
```

### 3. Start the Development Server

**Using Expo:**
```bash
npx expo start
```

**Run on iOS:**
```bash
npm run ios
```

**Run on Android:**
```bash
npm run android
```

**Run on Web:**
```bash
npm run web
```

### 4. Build for Production

**iOS:**
```bash
eas build --platform ios
```

**Android:**
```bash
eas build --platform android
```

---

## Admin Dashboard Setup

### 1. Install Dependencies

```bash
cd admin
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# API Configuration
PUBLIC_API_BASE_URL=http://localhost:3000
PUBLIC_SOCKET_URL=http://localhost:3000

# Google Maps API Key
PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Socket.io Configuration
PUBLIC_SOCKET_RECONNECTION_ATTEMPTS=5
PUBLIC_SOCKET_RECONNECTION_DELAY=1000

# Feature Flags
PUBLIC_ENABLE_RIDER_TRACKING=true
PUBLIC_ENABLE_REAL_TIME_UPDATES=true
```

**Note:** In Astro, all environment variables exposed to the client must be prefixed with `PUBLIC_`.

### 3. Start the Development Server

```bash
npm run dev
```

The admin dashboard will be available at `http://localhost:4321`

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
npm run preview
```

---

## Database Configuration

### 1. MongoDB Setup

#### Local MongoDB

**Install MongoDB:**

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:6
```

#### MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Configure network access (whitelist your IP)
4. Create database user
5. Get connection string and update `MONGODB_URI` in `.env`

### 2. Create Database Indexes

The order tracking system requires specific indexes for optimal performance.

Create a script `backend/scripts/create-indexes.js`:

```javascript
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // Orders collection indexes
        await db.collection('orders').createIndex({ userId: 1 });
        await db.collection('orders').createIndex({ status: 1 });
        await db.collection('orders').createIndex({ riderId: 1 });
        await db.collection('orders').createIndex({ status: 1, createdAt: 1 });
        await db.collection('orders').createIndex({ 
            'deliveryAddress.coordinates': '2dsphere' 
        });

        console.log('✅ Orders indexes created');

        // Users collection indexes (for riders)
        await db.collection('users').createIndex({ role: 1 });
        await db.collection('users').createIndex({ isOnline: 1, isAvailable: 1 });
        await db.collection('users').createIndex({ 
            currentLocation: '2dsphere' 
        });

        console.log('✅ Users/Riders indexes created');

        console.log('✅ All indexes created successfully');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        process.exit(1);
    }
}

createIndexes();
```

Run the script:

```bash
node backend/scripts/create-indexes.js
```

### 3. Verify Indexes

```javascript
// In MongoDB shell or script
db.orders.getIndexes()
db.users.getIndexes()
```

Expected indexes for orders:
- `_id` (default)
- `userId`
- `status`
- `riderId`
- `{ status: 1, createdAt: 1 }` (compound)
- `deliveryAddress.coordinates` (2dsphere)

Expected indexes for users/riders:
- `_id` (default)
- `role`
- `{ isOnline: 1, isAvailable: 1 }` (compound)
- `currentLocation` (2dsphere)

---

## Redis Configuration

### 1. Redis Setup

#### Local Redis

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

#### Redis Cloud

1. Create account at [Redis Cloud](https://redis.com/try-free/)
2. Create a new database
3. Get connection details (host, port, password)
4. Update Redis configuration in `.env`:

```env
REDIS_HOST=your-redis-host.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://:your-redis-password@your-redis-host.cloud.redislabs.com:12345
```

### 2. Redis for BullMQ (Background Jobs)

BullMQ uses Redis for job queue management. The configuration is automatically handled by the backend.

**Job Queues:**
- `stale-order-check`: Runs every 2 minutes
- `anomaly-check`: Runs every 10 minutes
- `eta-recalculation`: Runs every 5 minutes

**Job Configuration:**
- Retry attempts: 3
- Backoff strategy: Exponential (2s, 4s, 8s)
- Max concurrent jobs: 5

### 3. Redis for Caching

The system uses Redis for:

**Order Caching:**
- Key format: `order:{orderId}`
- TTL: 300 seconds (5 minutes)
- Invalidated on status updates

**ETA Caching:**
- Key format: `eta:{riderLat}:{riderLng}:{destLat}:{destLng}`
- TTL: 120 seconds (2 minutes)

**Location Throttling:**
- Key format: `rider:location:throttle:{riderId}`
- TTL: 5 seconds

### 4. Verify Redis Connection

```bash
redis-cli ping
# Expected: PONG
```

Test Redis operations:

```bash
redis-cli
> SET test "Hello Redis"
> GET test
> DEL test
> QUIT
```

### 5. Monitor Redis

```bash
# Monitor all commands
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli client list
```

---

## Socket.io Scaling

### Single Instance Deployment

For small to medium deployments, a single backend instance is sufficient. No additional configuration needed.

### Multi-Instance Deployment (Horizontal Scaling)

For high-traffic deployments, you can run multiple backend instances behind a load balancer.

#### 1. Install Redis Adapter

```bash
cd backend
npm install @socket.io/redis-adapter
```

#### 2. Configure Redis Adapter

Update `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Configure Redis adapter for Socket.io
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    app.useWebSocketAdapter(new IoAdapter(app));
    const io = app.get('socket.io');
    io.adapter(createAdapter(pubClient, subClient));

    await app.listen(3000);
}
bootstrap();
```

#### 3. Load Balancer Configuration

**Nginx Configuration:**

```nginx
upstream backend {
    # Use IP hash for sticky sessions (optional)
    ip_hash;
    
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    listen 80;
    server_name api.shravankirana.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Note:** With Redis adapter, sticky sessions are NOT required. Socket.io will automatically sync state across instances.

#### 4. Docker Compose for Multi-Instance

```yaml
version: '3.8'

services:
    redis:
        image: redis:7-alpine
        ports:
            - "6379:6379"
        volumes:
            - redis-data:/data

    mongodb:
        image: mongo:6
        ports:
            - "27017:27017"
        volumes:
            - mongo-data:/data/db

    backend1:
        build: ./backend
        environment:
            - REDIS_URL=redis://redis:6379
            - MONGODB_URI=mongodb://mongodb:27017/shravankirana
        depends_on:
            - redis
            - mongodb

    backend2:
        build: ./backend
        environment:
            - REDIS_URL=redis://redis:6379
            - MONGODB_URI=mongodb://mongodb:27017/shravankirana
        depends_on:
            - redis
            - mongodb

    backend3:
        build: ./backend
        environment:
            - REDIS_URL=redis://redis:6379
            - MONGODB_URI=mongodb://mongodb:27017/shravankirana
        depends_on:
            - redis
            - mongodb

    nginx:
        image: nginx:alpine
        ports:
            - "80:80"
        volumes:
            - ./nginx.conf:/etc/nginx/nginx.conf
        depends_on:
            - backend1
            - backend2
            - backend3

volumes:
    redis-data:
    mongo-data:
```

#### 5. Scaling Considerations

**Connection Limits:**
- Monitor concurrent Socket.io connections
- Each backend instance can handle ~10,000 concurrent connections
- Scale horizontally when approaching 70-80% capacity

**Redis Performance:**
- Use Redis Cluster for high-traffic deployments
- Monitor Redis memory usage
- Consider Redis persistence (RDB or AOF)

**Database Performance:**
- Use MongoDB replica sets for high availability
- Consider read replicas for heavy read operations
- Monitor query performance and optimize indexes

---

## Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Prepare Production Environment

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install MongoDB and Redis (see previous sections)
```

#### 2. Deploy Backend

```bash
# Clone repository
git clone https://github.com/your-org/shravankirana.git
cd shravankirana/backend

# Install dependencies
npm ci --only=production

# Build
npm run build

# Start with PM2
pm2 start dist/main.js --name shravankirana-api
pm2 save
pm2 startup
```

#### 3. Configure PM2 Ecosystem

Create `ecosystem.config.js`:

```javascript
module.exports = {
    apps: [{
        name: 'shravankirana-api',
        script: 'dist/main.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: 'logs/err.log',
        out_file: 'logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true
    }]
};
```

Start with ecosystem:

```bash
pm2 start ecosystem.config.js
```

#### 4. Setup Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.shravankirana.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 5. Setup SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.shravankirana.com
```

### Option 2: Docker Deployment

#### 1. Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

#### 2. Build and Run

```bash
# Build image
docker build -t shravankirana-api ./backend

# Run container
docker run -d \
    -p 3000:3000 \
    --name shravankirana-api \
    --env-file backend/.env.production \
    shravankirana-api
```

#### 3. Docker Compose (Complete Stack)

See the multi-instance example in the Socket.io Scaling section.

### Option 3: Cloud Platform Deployment

#### AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment
eb create production

# Deploy
eb deploy
```

#### Heroku

```bash
# Login
heroku login

# Create app
heroku create shravankirana-api

# Add MongoDB and Redis addons
heroku addons:create mongolab
heroku addons:create heroku-redis

# Deploy
git push heroku main
```

#### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/shravankirana-api

# Deploy
gcloud run deploy shravankirana-api \
    --image gcr.io/PROJECT_ID/shravankirana-api \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

---

## Monitoring & Maintenance

### 1. Application Monitoring

#### PM2 Monitoring

```bash
# View logs
pm2 logs shravankirana-api

# Monitor resources
pm2 monit

# View status
pm2 status
```

#### Health Checks

Create `backend/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: MongooseHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
        ]);
    }
}
```

### 2. Database Monitoring

```bash
# MongoDB stats
mongo --eval "db.stats()"

# Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5)

# Index usage
db.orders.aggregate([{ $indexStats: {} }])
```

### 3. Redis Monitoring

```bash
# Redis info
redis-cli info

# Monitor commands
redis-cli monitor

# Check memory
redis-cli info memory

# Check slow log
redis-cli slowlog get 10
```

### 4. Socket.io Monitoring

Add monitoring to `backend/src/sockets/tracking.gateway.ts`:

```typescript
@WebSocketGateway()
export class TrackingGateway {
    private metrics = {
        connections: 0,
        rooms: new Map(),
        messages: 0
    };

    handleConnection(client: Socket) {
        this.metrics.connections++;
        this.logger.log(`Connections: ${this.metrics.connections}`);
    }

    handleDisconnect(client: Socket) {
        this.metrics.connections--;
    }

    @Get('/metrics')
    getMetrics() {
        return {
            connections: this.metrics.connections,
            rooms: this.metrics.rooms.size,
            messages: this.metrics.messages
        };
    }
}
```

### 5. Background Jobs Monitoring

```bash
# BullMQ dashboard
npm install -g bull-board
bull-board --redis redis://localhost:6379
```

Access dashboard at `http://localhost:3000/admin/queues`

### 6. Logging

Configure Winston logger in `backend/src/config/logger.ts`:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d'
        }),
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}
```

---

## Troubleshooting

### Backend Issues

#### Issue: Backend won't start

**Symptoms:**
- Error: "Cannot connect to MongoDB"
- Error: "Redis connection failed"

**Solutions:**
1. Verify MongoDB is running: `systemctl status mongod`
2. Verify Redis is running: `redis-cli ping`
3. Check connection strings in `.env`
4. Check firewall rules
5. Verify network connectivity

#### Issue: High memory usage

**Solutions:**
1. Check for memory leaks: `node --inspect dist/main.js`
2. Monitor with PM2: `pm2 monit`
3. Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
4. Review Redis cache TTL settings
5. Optimize database queries

### Socket.io Issues

#### Issue: Clients can't connect

**Symptoms:**
- Connection timeout
- CORS errors
- Authentication failures

**Solutions:**
1. Check CORS configuration in `main.ts`
2. Verify JWT token is valid
3. Check firewall/security groups
4. Try polling transport: `transports: ['polling', 'websocket']`
5. Check Nginx WebSocket configuration

#### Issue: Messages not broadcasting

**Solutions:**
1. Verify Redis adapter is configured (multi-instance)
2. Check room subscriptions
3. Verify event names match
4. Check Redis pub/sub: `redis-cli PSUBSCRIBE '*'`
5. Review gateway logs

### Database Issues

#### Issue: Slow queries

**Solutions:**
1. Check indexes: `db.orders.getIndexes()`
2. Analyze query performance: `db.orders.find().explain()`
3. Create missing indexes
4. Use projection to limit fields
5. Consider pagination for large result sets

#### Issue: Connection pool exhausted

**Solutions:**
1. Increase pool size in Mongoose configuration
2. Check for connection leaks
3. Implement connection retry logic
4. Monitor active connections

### Redis Issues

#### Issue: Redis out of memory

**Solutions:**
1. Check memory usage: `redis-cli info memory`
2. Review cache TTL settings
3. Implement eviction policy: `maxmemory-policy allkeys-lru`
4. Increase Redis memory limit
5. Clear unnecessary keys

#### Issue: High latency

**Solutions:**
1. Check slow log: `redis-cli slowlog get 10`
2. Monitor network latency
3. Use Redis pipelining for bulk operations
4. Consider Redis Cluster for scaling
5. Optimize data structures

### Background Jobs Issues

#### Issue: Jobs not processing

**Solutions:**
1. Check BullMQ dashboard
2. Verify Redis connection
3. Check job queue: `redis-cli KEYS bull:*`
4. Review job processor logs
5. Check for failed jobs in dead letter queue

#### Issue: Jobs failing repeatedly

**Solutions:**
1. Review error logs
2. Check retry configuration
3. Verify external API availability (Google Maps)
4. Increase timeout values
5. Implement circuit breaker pattern

---

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong passwords for MongoDB and Redis
- [ ] Enable MongoDB authentication
- [ ] Enable Redis password protection
- [ ] Configure firewall rules
- [ ] Use HTTPS/TLS in production
- [ ] Implement rate limiting
- [ ] Sanitize user inputs
- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] Backup database regularly
- [ ] Monitor for suspicious activity

---

## Performance Optimization

### Backend Optimization

1. **Enable compression:**
```typescript
import compression from 'compression';
app.use(compression());
```

2. **Implement caching:**
- Use Redis for frequently accessed data
- Cache Distance Matrix API responses
- Cache active orders

3. **Optimize database queries:**
- Use lean() for read-only queries
- Implement field projection
- Use indexes effectively
- Batch operations when possible

4. **Connection pooling:**
```typescript
mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 5
});
```

### Frontend Optimization

1. **Lazy loading:**
- Load tracking components only when needed
- Use React.lazy() for code splitting

2. **Optimize map rendering:**
- Limit marker updates
- Use marker clustering for multiple riders
- Debounce location updates

3. **Reduce bundle size:**
- Remove unused dependencies
- Use production builds
- Enable tree shaking

---

## Backup & Recovery

### Database Backup

```bash
# MongoDB backup
mongodump --uri="mongodb://localhost:27017/shravankirana" --out=/backup/$(date +%Y%m%d)

# Automated daily backup
0 2 * * * mongodump --uri="mongodb://localhost:27017/shravankirana" --out=/backup/$(date +\%Y\%m\%d)
```

### Redis Backup

```bash
# Manual backup
redis-cli SAVE

# Automated backup (in redis.conf)
save 900 1
save 300 10
save 60 10000
```

### Restore

```bash
# MongoDB restore
mongorestore --uri="mongodb://localhost:27017/shravankirana" /backup/20240101

# Redis restore
cp /backup/dump.rdb /var/lib/redis/
systemctl restart redis
```

---

## Conclusion

This deployment guide covers all aspects of setting up and deploying the Real-Time Order Tracking System. Follow the steps carefully and refer to the troubleshooting section if you encounter any issues.

For additional support:
- Review the [Requirements Document](.kiro/specs/order-tracking-system/requirements.md)
- Review the [Design Document](.kiro/specs/order-tracking-system/design.md)
- Check the [Tasks Document](.kiro/specs/order-tracking-system/tasks.md)

**System Status:** Production Ready ✅
