# Requirements Document: Real-Time Order Tracking System

## Introduction

This document specifies the requirements for a production-ready real-time order tracking system for the ShravanKirana grocery delivery app. The system provides Zepto-style live tracking with complete order lifecycle management, rider assignment, GPS tracking, dynamic ETA calculation, and administrative controls.

## Glossary

- **Order_System**: The backend NestJS service managing order lifecycle and state transitions
- **Tracking_Gateway**: The Socket.io gateway handling real-time communication between clients and server
- **Rider_Service**: The service managing rider availability, location, and assignment
- **ETA_Calculator**: The service computing estimated delivery times using Google Distance Matrix API
- **Job_Processor**: The BullMQ worker handling background tasks like auto-cancellation and ETA updates
- **Customer_App**: The React Native mobile application for customers
- **Admin_Dashboard**: The Astro + React web application for administrators
- **Active_Order**: An order in any status except DELIVERED or CANCELLED
- **Stale_Order**: An order in PENDING status for more than 10 minutes
- **Anomalous_Order**: An order in OUT_FOR_DELIVERY status for more than 2 hours
- **Location_Update**: A GPS coordinate update from a rider with timestamp
- **Order_Room**: A Socket.io room scoped to a specific order (format: order_<orderId>)
- **User_Room**: A Socket.io room scoped to a specific user (format: user_<userId>)
- **Rider_Room**: A Socket.io room scoped to a specific rider (format: rider_<riderId>)

## Requirements

### Requirement 1: Order Lifecycle Management

**User Story:** As a system administrator, I want complete control over order status transitions, so that I can manage the delivery workflow from placement to completion.

#### Acceptance Criteria

1. THE Order_System SHALL support the following status flow: PENDING → CONFIRMED → PACKED → ASSIGNED → OUT_FOR_DELIVERY → DELIVERED → CANCELLED
2. WHEN an order status changes, THE Order_System SHALL record the timestamp and previous status in the order timeline
3. WHEN an administrator changes order status from PENDING to ASSIGNED, THE Order_System SHALL validate the transition is allowed
4. WHEN a rider changes order status from ASSIGNED to DELIVERED, THE Order_System SHALL validate the rider owns the order
5. THE Order_System SHALL prevent invalid status transitions (e.g., DELIVERED to PENDING)
6. WHEN an order is created, THE Order_System SHALL initialize it with PENDING status
7. THE Order_System SHALL allow transition to CANCELLED from any status except DELIVERED

### Requirement 2: Automatic Order Management

**User Story:** As a system operator, I want automatic handling of stale and anomalous orders, so that the system maintains operational efficiency without manual intervention.

#### Acceptance Criteria

1. WHEN an order remains in PENDING status for more than 10 minutes, THE Job_Processor SHALL automatically cancel the order
2. WHEN an order is automatically cancelled, THE Order_System SHALL record the cancellation reason as "AUTO_CANCELLED_STALE"
3. WHEN an order remains in OUT_FOR_DELIVERY status for more than 2 hours, THE Job_Processor SHALL flag it as anomalous
4. WHEN an order is flagged as anomalous, THE Order_System SHALL notify administrators
5. THE Job_Processor SHALL check for stale orders every 2 minutes
6. THE Job_Processor SHALL check for anomalous orders every 10 minutes

### Requirement 3: Rider Management

**User Story:** As a delivery coordinator, I want to manage rider availability and assignments, so that orders are efficiently distributed to active riders.

#### Acceptance Criteria

1. THE Rider_Service SHALL track rider availability status (available/unavailable)
2. THE Rider_Service SHALL track rider online status (online/offline)
3. WHEN a rider goes offline, THE Rider_Service SHALL mark all assigned orders as requiring reassignment
4. WHEN an administrator assigns an order to a rider, THE Rider_Service SHALL validate the rider is available and online
5. THE Rider_Service SHALL store rider current location as GeoJSON Point format
6. THE Rider_Service SHALL create a 2dsphere geospatial index on rider location field
7. WHEN a rider updates location, THE Rider_Service SHALL validate the update is at least 5 seconds after the previous update

### Requirement 4: Real-Time Location Tracking

**User Story:** As a rider, I want to send my GPS location updates to the system, so that customers can track my position in real-time.

#### Acceptance Criteria

