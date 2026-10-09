# Implementation Plan: Real-Time Order Tracking System

## Overview

This implementation plan breaks down the Real-Time Order Tracking System into discrete coding tasks. The system will be built incrementally, starting with core data models and services, then adding real-time communication, background jobs, and finally the client applications. Each task builds on previous work to ensure continuous integration.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Install NestJS dependencies: @nestjs/websockets, @nestjs/platform-socket.io, socket.io, @nestjs/bull, bull, ioredis
  - Install validation dependencies: class-validator, class-transformer
  - Install Google Maps client: @googlemaps/google-maps-services-js
  - Configure TypeScript for strict mode
  - Set up environment variables configuration
  - _Requirements: All requirements (infrastructure)_

- [x] 2. Implement Order data model and schema
  - [x] 2.1 Create Order schema with Mongoose
    - Define OrderStatus enum (PENDING, CONFIRMED, PACKED, ASSIGNED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED)
    - Define Order schema with all required fields (userId, items, totalAmount, status, timeline, riderId, deliveryAddress, paymentStatus, estimatedDeliveryTime, actualDeliveryTime, cancellationReason)
    - Add GeoJSON coordinates to deliveryAddress
    - Create indexes on userId, status, riderId
    - Create compound index on status and createdAt
    - _Requirements: 1.1, 13.1, 13.2, 13.3, 10.3_
  
  - [x] 2.2 Write property test for Order schema
    - **Property 4: Initial Order Status**
    - **Validates: Requirements 1.6, 13.6**
  
  - [x] 2.3 Write property test for timeline structure
    - **Property 43: Timeline Entry Structure**
    - **Validates: Requirements 13.3**

- [x] 3. Implement Rider data model and schema
  - [x] 3.1 Extend User schema for Rider
    - Add isAvailable, isOnline boolean fields with default false
    - Add currentLocation as GeoJSON Point
    - Add lastLocationUpdate timestamp field
    - Create 2dsphere geospatial index on currentLocation
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 13.4_
  
  - [x] 3.2 Write property test for Rider defaults
    - **Property 45: Rider Default Values**
    - **Validates: Requirements 13.7**
  
  - [x] 3.3 Write property test for GeoJSON format
    - **Property 10: GeoJSON Location Format**
    - **Validates: Requirements 3.5, 13.2**

- [x] 4. Create DTOs with validation decorators
  - [x] 4.1 Create CreateOrderDto
    - Add validation for items array, totalAmount (min 0), deliveryAddress, paymentStatus enum
    - Add nested AddressDto with coordinate validation (lat: -90 to 90, lng: -180 to 180)
    - _Requirements: 9.1, 9.8_
  
  - [x] 4.2 Create UpdateStatusDto and AssignRiderDto
    - Add OrderStatus enum validation
    - Add MongoId validation for riderId
    - _Requirements: 1.3, 3.4_
  
  - [x] 4.3 Create LocationDto
    - Add coordinate validation (latitude: -90 to 90, longitude: -180 to 180)
    - Add optional accuracy field
    - _Requirements: 4.1, 9.8_
  
  - [x] 4.4 Write property test for DTO validation
    - **Property 28: Order Creation Validation**
    - **Validates: Requirements 9.1**
  
  - [x] 4.5 Write property test for coordinate validation
    - **Property 31: Location Coordinate Validation**
    - **Validates: Requirements 9.8**

- [x] 5. Implement Orders Service with status management
  - [x] 5.1 Create OrdersService with CRUD operations
    - Implement create, findById, findByUserId, findActiveOrders methods
    - Use lean() queries and field projection for performance
    - _Requirements: 1.1, 10.1, 10.2_
  
  - [x] 5.2 Implement status transition validation
    - Create validateStatusTransition method with state machine logic
    - Define allowed transitions map
    - _Requirements: 1.3, 1.5, 1.7_
  
  - [x] 5.3 Implement updateStatus method
    - Validate transition before updating
    - Add timeline entry with timestamp and changedBy
    - Invalidate Redis cache after update
    - _Requirements: 1.2, 1.3, 10.6_
  
  - [x] 5.4 Implement rider assignment methods
    - Create assignRider and unassignRider methods
    - Validate rider availability and online status
    - _Requirements: 3.4_
  
  - [x] 5.5 Write property test for status transitions
    - **Property 2: Status Transition Validation**
    - **Validates: Requirements 1.3, 1.5, 9.3**
  
  - [x] 5.6 Write property test for timeline recording
    - **Property 1: Timeline Recording Invariant**
    - **Validates: Requirements 1.2**
  
  - [x] 5.7 Write property test for cancellation availability
    - **Property 5: Cancellation Availability**
    - **Validates: Requirements 1.7**
  
  - [x] 5.8 Write property test for payment verification
    - **Property 29: Payment Verification for Confirmation**
    - **Validates: Requirements 9.2**

