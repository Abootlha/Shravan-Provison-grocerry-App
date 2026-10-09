# Order Tracking System - Setup Documentation

## Dependencies Installed

### NestJS WebSocket & Real-time Communication
- ✅ `@nestjs/websockets@11.1.11` - WebSocket gateway support
- ✅ `@nestjs/platform-socket.io@11.1.11` - Socket.io platform adapter
- ✅ `socket.io@4.8.3` - Real-time bidirectional event-based communication

### Background Job Processing
- ✅ `@nestjs/bullmq@11.0.4` - NestJS integration for BullMQ
- ✅ `bullmq@5.66.4` - Redis-based queue for background jobs
- ✅ `ioredis@5.8.2` - Redis client for caching and job queues

### Validation & Transformation
- ✅ `class-validator@0.14.3` - Decorator-based validation
- ✅ `class-transformer@0.5.1` - Object transformation and serialization

### External APIs
- ✅ `@googlemaps/google-maps-services-js@3.4.2` - Google Maps Distance Matrix API client

## TypeScript Configuration

TypeScript has been configured with **strict mode** enabled, which includes:
- `strict: true` - Enables all strict type checking options
- `strictNullChecks: true` - Strict null checking
- `strictFunctionTypes: true` - Strict function type checking
- `strictBindCallApply: true` - Strict bind/call/apply checking
- `strictPropertyInitialization: true` - Strict property initialization
- `noImplicitAny: true` - No implicit any types
- `alwaysStrict: true` - Parse in strict mode and emit "use strict"

**Note:** Existing schemas in the codebase may need to be updated to comply with strict mode by:
- Adding `!` to properties that are definitely assigned (e.g., `@Prop() name!: string`)
- Adding `?` to optional properties (e.g., `@Prop() description?: string`)
- Providing default values in constructors

The new order tracking system schemas will be built with strict mode compliance from the start.

## Environment Variables

The following environment variables have been added to `.env`:

### Google Maps API
```bash
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### Redis Configuration
```bash
REDIS_URL=redis://localhost:6379
```

### Socket.io Configuration
```bash
SOCKET_IO_CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

### Order Tracking Configuration
```bash
STALE_ORDER_THRESHOLD_MINUTES=10      # Auto-cancel orders pending > 10 minutes
ANOMALY_THRESHOLD_HOURS=2             # Flag orders in delivery > 2 hours
ETA_RECALC_INTERVAL_MINUTES=5         # Recalculate ETA every 5 minutes
```

### Performance Configuration
```bash
REDIS_CACHE_TTL_SECONDS=300           # Cache active orders for 5 minutes
ETA_CACHE_TTL_SECONDS=120             # Cache ETA responses for 2 minutes
LOCATION_THROTTLE_SECONDS=5           # Minimum 5 seconds between location updates
MAX_CONCURRENT_JOBS=5                 # Maximum concurrent background jobs
```

## Next Steps

1. **Configure Google Maps API Key**: 
   - Obtain an API key from Google Cloud Console
   - Enable Distance Matrix API
   - Update `GOOGLE_MAPS_API_KEY` in `.env`

2. **Set up Redis**:
   - Install Redis locally or use a cloud service
   - Update `REDIS_URL` if using a remote Redis instance

3. **Configure Socket.io CORS**:
   - Update `SOCKET_IO_CORS_ORIGIN` with your frontend URLs

4. **Proceed with Implementation**:
   - Task 2: Implement Order data model and schema
   - Task 3: Implement Rider data model and schema
   - Continue with remaining tasks in sequence

## Architecture Overview

The order tracking system uses:
- **Socket.io** for real-time bidirectional communication
- **BullMQ + Redis** for background job processing (stale orders, anomaly detection, ETA updates)
- **Google Distance Matrix API** for dynamic ETA calculation
- **MongoDB** for data persistence with geospatial indexes
- **Redis** for caching and location update throttling

## Testing Framework

The project uses Jest for testing:
- Unit tests for services and controllers
- Property-based tests using fast-check (to be installed in later tasks)
- Integration tests for Socket.io and background jobs