1. WHEN a rider sends a location update, THE Tracking_Gateway SHALL validate the rider is authenticated
2. WHEN a valid location update is received, THE Rider_Service SHALL update the rider's current location in the database
3. WHEN a rider location is updated, THE Tracking_Gateway SHALL broadcast the update to all subscribers of the rider's active orders
4. THE Tracking_Gateway SHALL throttle location updates to minimum 5 seconds between updates per rider
5. WHEN a location update is throttled, THE Tracking_Gateway SHALL reject the update with a throttle error
6. THE Rider_Service SHALL record the timestamp of each location update

### Requirement 5: Real-Time Communication Infrastructure

**User Story:** As a system architect, I want secure real-time communication channels, so that order updates reach the correct users without unauthorized access.

#### Acceptance Criteria

1. WHEN a client connects to the socket server, THE Tracking_Gateway SHALL authenticate the connection using JWT token
2. WHEN authentication fails, THE Tracking_Gateway SHALL reject the socket connection
3. THE Tracking_Gateway SHALL create room namespaces in the format: user_<userId>, rider_<riderId>, order_<orderId>
4. WHEN a user joins an order room, THE Tracking_Gateway SHALL validate the user is authorized for that order
5. WHEN a rider joins an order room, THE Tracking_Gateway SHALL validate the rider is assigned to that order
6. THE Tracking_Gateway SHALL emit orderStatusUpdate events to order rooms when status changes
7. THE Tracking_Gateway SHALL emit riderLocationUpdate events to order rooms when rider location changes
8. THE Tracking_Gateway SHALL emit etaUpdate events to order rooms when ETA is recalculated

### Requirement 6: Dynamic ETA Calculation

**User Story:** As a customer, I want to see accurate estimated delivery times that update as the rider moves, so that I can plan for the delivery.

#### Acceptance Criteria

1. WHEN an order is assigned to a rider, THE ETA_Calculator SHALL compute initial ETA using Google Distance Matrix API
2. WHEN a rider location update is received, THE ETA_Calculator SHALL recalculate ETA if the order is OUT_FOR_DELIVERY
3. THE ETA_Calculator SHALL use rider current location and customer delivery address for distance calculation
4. WHEN ETA is calculated, THE Order_System SHALL store the estimated delivery time in the order document
5. WHEN ETA calculation fails, THE ETA_Calculator SHALL log the error and retain the previous ETA
6. THE ETA_Calculator SHALL include travel mode as "driving" in Distance Matrix API requests
7. WHEN ETA is recalculated, THE Tracking_Gateway SHALL broadcast the updated ETA to the order room

### Requirement 7: Customer Tracking Interface

**User Story:** As a customer, I want to see my order progress and rider location on a map, so that I know when to expect my delivery.

#### Acceptance Criteria

1. WHEN a customer views order tracking, THE Customer_App SHALL display an animated status stepper showing current order status
2. WHEN an order is OUT_FOR_DELIVERY, THE Customer_App SHALL display a map with rider and customer location markers
3. WHEN rider location updates are received, THE Customer_App SHALL animate the rider marker to the new position
4. THE Customer_App SHALL display a polyline route from rider location to customer address
5. WHEN an order has an ETA, THE Customer_App SHALL display the estimated delivery time in a banner
6. THE Customer_App SHALL display rider information including name and contact details
7. WHEN the socket connection is lost, THE Customer_App SHALL attempt automatic reconnection
8. WHEN order status changes, THE Customer_App SHALL update the status stepper in real-time

### Requirement 8: Admin Dashboard Controls

**User Story:** As an administrator, I want to manage orders and track riders from a dashboard, so that I can oversee all active deliveries.

#### Acceptance Criteria

1. WHEN an administrator views the dashboard, THE Admin_Dashboard SHALL display all active orders with status badges
2. THE Admin_Dashboard SHALL provide dropdown controls to change order status
3. THE Admin_Dashboard SHALL provide dropdown controls to assign riders to orders
4. WHEN an administrator changes order status, THE Admin_Dashboard SHALL send the update to the backend API
5. THE Admin_Dashboard SHALL display a live map showing all active rider locations
6. THE Admin_Dashboard SHALL filter orders by status (show only active deliveries)
7. WHEN order updates are received via socket, THE Admin_Dashboard SHALL update the order list in real-time
8. THE Admin_Dashboard SHALL display order timeline showing all status changes with timestamps

### Requirement 9: Data Validation and Security