- [x] 6. Implement Riders Service with location tracking
  - [x] 6.1 Create RidersService with rider management
    - Implement updateAvailability, updateOnlineStatus methods
    - Implement findAvailableRiders query
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [x] 6.2 Implement location update with throttling
    - Create updateLocation method
    - Implement validateLocationUpdate to check 5-second throttle using Redis
    - Store throttle timestamp in Redis with 5-second TTL
    - Update currentLocation and lastLocationUpdate
    - _Requirements: 3.7, 4.2, 4.6_
  
  - [x] 6.3 Implement geospatial queries
    - Create findNearbyRiders using $near query with 2dsphere index
    - _Requirements: 3.6_
  
  - [x] 6.4 Write property test for location throttling
    - **Property 11: Location Update Throttling**
    - **Validates: Requirements 3.7, 4.4, 4.5, 10.7**
  
  - [x] 6.5 Write property test for location persistence
    - **Property 13: Location Persistence**
    - **Validates: Requirements 4.2, 4.6**
  
  - [x] 6.6 Write property test for rider assignment validation
    - **Property 9: Rider Assignment Validation**
    - **Validates: Requirements 3.4**

- [x] 7. Implement Redis caching layer
  - [x] 7.1 Create CacheService wrapper
    - Implement get, set, delete methods with error handling
    - Configure 5-minute TTL for order cache
    - Implement fallback to direct queries on Redis failure
    - _Requirements: 10.5, 10.6, 11.8_
  
  - [x] 7.2 Integrate caching in OrdersService
    - Check cache before MongoDB queries
    - Invalidate cache on status updates
    - _Requirements: 10.5, 10.6_
  
  - [x] 7.3 Write property test for cache behavior
    - **Property 32: Redis Cache for Active Orders**
    - **Validates: Requirements 10.5**
  
  - [x] 7.4 Write property test for cache invalidation
    - **Property 33: Cache Invalidation on Status Change**
    - **Validates: Requirements 10.6**
  
  - [x] 7.5 Write property test for Redis fallback
    - **Property 40: Redis Fallback Behavior**
    - **Validates: Requirements 11.8**

- [x] 8. Checkpoint - Ensure core services work
  - Run all tests to verify Order and Rider services
  - Test status transitions manually
  - Verify database indexes are created
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement ETA Service with Distance Matrix integration
  - [x] 9.1 Create ETAService with Google Maps client
    - Initialize Google Maps client with API key from env
    - Implement callDistanceMatrixAPI method
    - Parse duration from API response
    - _Requirements: 6.1, 6.3, 6.6_
  
  - [x] 9.2 Implement ETA calculation and caching
    - Create calculateETA method using rider location and delivery address
    - Implement 2-minute response caching in Redis
    - Generate cache key from coordinates
    - _Requirements: 6.1, 6.4, 10.8_
  
  - [x] 9.3 Implement ETA recalculation for orders
    - Create recalculateForOrder method
    - Check order status is OUT_FOR_DELIVERY
    - Update order estimatedDeliveryTime field
    - _Requirements: 6.2, 6.4_
  
  - [x] 9.4 Implement error handling for API failures
    - Catch API errors and log them
    - Retain previous ETA on failure
    - _Requirements: 6.5, 11.4_
  
  - [x] 9.5 Write property test for ETA calculation inputs
    - **Property 24: ETA Calculation Inputs**
    - **Validates: Requirements 6.3**
  
  - [x] 9.6 Write property test for ETA persistence
    - **Property 25: ETA Persistence**
    - **Validates: Requirements 6.4**
  
  - [x] 9.7 Write property test for ETA error handling
    - **Property 26: ETA Calculation Error Handling**
    - **Validates: Requirements 6.5, 11.4**
  
  - [x] 9.8 Write property test for ETA caching
    - **Property 34: ETA Response Caching**
    - **Validates: Requirements 10.8**

