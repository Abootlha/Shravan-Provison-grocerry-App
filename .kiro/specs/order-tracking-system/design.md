# Design Document: Real-Time Order Tracking System

## Overview

The Real-Time Order Tracking System provides production-ready live order tracking for the ShravanKirana grocery delivery app. The system implements a complete order lifecycle with state machine-based transitions, real-time GPS tracking via Socket.io, dynamic ETA calculation using Google Distance Matrix API, and background job processing for automated order management.

### Key Design Principles

1. **Event-Driven Architecture**: Socket.io gateway broadcasts state changes to subscribed clients
2. **State Machine Pattern**: Order status transitions follow a strict state machine with validation
3. **Room-Based Security**: Socket rooms scoped by entity (user, rider, order) with JWT authentication
4. **Optimistic Updates**: Client-side state updates with server reconciliation
5. **Graceful Degradation**: System continues operating with reduced functionality during partial failures
6. **Horizontal Scalability**: Redis-backed Socket.io adapter for multi-instance deployment

### Technology Stack

- **Backend**: NestJS (TypeScript), MongoDB with Mongoose, Socket.io Gateway
- **Background Jobs**: BullMQ + Redis
- **Authentication**: JWT via Passport
- **Validation**: class-validator decorators
- **Customer App**: React Native (Expo), Redux Toolkit, Socket.io client, React Native Maps
- **Admin Dashboard**: Astro + React, Tailwind, Socket.io client
- **External APIs**: Google Distance Matrix API

## Architecture

### System Components

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Customer App   │         │ Admin Dashboard │         │  Rider App      │
│  (React Native) │         │  (Astro+React)  │         │ (React Native)  │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │ Socket.io + REST          │ Socket.io + REST          │ Socket.io + REST
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   NestJS Backend    │
                          │  ┌───────────────┐  │
                          │  │ Tracking      │  │
                          │  │ Gateway       │  │
                          │  │ (Socket.io)   │  │
                          │  └───────┬───────┘  │
                          │          │          │
                          │  ┌───────▼───────┐  │
                          │  │ Orders Module │  │
                          │  │ Riders Module │  │
                          │  │ ETA Service   │  │
                          │  └───────┬───────┘  │
                          └──────────┼──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
         ┌──────────▼─────────┐  ┌──▼───┐  ┌────────▼────────┐
         │     MongoDB        │  │Redis │  │  BullMQ Jobs    │
         │  - Orders          │  │Cache │  │  - Stale Check  │
         │  - Users/Riders    │  │      │  │  - Anomaly Check│
         │  - Geospatial Index│  │      │  │  - ETA Update   │
         └────────────────────┘  └──────┘  └─────────────────┘
```

### Order Status State Machine

```
PENDING ──────────────────────────────────────────────┐
   │                                                   │
   │ (admin confirms)                                  │
   ▼                                                   │
CONFIRMED                                              │
   │                                                   │
   │ (admin marks packed)                              │
   ▼                                                   │
PACKED                                                 │
   │                                                   │
   │ (admin assigns rider)                             │
   ▼                                                   │
ASSIGNED                                               │
   │                                                   │
   │ (rider accepts & starts)                          │
   ▼                                                   │
OUT_FOR_DELIVERY                                       │
   │                                                   │
   │ (rider marks delivered)                           │
   ▼                                                   │
DELIVERED                                              │
                                                       │
                                                       │
                                                       ▼
                                                   CANCELLED
                                            (from any status except DELIVERED)
```

### Data Flow

**Order Status Update Flow:**
1. Client (Admin/Rider) sends status update via REST API
2. Orders Service validates transition and updates MongoDB
3. Orders Service adds timeline entry with timestamp
4. Orders Service publishes event to Tracking Gateway
5. Tracking Gateway broadcasts to order room subscribers
6. All connected clients receive real-time update

**Rider Location Update Flow:**
1. Rider App sends GPS coordinates via Socket.io
2. Tracking Gateway validates authentication and throttling
3. Rider Service updates location in MongoDB with 2dsphere index
4. Tracking Gateway broadcasts to all order rooms for rider's active orders
5. ETA Calculator triggers recalculation for OUT_FOR_DELIVERY orders
6. Updated ETA broadcast to order rooms

## Components and Interfaces

### 1. Orders Module

**OrdersService**
```typescript
class OrdersService {
  // Core CRUD operations
  create(createOrderDto: CreateOrderDto, userId: string): Promise<Order>
  findById(orderId: string): Promise<Order>
  findByUserId(userId: string): Promise<Order[]>
  findActiveOrders(): Promise<Order[]>
  
