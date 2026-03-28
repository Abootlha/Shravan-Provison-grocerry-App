# ShravanKirana Maps & Routes System Design

## Executive Summary

This document outlines a comprehensive system design for the maps, routes, and location-based services in ShravanKirana. Inspired by Uber's system architecture and refined by Kiro's order tracking system design, this document addresses scalability, efficiency, and reliability for real-time location tracking, nearest-driver matching, route optimization, and order lifecycle management.

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                     │
│                    (NestJS + Socket.io + Redis Adapter)                     │
└─────────────────────────────────────────────────────────────────────────────┘
           │                    │                    │                    │
           ▼                    ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Orders Module   │  │  Riders Module   │  │   ETA Service   │  │  Jobs Module     │
│  - CRUD          │  │  - Availability  │  │  - Distance     │  │  - BullMQ        │
│  - State Machine │  │  - Location      │  │    Matrix API   │  │  - Stale Check   │
│  - Timeline      │  │  - Geospatial   │  │  - Caching      │  │  - Anomaly Check │
│  - Cache         │  │    Queries       │  │                 │  │  - ETA Recalc    │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
           │                    │                    │                    │
           ▼                    ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Tracking Gateway                                    │
│                    (Socket.io WebSocket Gateway)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Room Manager   │  │  Auth (JWT)     │  │  Broadcast      │              │
│  │  order_{id}    │  │  WsJwtGuard     │  │  Service        │              │
│  │  user_{id}     │  │                 │  │                 │              │
│  │  rider_{id}    │  │                 │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────┘
           │                    │                    │                    │
           ▼                    ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│     MongoDB      │  │      Redis       │  │   Map Provider   │  │   BullMQ        │