- [x] 10. Implement Socket.io Tracking Gateway
  - [x] 10.1 Create TrackingGateway with JWT authentication
    - Set up WebSocketGateway with CORS configuration
    - Implement WsJwtGuard for socket authentication
    - Handle connection and disconnection events
    - Extract userId/riderId from JWT payload
    - _Requirements: 5.1, 5.2, 9.6_
  
  - [x] 10.2 Implement room management
    - Create handleJoinOrderRoom with authorization checks
    - Validate user owns order or is admin
    - Validate rider is assigned to order
    - Generate room names in format: order_{orderId}, user_{userId}, rider_{riderId}
    - _Requirements: 5.3, 5.4, 5.5, 9.7_
  
  - [x] 10.3 Implement location update handler
    - Create handleRiderLocationUpdate method
    - Validate authentication and throttling
    - Call RidersService.updateLocation
    - Broadcast to all order rooms for rider's active orders
    - _Requirements: 4.1, 4.3_
  
  - [x] 10.4 Implement broadcasting methods
    - Create broadcastOrderStatusUpdate
    - Create broadcastRiderLocationUpdate
    - Create broadcastETAUpdate
    - Emit events to appropriate rooms
    - _Requirements: 5.6, 5.7, 5.8_
  
  - [x] 10.5 Write property test for socket authentication
    - **Property 15: Socket Authentication**
    - **Validates: Requirements 5.1, 5.2, 9.6**
  
  - [x] 10.6 Write property test for room naming
    - **Property 16: Room Naming Convention**
    - **Validates: Requirements 5.3**
  
  - [x] 10.7 Write property test for order room authorization
    - **Property 17: Order Room Authorization**
    - **Validates: Requirements 5.4, 9.7**
  
  - [x] 10.8 Write property test for rider room authorization
    - **Property 18: Rider Room Authorization**
    - **Validates: Requirements 5.5, 9.7**

- [x] 11. Integrate socket events with services
  - [x] 11.1 Inject TrackingGateway into OrdersService
    - Call broadcastOrderStatusUpdate after status changes
    - Call broadcastETAUpdate after ETA recalculation
    - _Requirements: 5.6, 5.8_
  
  - [x] 11.2 Inject TrackingGateway into RidersService
    - Call broadcastRiderLocationUpdate after location updates
    - Trigger ETA recalculation for OUT_FOR_DELIVERY orders
    - _Requirements: 5.7, 6.2_
  
  - [x] 11.3 Write property test for event emission on status change
    - **Property 19: Order Status Event Emission**
    - **Validates: Requirements 5.6**
  
  - [x] 11.4 Write property test for event emission on location update
    - **Property 20: Rider Location Event Emission**
    - **Validates: Requirements 5.7**
  
  - [x] 11.5 Write property test for ETA event emission
    - **Property 21: ETA Event Emission**
    - **Validates: Requirements 5.8, 6.7**

- [x] 12. Implement Orders Controller with REST endpoints
  - [x] 12.1 Create OrdersController with CRUD endpoints
    - POST /orders - create order with JwtAuthGuard
    - GET /orders/:id - get order with ownership verification
    - GET /orders/user/:userId - get user's orders
    - _Requirements: 1.1, 9.5_
  
  - [x] 12.2 Create status management endpoints
    - PATCH /orders/:id/status - update status with role-based authorization
    - Validate rider authorization for rider-initiated updates
    - _Requirements: 1.3, 1.4, 9.4_
  
  - [x] 12.3 Create rider assignment endpoint
    - PATCH /orders/:id/assign-rider - admin only
    - Validate rider availability before assignment
    - Trigger initial ETA calculation
    - _Requirements: 3.4, 6.1_
  
  - [x] 12.4 Write property test for rider authorization
    - **Property 3: Rider Authorization for Status Updates**
    - **Validates: Requirements 1.4, 9.4**
  
  - [x] 12.5 Write property test for order ownership verification
    - **Property 30: Order Ownership Verification**
    - **Validates: Requirements 9.5**
  
  - [x] 12.6 Write unit tests for error responses
    - Test invalid transitions return HTTP 400 with descriptive messages
    - Test unauthorized access returns HTTP 403
    - Test not found returns HTTP 404
    - _Requirements: 11.5, 11.7_