  // Status management
  updateStatus(orderId: string, status: OrderStatus, userId: string, role: UserRole): Promise<Order>
  validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean
  addTimelineEntry(order: Order, status: OrderStatus, userId: string): void
  
  // Rider assignment
  assignRider(orderId: string, riderId: string): Promise<Order>
  unassignRider(orderId: string): Promise<Order>
  
  // Queries
  findStaleOrders(): Promise<Order[]>
  findAnomalousOrders(): Promise<Order[]>
  findOrdersByRider(riderId: string): Promise<Order[]>
}
```

**OrdersController**
```typescript
@Controller('orders')
class OrdersController {
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createOrderDto: CreateOrderDto, @Request() req): Promise<Order>
  
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req): Promise<Order>
  
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateStatusDto, @Request() req): Promise<Order>
  
  @Patch(':id/assign-rider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  assignRider(@Param('id') id: string, @Body() assignRiderDto: AssignRiderDto): Promise<Order>
}
```

**DTOs**
```typescript
class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  items: OrderItemDto[]
  
  @IsNumber()
  @Min(0)
  totalAmount: number
  
  @ValidateNested()
  deliveryAddress: AddressDto
  
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus
}

class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus
}

class AssignRiderDto {
  @IsMongoId()
  riderId: string
}

class AddressDto {
  @IsString()
  street: string
  
  @IsString()
  city: string
  
  @IsString()
  postalCode: string
  
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number
  
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number
}
```

### 2. Riders Module

**RidersService**
```typescript
class RidersService {
  // Rider management
  updateAvailability(riderId: string, isAvailable: boolean): Promise<Rider>
  updateOnlineStatus(riderId: string, isOnline: boolean): Promise<Rider>
  findAvailableRiders(): Promise<Rider[]>
  
  // Location tracking
  updateLocation(riderId: string, location: LocationDto): Promise<Rider>
  validateLocationUpdate(riderId: string): Promise<boolean>
  findNearbyRiders(coordinates: [number, number], maxDistance: number): Promise<Rider[]>
  
  // Queries
  findById(riderId: string): Promise<Rider>
  getActiveDeliveries(riderId: string): Promise<Order[]>
}
```

**LocationDto**
```typescript
class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number
  
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number
  
  @IsOptional()
  @IsNumber()
  accuracy?: number
}
```

### 3. Tracking Gateway (Socket.io)

**TrackingGateway**
```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking'
})
class TrackingGateway {
  // Connection lifecycle
  @UseGuards(WsJwtGuard)
  handleConnection(client: Socket): void
  handleDisconnect(client: Socket): void
  
  // Room management
  @SubscribeMessage('joinOrderRoom')
  handleJoinOrderRoom(client: Socket, payload: { orderId: string }): void
  
  @SubscribeMessage('leaveOrderRoom')
  handleLeaveOrderRoom(client: Socket, payload: { orderId: string }): void
  
  // Location updates
  @SubscribeMessage('riderLocationUpdate')
  handleRiderLocationUpdate(client: Socket, payload: LocationUpdatePayload): void
  
  // Broadcasting methods
  broadcastOrderStatusUpdate(orderId: string, order: Order): void
  broadcastRiderLocationUpdate(orderId: string, location: LocationDto, riderId: string): void
  broadcastETAUpdate(orderId: string, eta: Date): void
}
```

**Socket Events**
```typescript
// Client -> Server
interface LocationUpdatePayload {
  latitude: number
  longitude: number
  accuracy?: number
}