│  - Orders        │  │  - Cache         │  │  - Google Maps   │  │   - Jobs Queue  │
│  - Users/Riders  │  │  - Sessions      │  │  - MapMyIndia    │  │  - Dead Letter  │
│  - 2dsphere idx  │  │  - Throttle      │  │  - OSRM Backup   │  │                 │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 1.2 Core Design Principles (from Kiro's Order Tracking System)

1. **Event-Driven Architecture**: Socket.io gateway broadcasts state changes to subscribed clients
2. **State Machine Pattern**: Order status transitions follow a strict state machine with validation
3. **Room-Based Security**: Socket rooms scoped by entity (user, rider, order) with JWT authentication
4. **Optimistic Updates**: Client-side state updates with server reconciliation
5. **Graceful Degradation**: System continues operating with reduced functionality during partial failures
6. **Horizontal Scalability**: Redis-backed Socket.io adapter for multi-instance deployment

### 1.3 Core Services

| Service | Responsibility | Technology |
|---------|---------------|------------|
| **Orders Module** | CRUD, state machine, timeline, caching | NestJS + MongoDB |
| **Riders Module** | Availability, location tracking, geospatial queries | NestJS + MongoDB |
| **Tracking Gateway** | Real-time WebSocket communication | Socket.io |
| **ETA Service** | Google Distance Matrix API + caching | NestJS + Redis |
| **Jobs Module** | Background job processing | BullMQ + Redis |
| **Location Service** | Quadtree indexing, geohash management | Redis |

---

## 2. Order Lifecycle & State Machine

### 2.1 Order Status State Machine

```
PENDING ─────────────────────────────────────────────────────────────┐
   │                                                                │
   │ (admin confirms)                                               │
   ▼                                                                │
CONFIRMED ──────────────────────────────────────────────────────────┐│
   │                                                               ││
   │ (admin marks packed)                                          ││
   ▼                                                               ││
PACKED ────────────────────────────────────────────────────────────┐│
   │                                                               ││
   │ (admin assigns rider)                                          ││
   ▼                                                               ││
ASSIGNED ──────────────────────────────────────────────────────────┐│
   │                                                               ││
   │ (rider accepts & starts)                                       ││
   ▼                                                               ││
OUT_FOR_DELIVERY ─────────────────────────────────────────────────┐│
   │                                                               ││
   │ (rider marks delivered)                                       ││
   ▼                                                               ││
DELIVERED                                                          ││
                                                                   ││
   ▲                                                               ││
   │                                                               ││
   └────────────── CANCELLED (from any status except DELIVERED) ───┘│
```

### 2.2 Valid Status Transitions

| Current Status | Allowed Next Statuses |
|---------------|----------------------|
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | PACKED, CANCELLED |
| PACKED | ASSIGNED, CANCELLED |
| ASSIGNED | OUT_FOR_DELIVERY, CANCELLED |
| OUT_FOR_DELIVERY | DELIVERED, CANCELLED |
| DELIVERED | (terminal) |
| CANCELLED | (terminal) |

### 2.3 Data Flow

**Order Status Update Flow:**
```
Client (Admin/Rider) ──REST API──▶ OrdersController ──▶ OrdersService
                                                            │
                                                            ▼
                                                       MongoDB
                                                            │
                                                            ▼
                                                   TrackingGateway
                                                            │
                                                            ▼
                                                  Socket.io Broadcast
                                                            │
                                                    ┌───────┴───────┐
                                                    ▼               ▼
                                              Customer App    Admin Dashboard
```

**Rider Location Update Flow:**
```
Rider App ──WebSocket──▶ TrackingGateway ──▶ RidersService
                                                   │
                                                   ▼
                                              MongoDB (2dsphere)
                                                   │
                                                   ▼
                                          ETA Service (if OUT_FOR_DELIVERY)
                                                   │
                                                   ▼
                                          TrackingGateway Broadcast
                                                   │
                                                   ▼
                                          Customer App (order room)
```

---

## 3. Data Model Design

### 3.1 Database Strategy

**Hybrid Approach:**
- **MongoDB** with Mongoose for orders, users, and geospatial data with 2dsphere indexes
- **Redis** for real-time caching, session management, and job queues
- **BullMQ** for background job processing

### 3.2 Order Schema

```typescript
@Schema({ timestamps: true })
class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[]

  @Prop({ required: true, min: 0 })
  totalAmount: number

  @Prop({ 
    type: String, 
    enum: OrderStatus, 
    default: OrderStatus.PENDING,
    index: true 
  })
  status: OrderStatus

  @Prop({ type: [TimelineEntrySchema], default: [] })
  timeline: TimelineEntry[]

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  riderId?: Types.ObjectId

  @Prop({ type: AddressSchema, required: true })
  deliveryAddress: Address

  @Prop({ type: String, enum: PaymentStatus, required: true })
  paymentStatus: PaymentStatus

  @Prop({ type: Date })
  estimatedDeliveryTime?: Date

  @Prop({ type: Date })
  actualDeliveryTime?: Date

  @Prop({ type: String })
  cancellationReason?: string
}

interface TimelineEntry {
  status: OrderStatus
  timestamp: Date
  changedBy: Types.ObjectId
}

interface Address {
  street: string
  city: string
  postalCode: string
  coordinates: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
}

// Indexes:
// { userId: 1 }                    - Single field for user queries
// { status: 1 }                     - Status filtering
// { riderId: 1 }                    - Rider queries
// { status: 1, createdAt: 1 }       - Compound for stale order queries
// { deliveryAddress: "2dsphere" }   - Geospatial delivery queries
```

### 3.3 Rider Schema

```typescript
@Schema()
class Rider extends User {
  @Prop({ default: false })
  isAvailable: boolean

  @Prop({ default: false })
  isOnline: boolean

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  })
  currentLocation: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }

  @Prop({ type: Date })
  lastLocationUpdate?: Date
}

// Indexes:
// { currentLocation: "2dsphere" }              - 2dsphere for proximity queries
// { isOnline: 1, isAvailable: 1 }              - Availability queries
// { isAvailable: 1, isOnline: 1, currentLocation: "2dsphere" } - Combined
```

### 3.4 Redis Cache Structure

| Key Pattern | Data | TTL | Purpose |
|-------------|------|-----|---------|
| `order:{orderId}` | Full order JSON | 300s (5 min) | Active order cache |
| `rider:location:throttle:{riderId}` | Timestamp | 5s | Location update throttling |
| `eta:{roundedLat}:{roundedLng}:{destLat}:{destLng}` | Duration (seconds) | 120s (2 min) | ETA response cache |

---

## 4. Location Tracking System

### 4.1 Real-time Location Updates

**Architecture:**
```
┌─────────────┐     WebSocket      ┌──────────────┐     gRPC      ┌───────────────┐
│  Rider App  │ ────────────────▶ │ Tracking     │ ────────────▶ │ Riders Module │
│             │                   │ Gateway      │               │               │
└─────────────┘                   └──────────────┘               └───────────────┘
                                          │
                                          │ Publish
                                          ▼
                                  ┌──────────────┐
                                  │ Location     │
                                  │ Cache (Redis)│
                                  └──────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ ETA Service           │
                              │ (if OUT_FOR_DELIVERY) │
                              └───────────────────────┘
                                          │
                                          ▼
                                  ┌──────────────┐
                                  │ Broadcast to │
                                  │ Order Rooms  │
                                  └──────────────┘
```

### 4.2 Location Update Flow

1. **Client sends location** every 3-5 seconds via WebSocket
2. **WsJwtGuard validates** JWT token from socket handshake
3. **Throttling check** - reject if < 5 seconds since last update (Redis SETNX)
4. **Coordinate validation** - lat [-90,90], lng [-180,180]
5. **Update MongoDB** rider document with new coordinates + timestamp
6. **Broadcast** to all order rooms where rider has active orders
7. **Trigger ETA recalculation** for orders in OUT_FOR_DELIVERY status
8. **Send acknowledgment** to rider with server timestamp

### 4.3 Throttling Strategy (from Kiro's Implementation)

```typescript
// Redis-based throttling with atomic SETNX
const THROTTLE_WINDOW_MS = 5000; // 5 seconds minimum interval
const THROTTLE_KEY = `rider:location:throttle:{riderId}`;

async validateLocationUpdate(riderId: string): Promise<boolean> {
  const throttleKey = `rider:location:throttle:${riderId}`;
  const lastUpdate = await this.redisService.get(throttleKey);
  
  if (lastUpdate) {
    // Location update is throttled
    return false;
  }
  
  // Set throttle with 5-second TTL
  await this.redisService.set(throttleKey, Date.now().toString(), 5);
  return true;
}
```

---

## 5. Quadtree-Based Driver Matching

### 5.1 Why Quadtree over Basic MongoDB $near?

| Approach | Time Complexity | Space Complexity | Scalability | Notes |
|----------|-----------------|------------------|-------------|-------|
| MongoDB $near | O(log n + m) | O(n) | Limited | Basic implementation |
| **Quadtree** | **O(log n)** | **O(n)** | **Excellent** | Better for high density |
| Geohash | O(1) average | O(n) | Good | Simple to implement |

### 5.2 Quadtree Implementation

**Redis-based Quadtree using Sorted Sets:**
```
Key: zone:riders:{zoneGeohash}
Score: Hilbert curve index for locality-preserving ordering
Member: riderId:lat:lng:available:timestamp
```

**Hilbert Curve Indexing:**
```typescript
function latLngToHilbertIndex(lat: number, lng: number, precision: number = 20): number {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, precision));
  const y = Math.floor((lat + 90) / 180 * Math.pow(2, precision));
  return hilbertCurveIndex(x, y, precision);
}
```

### 5.3 Find Nearby Drivers Algorithm

```typescript
async findNearbyDrivers(
  customerLat: number,
  customerLng: number,
  radiusMeters: number = 5000,
  limit: number = 10
): Promise<Rider[]> {
  
  // 1. Get customer's geohash at precision 6 (~38m cells)
  const customerGeohash = geohash.encode(customerLat, customerLng, 6);
  
  // 2. Find all geohashes within radius (8 neighbors + self for 6-char hash)
  const nearbyHashes = geohash.neighbors(customerGeohash).concat(customerGeohash);
  
  // 3. Query Redis for riders in those zones
  const riderIds = await this.redisService.sunion(
    ...nearbyHashes.map(h => `geohash:riders:${h}`)
  );
  
  // 4. Filter by actual distance and availability
  const drivers = [];
  for (const riderId of riderIds) {
    const location = await this.getRiderLocation(riderId);
    if (!location.isAvailable) continue;
    
    const distance = haversineDistance(
      customerLat, customerLng,
      location.latitude, location.longitude
    );
    
    if (distance <= radiusMeters) {
      drivers.push({
        ...location,
        distanceMeters: distance,
        etaMinutes: distance / AVERAGE_SPEED_MPS // ~8.33 m/s
      });
    }
  }
  
  // 5. Sort by distance and return top N
  return drivers
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
```

### 5.4 Driver Ranking Factors

```typescript
interface DriverRankingScore {
  distanceScore: number;         // Weight: 0.4 (closer is better)
  ratingScore: number;           // Weight: 0.3 (higher rating is better)
  acceptanceRateScore: number;   // Weight: 0.2 (more accepts is better)
  proximityToPickupScore: number; // Weight: 0.1 (closer to pickup is better)
}

async rankDrivers(drivers: Driver[], pickupLocation: Location): Promise<Driver[]> {
  return drivers.map(driver => {
    const metrics = await this.getDriverMetrics(driver.riderId);
    
    const distanceScore = 1 - (driver.distanceMeters / MAX_SEARCH_RADIUS);
    const ratingScore = metrics.averageRating / 5.0;
    const acceptanceScore = metrics.acceptanceRate;
    const proximityScore = calculateProximityScore(driver, pickupLocation);
    
    const totalScore = (
      distanceScore * 0.4 +
      ratingScore * 0.3 +
      acceptanceScore * 0.2 +
      proximityScore * 0.1
    );
    
    return { ...driver, rankingScore: totalScore };
  }).sort((a, b) => b.rankingScore - a.rankingScore);
}
```

---

## 6. ETA Service Architecture

### 6.1 ETA Calculation Formula

```
ETA = travel_time + preparation_time + surge_multiplier

travel_time = distance / current_speed (from traffic data)
preparation_time = store_prep_time + customer_handling_time
surge_multiplier = demand_factor / supply_factor
```

### 6.2 ETA Caching Strategy

```typescript
// Cache key with rounded coordinates for better cache hits
// Rounded to 4 decimal places (~11m precision)
private getETACacheKey(
  riderLat: number,
  riderLng: number,
  destLat: number,
  destLng: number
): string {
  const roundedRiderLat = riderLat.toFixed(4);
  const roundedRiderLng = riderLng.toFixed(4);
  const roundedDestLat = destLat.toFixed(4);
  const roundedDestLng = destLng.toFixed(4);
  
  return `eta:${roundedRiderLat}:${roundedRiderLng}:${roundedDestLat}:${roundedDestLng}`;
}

const ETA_CACHE_TTL = 120; // 2 minutes
```

### 6.3 ETA Recalculation Triggers

1. **Order assigned to rider** - Initial ETA calculation
2. **Rider location update** - Recalculate if order is OUT_FOR_DELIVERY
3. **Route deviation detected** - If > 100m off-route
4. **Periodic refresh** - Every 5 minutes via BullMQ job

### 6.4 Google Distance Matrix Integration

```typescript
private async callDistanceMatrixAPI(
  origin: string,
  destination: string
): Promise<DistanceMatrixResponse> {
  const response = await this.googleMapsClient.distancematrix({
    params: {
      origins: [origin],
      destinations: [destination],
      mode: TravelMode.driving,
      units: UnitSystem.metric,
      key: this.configService.get<string>('GOOGLE_MAPS_API_KEY'),
    },
  });

  if (response.data.status !== 'OK') {
    throw new Error(`Distance Matrix API error: ${response.data.status}`);
  }

  const element = response.data.rows[0]?.elements[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`No route found: ${element?.status || 'UNKNOWN'}`);
  }

  return response.data;
}
```

---

## 7. Route Service Architecture

### 7.1 Route Calculation Flow

```
┌──────────────┐     1. Request      ┌──────────────┐
│  Order      │ ──────────────────▶ │   Route      │
│  Service    │                     │   Service    │
└──────────────┘                    └──────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
     ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
     │ Route Cache  │            │  Google      │            │   OSRM       │
     │ (Redis LRU)  │            │  Directions │            │  (Backup)    │
     └──────────────┘            │  API         │            └──────────────┘
                                └──────────────┘
```

### 7.2 Route Caching Strategy

**Multi-level Caching:**
```typescript
// Level 1: Exact match (same origin-destination)
const CACHE_TTL_SHORT = 300;  // 5 minutes for traffic

// Level 2: Geohash-based (origin geohash 6-char, destination geohash 6-char)
const CACHE_TTL_MEDIUM = 3600; // 1 hour for same zone

// Level 3: Zone-based (origin zone, destination zone)
const CACHE_TTL_LONG = 86400;  // 24 hours for regional routes
```

### 7.3 Polyline Encoding/Decoding

```typescript
// Google Polyline Algorithm decoder
function decodePolyline(encoded: string): LatLng[] {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}
```

---

## 8. Background Jobs (BullMQ)

### 8.1 Job Definitions

```typescript
// Stale order check: every 2 minutes
Queue.add('stale-order-check', {}, {
  repeat: { cron: '*/2 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});

// Anomaly check: every 10 minutes
Queue.add('anomaly-check', {}, {
  repeat: { cron: '*/10 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});

// ETA recalculation: every 5 minutes
Queue.add('eta-recalculation', {}, {
  repeat: { cron: '*/5 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

### 8.2 Job Processors

**Stale Order Check:**
- Query: `status = PENDING AND createdAt < (now - 10 minutes)`
- Action: Cancel order with reason `AUTO_CANCELLED_STALE`

**Anomaly Detection:**
- Query: `status = OUT_FOR_DELIVERY AND lastStatusUpdate < (now - 2 hours)`
- Action: Flag as anomalous, notify administrators

**ETA Recalculation:**
- Query: `status = OUT_FOR_DELIVERY`
- Action: Recalculate ETA for each order

---

## 9. Real-time Communication (Socket.io)

### 9.1 WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway                                  │
│                    (Socket.io with Redis Adapter)                   │
└─────────────────────────────────────────────────────────────────────┘
                     │                    │
                     ▼                    ▼
          ┌──────────────────┐  ┌──────────────────┐
          │  Customer App    │  │   Rider App     │
          │  (order:{id})    │  │   (rider:{id})  │
          └──────────────────┘  └──────────────────┘
                     │                    │
                     └────────┬───────────┘
                              │
                     ┌────────▼────────┐
                     │  Tracking       │
                     │  Gateway        │
                     │  /tracking      │
                     └─────────────────┘
```

### 9.2 Socket Events

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `joinOrderRoom` | `{ orderId: string }` | Join order tracking room |
| `leaveOrderRoom` | `{ orderId: string }` | Leave order tracking room |
| `riderLocationUpdate` | `{ latitude, longitude, accuracy? }` | Rider location update |

**Server → Client:**
| Event | Payload | Description |
|-------|---------|-------------|
| `orderStatusUpdate` | `{ orderId, status, timeline, estimatedDeliveryTime? }` | Order status change |
| `riderLocationUpdate` | `{ riderId, location: {lat, lng}, timestamp }` | Rider position update |
| `etaUpdate` | `{ orderId, estimatedDeliveryTime, durationMinutes }` | ETA recalculation |

### 9.3 Room Naming Convention

```
user_{userId}    - Room for a specific user
rider_{riderId}  - Room for a specific rider
order_{orderId}  - Room for order tracking (subscribers: customer, assigned rider, admins)
```

### 9.4 Room Authorization

**Order Room Access:**
- **Customer**: Can join if `userId` matches order's `userId`
- **Rider**: Can join if `riderId` matches order's `riderId`
- **Admin**: Can join any order room

---

## 10. Map Service Abstraction

### 10.1 Provider Interface

```typescript
interface MapProvider {
  // Geocoding
  geocode(address: string): Promise<Location>;
  reverseGeocode(location: Location): Promise<Address>;

  // Routing
  calculateRoute(origin: Location, destination: Location, options: RouteOptions): Promise<Route>;

  // Distance Matrix
  calculateETA(origin: Location, destination: Location): Promise<ETAResult>;

  // Places
  searchNearby(location: Location, query: string): Promise<Place[]>;
}

class MapProviderFactory {
  static create(type: 'google' | 'mapmyindia' | 'osrm'): MapProvider {
    switch (type) {
      case 'mapmyindia': return new MapMyIndiaProvider();
      case 'osrm': return new OSRMProvider();
      default: return new GoogleMapsProvider();
    }
  }
}
```

### 10.2 Fallback Strategy

```
Primary: Google Maps
    │
    ├─[failure]──▶ MapMyIndia
    │                  │
    │                  ├─[failure]──▶ OSRM (Open Source)
    │                                    │
    └────────────────────────────────────┘
                      │
                      ▼
            Haversine Distance
         (Straight-line estimate)
```

---

## 11. Caching Strategy

### 11.1 Cache Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                     L1: In-Memory (Local)                      │
│                   Hot data (LRU, 100MB per node)               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Miss
┌────────────────────────────────────────────────────────────────┐
│                     L2: Redis (Distributed)                    │
│               Warm data (LRU, 10GB cluster-wide)              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Miss
┌────────────────────────────────────────────────────────────────┐
│                     L3: Database (MongoDB)                      │
│                    Cold data (persistent storage)              │
└────────────────────────────────────────────────────────────────┘
```

### 11.2 Cache Key Patterns

| Data | Key Pattern | TTL | Eviction |
|------|-------------|-----|----------|
| Active Order | `order:{orderId}` | 300s | LRU |
| Rider Location Throttle | `rider:location:throttle:{riderId}` | 5s | TTL |
| ETA | `eta:{lat}:{lng}:{destLat}:{destLng}` | 120s | LRU |
| Geohash Zone | `zone:riders:{geohash}` | None* | Set-based |
| Driver Metrics | `driver:metrics:{driverId}` | 300s | LRU |

### 11.3 Redis Fallback Behavior

When Redis is unavailable:
1. OrdersService falls back to direct MongoDB queries
2. ETA Service retains previous ETA value
3. Location throttling is bypassed (with warning logging)

---

## 12. Correctness Properties

*The following properties are formal statements about system behavior that should hold across all valid executions (from Kiro's design):*

### Property 1: Timeline Recording Invariant
For any order and any status change, after updating the order status, the timeline array must contain a new entry with the new status, a timestamp, and the user who made the change.

### Property 2: Status Transition Validation
For any order and any requested status change, the system must allow the transition if and only if it follows the valid state machine paths.

### Property 3: Rider Authorization for Status Updates
For any order status update request from a rider, the system must allow the update if and only if the rider's ID matches the order's assigned riderId.

### Property 4: Location Update Throttling
For any rider, if a location update is received within 5 seconds of the previous update, the system must reject the update with a throttle error.

### Property 5: ETA Calculation Error Handling
For any ETA calculation that fails due to API error, the system must log the error and retain the order's previous estimatedDeliveryTime value without modification.

### Property 6: Redis Fallback Behavior
For any order query when Redis is unavailable or returns an error, the system must fall back to querying MongoDB directly.

### Property 7: Job Retry with Exponential Backoff
For any background job that fails, the system must retry the job up to 3 times with exponential backoff delays (2s, 4s, 8s).

---

## 13. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Location update latency | < 50ms p99 | Socket → Redis |
| Nearby driver query | < 100ms p99 | API response |
| Route calculation | < 500ms p95 | Cache hit |
| ETA update broadcast | < 200ms p99 | Server → Client |
| System availability | 99.95% | Monthly SLA |
| Location accuracy | < 10m | GPS precision |

---

## 14. Implementation Roadmap

### Phase 1: Core Infrastructure ✓ (Kiro's Implementation)
- [x] Orders Module with state machine
- [x] Riders Module with location tracking
- [x] Tracking Gateway with Socket.io
- [x] ETA Service with Google Distance Matrix
- [x] Jobs Module with BullMQ
- [x] Redis caching layer

### Phase 2: Matching & Routing (Enhancements)
- [ ] Implement Redis-based Quadtree index
- [ ] Create geohash-based zone management
- [ ] Implement driver ranking algorithm
- [ ] Add multi-provider map abstraction (MapMyIndia/OSRM)

### Phase 3: Optimization
- [ ] Implement route caching with LRU eviction
- [ ] Add fallback routing strategies
- [ ] Implement surge pricing support
- [ ] Add traffic-aware routing

### Phase 4: Scale
- [ ] Implement consistent hashing for partitioning
- [ ] Add read replicas for MongoDB
- [ ] Implement Redis cluster mode
- [ ] Add comprehensive monitoring

---

## 15. Security Considerations

1. **Location Privacy**
   - Encrypt rider location data at rest
   - Use TLS 1.3 for all location transmissions
   - Implement location data retention policies (max 30 days)

2. **API Security**
   - Rate limiting: 100 requests/minute for location updates
   - API key rotation for map providers
   - JWT authentication for WebSocket connections

3. **Access Control**
   - Customers can only view their own order's rider location
   - Riders can only view their assigned order's customer location
   - Admin access requires additional role verification

---

## 16. Appendix: Glossary

| Term | Definition |
|------|------------|
| Geohash | A hierarchical spatial index that encodes lat/lng into alphanumeric string |
| Quadtree | A tree data structure for partitioning 2D space by recursively subdividing into 4 quadrants |
| Hilbert curve | A space-filling curve that preserves locality for better cache performance |
| ETA | Estimated Time of Arrival |
| 2dsphere | MongoDB geospatial index for spherical geometry calculations |
| OSRM | Open Source Routing Machine |
| FCM | Firebase Cloud Messaging for push notifications |
| BullMQ | Redis-based message queue for background job processing |
| Socket.io | Real-time bidirectional event-based communication |

---

## 17. References

- [Uber System Design](https://www.karanpratapsingh.com/courses/system-design/uber) - Karan Pratap Singh
- [Kiro's Order Tracking System](./.kiro/specs/order-tracking-system/design.md) - Implementation specification