- [x] 13. Checkpoint - Test real-time communication
  - Use Postman or socket.io-client to test socket connections
  - Verify JWT authentication works
  - Test room joins and event broadcasting
  - Verify location updates trigger ETA recalculation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Background Jobs Module with BullMQ
  - [x] 14.1 Set up BullMQ queues and processors
    - Create JobsModule with BullModule configuration
    - Configure Redis connection for BullMQ
    - Set up job retry logic (3 attempts, exponential backoff)
    - _Requirements: 12.1, 12.5, 12.6_
  
  - [x] 14.2 Implement stale order check job
    - Create processor for "stale-order-check" queue
    - Query orders in PENDING status older than 10 minutes
    - Cancel orders and set cancellationReason to "AUTO_CANCELLED_STALE"
    - Schedule job to run every 2 minutes
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 14.3 Implement anomaly detection job
    - Create processor for "anomaly-check" queue
    - Query orders in OUT_FOR_DELIVERY status older than 2 hours
    - Flag orders as anomalous and notify admins
    - Schedule job to run every 10 minutes
    - _Requirements: 2.3, 2.4, 2.6_
  
  - [x] 14.4 Implement ETA recalculation job
    - Create processor for "eta-recalculation" queue
    - Query all orders in OUT_FOR_DELIVERY status
    - Recalculate ETA for each order
    - Schedule job to run every 5 minutes
    - _Requirements: 6.2, 12.4_
  
  - [x] 14.5 Write property test for stale order cancellation
    - **Property 6: Stale Order Auto-Cancellation**
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 14.6 Write property test for anomaly detection
    - **Property 7: Anomalous Order Detection**
    - **Validates: Requirements 2.3, 2.4**
  
  - [x] 14.7 Write property test for job retry logic
    - **Property 41: Job Retry with Exponential Backoff**
    - **Validates: Requirements 12.5**
  
  - [x] 14.8 Write property test for dead letter queue
    - **Property 42: Dead Letter Queue for Failed Jobs**
    - **Validates: Requirements 12.6**

- [x] 15. Implement Customer App order tracking screen
  - [x] 15.1 Create Redux slice for order tracking
    - Define state shape (currentOrder, riderLocation, connectionStatus)
    - Create actions for order updates, location updates, ETA updates
    - Create reducers to handle socket events
    - _Requirements: 7.1, 7.8_
  
  - [x] 15.2 Implement Socket.io client integration
    - Create socket service with JWT authentication
    - Connect to /tracking namespace
    - Implement joinOrderRoom and leaveOrderRoom
    - Handle orderStatusUpdate, riderLocationUpdate, etaUpdate events
    - Implement automatic reconnection logic
    - _Requirements: 5.1, 7.7, 11.3_
  
  - [x] 15.3 Create OrderTrackingScreen component
    - Display animated status stepper with current order status
    - Show order details and timeline
    - _Requirements: 7.1_
  
  - [x] 15.4 Implement map view with markers
    - Use React Native Maps with Google provider
    - Display rider marker and customer marker
    - Animate rider marker on location updates
    - Draw polyline from rider to customer
    - Show map only when order is OUT_FOR_DELIVERY
    - _Requirements: 7.2, 7.3, 7.4_
  
  - [x] 15.5 Create rider info card and ETA banner
    - Display rider name and contact details
    - Show estimated delivery time in banner
    - Update ETA in real-time
    - _Requirements: 7.5, 7.6_
  
  - [x] 15.6 Write unit tests for Redux slice
    - Test reducers handle socket events correctly
    - Test state updates for status changes
    - _Requirements: 7.8_
  
  - [x] 15.7 Write unit tests for socket reconnection
    - Test automatic reconnection on disconnect
    - Test room re-join after reconnection
    - _Requirements: 7.7, 11.3_