interface JoinOrderRoomPayload {
  orderId: string
}

// Server -> Client
interface OrderStatusUpdateEvent {
  orderId: string
  status: OrderStatus
  timeline: TimelineEntry[]
  estimatedDeliveryTime?: Date
}

interface RiderLocationUpdateEvent {
  riderId: string
  location: {
    latitude: number
    longitude: number
  }
  timestamp: Date
}

interface ETAUpdateEvent {
  orderId: string
  estimatedDeliveryTime: Date
  durationMinutes: number
}
```

### 4. ETA Service

**ETAService**
```typescript
class ETAService {
  // ETA calculation
  calculateETA(riderLocation: LocationDto, deliveryAddress: AddressDto): Promise<ETAResult>
  recalculateForOrder(orderId: string): Promise<Date>
  
  // Distance Matrix API integration
  private callDistanceMatrixAPI(origin: string, destination: string): Promise<DistanceMatrixResponse>
  private parseETAFromResponse(response: DistanceMatrixResponse): number
  
  // Caching
  private getCachedETA(cacheKey: string): Promise<number | null>
  private setCachedETA(cacheKey: string, durationSeconds: number): Promise<void>
}

interface ETAResult {
  estimatedDeliveryTime: Date
  durationMinutes: number
  distanceMeters: number
}
```

### 5. Background Jobs Module

**JobsService**
```typescript
class JobsService {
  // Job registration
  registerStaleOrderCheck(): void
  registerAnomalyCheck(): void
  registerETARecalculation(): void
  
  // Job processors
  @Process('stale-order-check')
  async processStaleOrders(job: Job): Promise<void>
  
  @Process('anomaly-check')
  async processAnomalies(job: Job): Promise<void>
  