**User Story:** As a security engineer, I want all inputs validated and access controlled, so that the system is protected from invalid data and unauthorized access.

#### Acceptance Criteria

1. THE Order_System SHALL validate all order creation requests using class-validator decorators
2. THE Order_System SHALL verify payment status before allowing order confirmation
3. WHEN a status transition is requested, THE Order_System SHALL validate the transition is allowed from current status
4. WHEN a rider attempts to update order status, THE Order_System SHALL verify the rider is assigned to that order
5. WHEN a user attempts to view order details, THE Order_System SHALL verify the user owns the order or is an administrator
6. THE Tracking_Gateway SHALL validate JWT tokens for all socket connections
7. THE Tracking_Gateway SHALL validate room access permissions before allowing joins
8. THE Rider_Service SHALL validate location coordinates are within valid latitude/longitude ranges

### Requirement 10: Performance Optimization

**User Story:** As a system architect, I want optimized database queries and caching, so that the system handles high load efficiently.

#### Acceptance Criteria

1. THE Order_System SHALL use MongoDB lean() queries when full document methods are not needed
2. THE Order_System SHALL use field projection to retrieve only required fields
3. THE Order_System SHALL create indexes on userId, status, and riderId fields in the orders collection
4. THE Rider_Service SHALL create a 2dsphere geospatial index on the location field
5. THE Order_System SHALL cache active orders in Redis with 5-minute TTL
6. WHEN an order status changes, THE Order_System SHALL invalidate the Redis cache for that order
7. THE Tracking_Gateway SHALL throttle location updates to prevent database overload
8. THE ETA_Calculator SHALL cache Distance Matrix API responses for 2 minutes to reduce API calls

### Requirement 11: Error Handling and Resilience

**User Story:** As a system operator, I want graceful error handling and recovery, so that temporary failures don't disrupt the service.

#### Acceptance Criteria

1. WHEN a rider goes offline during delivery, THE Order_System SHALL retain the order assignment and notify administrators
2. WHEN socket connection fails, THE Customer_App SHALL display a reconnection indicator
3. WHEN socket reconnection succeeds, THE Customer_App SHALL re-join the order room and fetch latest status
4. WHEN Distance Matrix API fails, THE ETA_Calculator SHALL log the error and retain previous ETA
5. WHEN an invalid status transition is attempted, THE Order_System SHALL return a descriptive error message
6. WHEN unauthorized room access is attempted, THE Tracking_Gateway SHALL reject the request and log the attempt
7. WHEN database query fails, THE Order_System SHALL return appropriate HTTP error codes
8. WHEN Redis cache is unavailable, THE Order_System SHALL fall back to direct database queries

### Requirement 12: Background Job Processing

**User Story:** As a system architect, I want reliable background job processing, so that scheduled tasks execute consistently.

#### Acceptance Criteria

1. THE Job_Processor SHALL use BullMQ with Redis for job queue management
2. THE Job_Processor SHALL define a "stale-order-check" job that runs every 2 minutes
3. THE Job_Processor SHALL define an "anomaly-check" job that runs every 10 minutes
4. THE Job_Processor SHALL define an "eta-recalculation" job that runs every 5 minutes for active deliveries
5. WHEN a job fails, THE Job_Processor SHALL retry up to 3 times with exponential backoff
6. WHEN a job fails after all retries, THE Job_Processor SHALL log the failure and move to dead letter queue
7. THE Job_Processor SHALL process jobs concurrently with a maximum of 5 concurrent jobs

### Requirement 13: Database Schema Design

**User Story:** As a database administrator, I want well-structured schemas with proper relationships, so that data integrity is maintained.

#### Acceptance Criteria

1. THE Order_System SHALL store orders with fields: userId (ref), items, totalAmount, status, timeline, riderId (ref), deliveryAddress, paymentStatus, estimatedDeliveryTime, actualDeliveryTime
2. THE Order_System SHALL store deliveryAddress with embedded coordinates in GeoJSON format
3. THE Order_System SHALL store timeline as an array of objects with status, timestamp, and changedBy fields
4. THE Rider_Service SHALL extend the User schema with fields: isAvailable, isOnline, currentLocation (GeoJSON Point), lastLocationUpdate
5. THE Order_System SHALL enforce referential integrity for userId and riderId references
6. THE Order_System SHALL set default value of PENDING for order status field
7. THE Rider_Service SHALL set default values of false for isAvailable and isOnline fields