- [x] 16. Implement Admin Dashboard order management
  - [x] 16.1 Create order management page component
    - Display table of all active orders with status badges
    - Implement status filtering (show only active deliveries)
    - Display order timeline with timestamps
    - _Requirements: 8.1, 8.6, 8.8_
  
  - [x] 16.2 Implement status change controls
    - Add dropdown to change order status
    - Send PATCH request to backend API on change
    - Validate admin role before allowing changes
    - _Requirements: 8.2, 8.4_
  
  - [x] 16.3 Implement rider assignment controls
    - Add dropdown to assign riders to orders
    - Fetch available riders from API
    - Send assignment request to backend
    - _Requirements: 8.3, 8.4_
  
  - [x] 16.4 Integrate Socket.io for real-time updates
    - Connect to /tracking namespace with admin JWT
    - Subscribe to all active order rooms
    - Update order list on orderStatusUpdate events
    - _Requirements: 8.7_
  
  - [x] 16.5 Create live rider tracking map
    - Display map with all active rider locations
    - Update rider markers on location updates
    - Show rider info on marker click
    - _Requirements: 8.5_
  
  - [x] 16.6 Write unit tests for order filtering
    - Test active orders filter logic
    - _Requirements: 8.6_
  
  - [x] 16.7 Write integration tests for admin actions
    - Test status change API calls
    - Test rider assignment API calls
    - _Requirements: 8.4_

- [x] 17. Implement error handling and logging
  - [x] 17.1 Create global exception filter
    - Map exceptions to appropriate HTTP status codes
    - Return descriptive error messages
    - Log all errors with context
    - _Requirements: 11.5, 11.7_
  
  - [x] 17.2 Implement unauthorized access logging
    - Log unauthorized room join attempts
    - Log failed authentication attempts
    - Include user ID, resource, and timestamp
    - _Requirements: 11.6_
  
  - [x] 17.3 Add error handling to client apps
    - Display reconnection indicator on socket disconnect
    - Show user-friendly error messages for API failures
    - Implement retry logic with exponential backoff
    - _Requirements: 11.2_
  
  - [x] 17.4 Write property test for error messages
    - **Property 37: Invalid Transition Error Messages**
    - **Validates: Requirements 11.5**
  
  - [x] 17.5 Write property test for unauthorized access logging
    - **Property 38: Unauthorized Room Access Logging**
    - **Validates: Requirements 11.6**
  
  - [x] 17.6 Write property test for HTTP error codes
    - **Property 39: Database Error HTTP Codes**
    - **Validates: Requirements 11.7**

- [x] 18. Add referential integrity validation
  - [x] 18.1 Implement pre-save hooks for Order schema
    - Validate userId references existing User
    - Validate riderId references existing User with rider role
    - Reject saves with invalid references
    - _Requirements: 13.5_
  
  - [x] 18.2 Write property test for referential integrity
    - **Property 44: Referential Integrity for Order References**
    - **Validates: Requirements 13.5**

- [x] 19. Configure environment variables and deployment
  - [x] 19.1 Create .env.example files
    - Document all required environment variables
    - Include MongoDB URI, Redis URL, JWT secret, Google Maps API key
    - Add Socket.io CORS origins
    - Add job configuration (thresholds, intervals)
    - _Requirements: All requirements (configuration)_
  
  - [x] 19.2 Create deployment documentation
    - Document setup steps for backend, customer app, admin dashboard
    - Include database index creation commands
    - Document Redis setup for BullMQ and caching
    - Add Socket.io scaling considerations (Redis adapter)
    - _Requirements: All requirements (deployment)_

- [x] 20. Final checkpoint - End-to-end testing
  - Create test order through customer app
  - Assign rider through admin dashboard
  - Simulate rider location updates
  - Verify real-time updates in customer app
  - Verify ETA calculations and updates
  - Test background jobs (stale orders, anomalies)
  - Verify all socket events are working
  - Test error scenarios (offline rider, API failures)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation with full test coverage
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Checkpoints ensure incremental validation at key milestones
- Background jobs should be tested with fake timers to avoid waiting for actual intervals
- Socket.io testing requires socket.io-client for integration tests
- Google Distance Matrix API should be mocked in tests to avoid API costs