  @Process('eta-recalculation')
  async processETAUpdates(job: Job): Promise<void>
}
```

**Job Configuration**
```typescript
// Stale order check: every 2 minutes
Queue.add('stale-order-check', {}, {
  repeat: { cron: '*/2 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
})

// Anomaly check: every 10 minutes
Queue.add('anomaly-check', {}, {
  repeat: { cron: '*/10 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
})

// ETA recalculation: every 5 minutes
Queue.add('eta-recalculation', {}, {
  repeat: { cron: '*/5 * * * *' },
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
})
```

## Data Models

### Order Schema

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

enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PACKED = 'PACKED',
  ASSIGNED = 'ASSIGNED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
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
```

**Indexes:**
- `userId`: Single field index for user order queries
- `status`: Single field index for status-based filtering
- `riderId`: Single field index for rider order queries
- `{ status: 1, createdAt: 1 }`: Compound index for stale order queries

### Rider Schema (extends User)

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
```

**Indexes:**
- `currentLocation`: 2dsphere geospatial index for proximity queries
- `{ isOnline: 1, isAvailable: 1 }`: Compound index for available rider queries

### Redis Cache Structure

```typescript
// Active orders cache
Key: `order:${orderId}`
Value: JSON.stringify(order)
TTL: 300 seconds (5 minutes)

// Rider location throttle
Key: `rider:location:throttle:${riderId}`
Value: timestamp
TTL: 5 seconds

// ETA cache
Key: `eta:${riderLat}:${riderLng}:${destLat}:${destLng}`
Value: durationSeconds
TTL: 120 seconds (2 minutes)
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several redundancies were identified:

**Redundant Properties Eliminated:**
- 1.5 (invalid transition prevention) is subsumed by 1.3 (transition validation)
- 4.4 (throttling) is duplicate of 3.7
- 6.7 (ETA broadcast) is duplicate of 5.8
- 9.3 (transition validation) is duplicate of 1.3
- 9.4 (rider authorization) is duplicate of 1.4
- 9.6 (socket auth) is duplicate of 5.1
- 9.7 (room access) is duplicate of 5.4 and 5.5
- 10.7 (throttling) is duplicate of 3.7 and 4.4
- 11.4 (API failure) is duplicate of 6.5
- 13.2 (GeoJSON format) is duplicate of 3.5
- 13.6 (default status) is duplicate of 1.6

**Properties Combined:**
- 5.1 and 5.2 combined into single authentication property
- 4.5 and 3.7 combined into comprehensive throttling property
- 7.3, 7.4, 7.5, 7.6, 7.8 combined into UI update property
- 8.4, 8.6, 8.7, 8.8 combined into admin dashboard behavior property

### Core Properties

**Property 1: Timeline Recording Invariant**

*For any* order and any status change, after updating the order status, the timeline array must contain a new entry with the new status, a timestamp, and the user who made the change.

**Validates: Requirements 1.2**

---

**Property 2: Status Transition Validation**

*For any* order and any requested status change, the system must allow the transition if and only if it follows the valid state machine paths: PENDING→{CONFIRMED,CANCELLED}, CONFIRMED→{PACKED,CANCELLED}, PACKED→{ASSIGNED,CANCELLED}, ASSIGNED→{OUT_FOR_DELIVERY,CANCELLED}, OUT_FOR_DELIVERY→{DELIVERED,CANCELLED}, and any status except DELIVERED can transition to CANCELLED.

**Validates: Requirements 1.3, 1.5, 9.3**

---

**Property 3: Rider Authorization for Status Updates**

*For any* order status update request from a rider, the system must allow the update if and only if the rider's ID matches the order's assigned riderId.

**Validates: Requirements 1.4, 9.4**

---

**Property 4: Initial Order Status**

*For any* newly created order, the status field must be set to PENDING.

**Validates: Requirements 1.6, 13.6**

---

**Property 5: Cancellation Availability**

*For any* order in any status except DELIVERED, a transition to CANCELLED status must be allowed.

**Validates: Requirements 1.7**

---

**Property 6: Stale Order Auto-Cancellation**

*For any* order in PENDING status with createdAt timestamp more than 10 minutes in the past, the stale order job processor must cancel the order and set cancellationReason to "AUTO_CANCELLED_STALE".

**Validates: Requirements 2.1, 2.2**

---

**Property 7: Anomalous Order Detection**

*For any* order in OUT_FOR_DELIVERY status with status change timestamp more than 2 hours in the past, the anomaly check job must flag the order as anomalous and trigger admin notification.

**Validates: Requirements 2.3, 2.4**

---

**Property 8: Rider Offline Order Reassignment**

*For any* rider with assigned orders, when the rider's isOnline status changes to false, all orders assigned to that rider must be marked as requiring reassignment.

**Validates: Requirements 3.3**

---

**Property 9: Rider Assignment Validation**

*For any* order assignment request, the system must allow the assignment if and only if the target rider has both isAvailable=true and isOnline=true.

**Validates: Requirements 3.4**

---

**Property 10: GeoJSON Location Format**

*For any* rider location update, the stored currentLocation field must be a valid GeoJSON Point object with type="Point" and coordinates array of [longitude, latitude] where longitude is in [-180, 180] and latitude is in [-90, 90].

**Validates: Requirements 3.5, 13.2**

---

**Property 11: Location Update Throttling**

*For any* rider, if a location update is received within 5 seconds of the previous update, the system must reject the update with a throttle error and not update the database.

**Validates: Requirements 3.7, 4.4, 4.5, 10.7**

---

**Property 12: Authenticated Location Updates**

*For any* location update request via socket, the system must validate the JWT token and reject unauthenticated requests before processing the location data.

**Validates: Requirements 4.1**

---

**Property 13: Location Persistence**

*For any* valid location update from an authenticated rider, the rider's currentLocation field in the database must be updated to the new coordinates and lastLocationUpdate must be set to the current timestamp.

**Validates: Requirements 4.2, 4.6**

---

**Property 14: Location Broadcast to Order Rooms**

*For any* rider location update, the system must broadcast a riderLocationUpdate event to all socket rooms corresponding to the rider's active orders (orders in ASSIGNED or OUT_FOR_DELIVERY status).

**Validates: Requirements 4.3**

---

**Property 15: Socket Authentication**

*For any* socket connection attempt, the system must authenticate the JWT token and reject the connection if authentication fails.

**Validates: Requirements 5.1, 5.2, 9.6**

---

**Property 16: Room Naming Convention**

*For any* socket room created for users, riders, or orders, the room name must follow the format "user_{userId}", "rider_{riderId}", or "order_{orderId}" respectively.

**Validates: Requirements 5.3**

---

**Property 17: Order Room Authorization**

*For any* user attempting to join an order room, the system must allow access if and only if the user's ID matches the order's userId or the user has admin role.

**Validates: Requirements 5.4, 9.7**

---

**Property 18: Rider Room Authorization**

*For any* rider attempting to join an order room, the system must allow access if and only if the rider's ID matches the order's riderId.

**Validates: Requirements 5.5, 9.7**

---

**Property 19: Order Status Event Emission**

*For any* order status change, the system must emit an orderStatusUpdate event to the order's socket room containing the orderId, new status, and updated timeline.

**Validates: Requirements 5.6**

---

**Property 20: Rider Location Event Emission**

*For any* rider location update, the system must emit a riderLocationUpdate event to all relevant order rooms containing the riderId, location coordinates, and timestamp.

**Validates: Requirements 5.7**

---

**Property 21: ETA Event Emission**

*For any* ETA recalculation, the system must emit an etaUpdate event to the order's socket room containing the orderId, new estimatedDeliveryTime, and duration in minutes.

**Validates: Requirements 5.8, 6.7**

---

**Property 22: Initial ETA Calculation**

*For any* order transitioning to ASSIGNED status, the system must call the Distance Matrix API with the rider's current location and customer's delivery address, then store the calculated estimatedDeliveryTime in the order document.

**Validates: Requirements 6.1**

---

**Property 23: Conditional ETA Recalculation**

*For any* rider location update, if the rider has orders in OUT_FOR_DELIVERY status, the system must recalculate the ETA for those orders using the new location.

**Validates: Requirements 6.2**

---

**Property 24: ETA Calculation Inputs**

*For any* ETA calculation, the system must use the rider's currentLocation coordinates as origin and the order's deliveryAddress coordinates as destination in the Distance Matrix API request.

**Validates: Requirements 6.3**

---

**Property 25: ETA Persistence**

*For any* successful ETA calculation, the order's estimatedDeliveryTime field must be updated with the calculated delivery time.

**Validates: Requirements 6.4**

---

**Property 26: ETA Calculation Error Handling**

*For any* ETA calculation that fails due to API error, the system must log the error and retain the order's previous estimatedDeliveryTime value without modification.

**Validates: Requirements 6.5, 11.4**

---

**Property 27: Distance Matrix Travel Mode**

*For any* Distance Matrix API request, the request parameters must include travelMode="driving".

**Validates: Requirements 6.6**

---

**Property 28: Order Creation Validation**

*For any* order creation request, the system must validate all fields using class-validator decorators and reject requests with invalid items, negative totalAmount, invalid deliveryAddress coordinates, or invalid paymentStatus enum values.

**Validates: Requirements 9.1**

---

**Property 29: Payment Verification for Confirmation**

*For any* order status transition to CONFIRMED, the system must verify that paymentStatus is "PAID" or "COD" before allowing the transition.

**Validates: Requirements 9.2**

---

**Property 30: Order Ownership Verification**

*For any* order detail request, the system must allow access if and only if the requesting user's ID matches the order's userId or the user has admin role.

**Validates: Requirements 9.5**

---

**Property 31: Location Coordinate Validation**

*For any* location update, the system must validate that latitude is in range [-90, 90] and longitude is in range [-180, 180], rejecting updates with out-of-range values.

**Validates: Requirements 9.8**

---

**Property 32: Redis Cache for Active Orders**

*For any* order query by ID, if the order is in the Redis cache and not expired (TTL > 0), the system must return the cached order without querying MongoDB.

**Validates: Requirements 10.5**

---

**Property 33: Cache Invalidation on Status Change**

*For any* order status update, the system must delete the order's cache entry from Redis to ensure subsequent queries fetch fresh data.

**Validates: Requirements 10.6**

---

**Property 34: ETA Response Caching**

*For any* Distance Matrix API request, if a cached response exists for the same origin-destination pair and is less than 2 minutes old, the system must use the cached duration value instead of making a new API call.

**Validates: Requirements 10.8**

---

**Property 35: Rider Offline Notification**

*For any* rider with assigned orders who goes offline (isOnline changes to false), the system must retain the order assignments and send a notification to administrators.

**Validates: Requirements 11.1**

---

**Property 36: Socket Reconnection Behavior**

*For any* successful socket reconnection after disconnection, the client must automatically re-join all previously joined order rooms and fetch the latest order status.

**Validates: Requirements 11.3**

---

**Property 37: Invalid Transition Error Messages**

*For any* invalid status transition attempt, the system must return an HTTP 400 error with a descriptive message indicating the current status, requested status, and why the transition is not allowed.

**Validates: Requirements 11.5**

---

**Property 38: Unauthorized Room Access Logging**

*For any* unauthorized room join attempt, the system must reject the request and log an entry containing the user ID, requested room, and timestamp.

**Validates: Requirements 11.6**

---

**Property 39: Database Error HTTP Codes**

*For any* database query failure, the system must return appropriate HTTP status codes: 404 for not found, 500 for server errors, 400 for validation errors.

**Validates: Requirements 11.7**

---

**Property 40: Redis Fallback Behavior**

*For any* order query when Redis is unavailable or returns an error, the system must fall back to querying MongoDB directly and return the result without caching.

**Validates: Requirements 11.8**

---

**Property 41: Job Retry with Exponential Backoff**

*For any* background job that fails, the system must retry the job up to 3 times with exponential backoff delays (2s, 4s, 8s) before considering it permanently failed.

**Validates: Requirements 12.5**

---

**Property 42: Dead Letter Queue for Failed Jobs**

*For any* background job that fails after all retry attempts, the system must move the job to the dead letter queue and log the failure with job details and error message.

**Validates: Requirements 12.6**

---

**Property 43: Timeline Entry Structure**

*For any* timeline entry in an order, the entry must contain fields: status (OrderStatus enum), timestamp (Date), and changedBy (User ObjectId reference).

**Validates: Requirements 13.3**

---

**Property 44: Referential Integrity for Order References**

*For any* order creation or update, the system must validate that userId and riderId (if present) reference existing User documents, rejecting operations with invalid references.

**Validates: Requirements 13.5**

---

**Property 45: Rider Default Values**

*For any* newly created rider, the isAvailable and isOnline fields must default to false.

**Validates: Requirements 13.7**

## Error Handling

### Error Categories

**1. Validation Errors (HTTP 400)**
- Invalid status transitions
- Out-of-range coordinates
- Missing required fields
- Invalid enum values
- Failed class-validator checks

**2. Authentication Errors (HTTP 401)**
- Invalid JWT token
- Expired JWT token
- Missing authentication header
- Invalid socket authentication

**3. Authorization Errors (HTTP 403)**
- User attempting to access another user's order
- Rider attempting to update unassigned order
- Non-admin attempting admin operations
- Unauthorized room join attempts

**4. Not Found Errors (HTTP 404)**
- Order ID not found
- Rider ID not found
- User ID not found

**5. Conflict Errors (HTTP 409)**
- Rider already assigned to order
- Order already in terminal status (DELIVERED/CANCELLED)

**6. Rate Limit Errors (HTTP 429)**
- Location update throttling
- Too many API requests

**7. External Service Errors (HTTP 502/503)**
- Distance Matrix API failures
- Redis connection failures
- MongoDB connection failures

### Error Handling Strategies

**Graceful Degradation:**
- ETA calculation failures retain previous ETA
- Redis cache failures fall back to MongoDB
- Socket disconnections trigger automatic reconnection

**Retry Logic:**
- Background jobs retry 3 times with exponential backoff
- Distance Matrix API calls retry once after 1 second
- MongoDB operations use built-in retry logic

**Error Logging:**
- All errors logged with context (userId, orderId, operation)
- Failed jobs logged with full job data
- Unauthorized access attempts logged for security audit

**Client Error Handling:**
- Socket disconnections show reconnection UI
- API errors display user-friendly messages
- Network failures trigger retry with exponential backoff

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of valid status transitions
- Edge cases (empty coordinates, boundary values)
- Error conditions (invalid JWT, missing fields)
- Integration points (Socket.io event emission, API mocking)
- UI component rendering with specific props

**Property-Based Tests** focus on:
- Universal properties across all inputs (status transition validation for all combinations)
- Randomized order/rider/location generation
- Invariants (timeline always grows, GeoJSON format always valid)
- Round-trip properties (cache write then read returns same data)

### Property-Based Testing Configuration

**Framework:** fast-check (TypeScript/JavaScript)

**Configuration:**
- Minimum 100 iterations per property test
- Custom generators for Order, Rider, Location, Status enums
- Shrinking enabled for minimal failing examples

**Test Tagging Format:**
```typescript
// Feature: order-tracking-system, Property 2: Status Transition Validation
it('validates all status transitions according to state machine', () => {
  fc.assert(
    fc.property(
      fc.record({
        currentStatus: fc.constantFrom(...Object.values(OrderStatus)),
        newStatus: fc.constantFrom(...Object.values(OrderStatus))
      }),
      ({ currentStatus, newStatus }) => {
        const isValid = validateStatusTransition(currentStatus, newStatus)
        const expectedValid = isTransitionAllowed(currentStatus, newStatus)
        expect(isValid).toBe(expectedValid)
      }
    ),
    { numRuns: 100 }
  )
})
```

### Test Coverage Requirements

**Backend (NestJS):**
- Orders Module: 90% coverage
- Riders Module: 90% coverage
- Tracking Gateway: 85% coverage (socket testing complexity)
- ETA Service: 90% coverage
- Jobs Module: 85% coverage

**Frontend (React Native):**
- Redux slices: 90% coverage
- Socket integration: 80% coverage
- UI components: 75% coverage (visual testing limitations)

**Integration Tests:**
- End-to-end order lifecycle flow
- Socket connection and room management
- Background job execution
- Redis caching behavior
- API error handling

### Mock Strategy

**External Services:**
- Google Distance Matrix API: Mock with configurable responses
- Redis: Use ioredis-mock for unit tests, real Redis for integration
- MongoDB: Use mongodb-memory-server for unit tests
- Socket.io: Use socket.io-client for integration tests

**Time-Based Testing:**
- Use fake timers (Jest/Sinon) for stale order detection
- Mock Date.now() for timestamp testing
- Fast-forward time for throttling tests

## Deployment Considerations

### Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/shravankirana
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d

# External APIs
GOOGLE_MAPS_API_KEY=your-api-key

# Socket.io
SOCKET_IO_CORS_ORIGIN=http://localhost:3000,http://localhost:19006

# Background Jobs
STALE_ORDER_THRESHOLD_MINUTES=10
ANOMALY_THRESHOLD_HOURS=2
ETA_RECALC_INTERVAL_MINUTES=5

# Performance
REDIS_CACHE_TTL_SECONDS=300
ETA_CACHE_TTL_SECONDS=120
LOCATION_THROTTLE_SECONDS=5
MAX_CONCURRENT_JOBS=5
```

### Scaling Considerations

**Horizontal Scaling:**
- Use Redis adapter for Socket.io to support multiple backend instances
- Sticky sessions not required due to stateless JWT authentication
- BullMQ automatically distributes jobs across workers

**Database Optimization:**
- Compound indexes for common queries: `{ status: 1, createdAt: 1 }`
- 2dsphere index for geospatial queries
- Read replicas for heavy read operations

**Caching Strategy:**
- Redis for active orders (5-minute TTL)
- ETA responses cached (2-minute TTL)
- Rider locations not cached (real-time requirement)

**Monitoring:**
- Socket connection count and room subscriptions
- Background job queue length and processing time
- Distance Matrix API usage and costs
- Database query performance
- Redis hit/miss ratio
