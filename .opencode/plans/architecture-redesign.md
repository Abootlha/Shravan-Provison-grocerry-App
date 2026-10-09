# ShravanKirana - Complete Architecture Redesign Plan

**Version:** 1.0  
**Date:** March 29, 2026  
**Scale Target:** 5,000 orders/day  
**Infrastructure Budget:** $2,000/month  
**Cloud Provider:** AWS  
**Service Mesh:** Istio  
**API Style:** REST (external) + gRPC (internal)  
**Message Queue:** RabbitMQ  
**Search:** MongoDB Atlas Search  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [AWS Infrastructure Setup](#2-aws-infrastructure-setup)
3. [Kubernetes & Service Mesh](#3-kubernetes--service-mesh)
4. [Microservices Architecture](#4-microservices-architecture)
5. [Database Architecture](#5-database-architecture)
6. [Message Queue (RabbitMQ)](#6-message-queue-rabbitmq)
7. [API Gateway](#7-api-gateway)
8. [Customer Mobile App](#8-customer-mobile-app)
9. [Rider Mobile App](#9-rider-mobile-app)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Real-time Communication](#11-real-time-communication)
12. [Security Architecture](#12-security-architecture)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Cost Estimation](#16-cost-estimation)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     AWS Cloud                                            │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              Amazon Route 53                                        │   │
│  │                              (DNS & Domain)                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           AWS CloudFront (CDN)                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        AWS Application Load Balancer                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                     ┌────────────────────┼────────────────────┐                        │
│                     │                    │                    │                        │
│                     ▼                    ▼                    ▼                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   API Gateway        │  │  WebSocket Gateway   │  │   Admin Portal       │        │
│  │   (Kong/Nginx)      │  │   (Socket.io)       │  │   (Astro+React)      │        │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘        │
│                     │                    │                    │                        │
│                     └────────────────────┼────────────────────┘                        │
│                                          │                                              │
│  ┌──────────────────────────────────────┼──────────────────────────────────────┐    │
│  │                              Istio Service Mesh                                  │    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               │    │
│  │  │ Auth   │  │ Order  │  │ Rider  │  │Product │  │ Cart   │   ...          │    │
│  │  │ Service│  │ Service│  │ Service│  │ Service│  │ Service│               │    │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘               │    │
│  │                                    │                                             │    │
│  │  ┌─────────────────────────────────┼─────────────────────────────────────┐   │    │
│  │  │                           Data Layer                                 │   │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │    │
│  │  │  │  MongoDB    │  │   Redis    │  │  RabbitMQ  │  │  S3/CDN     │    │   │    │
│  │  │  │  Atlas      │  │   Cluster  │  │  Cluster   │  │             │    │   │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │    │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Mobile Applications                                          │
│                                                                                         │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐            │
│  │      Customer App               │    │        Rider App                │            │
│  │   (React Native/Expo)          │    │     (React Native/Expo)         │            │
│  │                                │    │                                 │            │
│  │  • Browse Products             │    │  • Authentication               │            │
│  │  • Add to Cart                │    │  • Online/Offline Toggle        │            │
│  │  • Place Order                │    │  • View Assigned Orders         │            │
│  │  • Track Order (Real-time)    │    │  • Accept/Reject Orders        │            │
│  │  • View History               │    │  • Update Delivery Status      │            │
│  └─────────────────────────────────┘    └─────────────────────────────────┘            │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Service Inventory

| Service | Type | Ports | Description |
|---------|------|-------|-------------|
| `auth-svc` | gRPC/REST | 3001 | Authentication, JWT, OTP |
| `order-svc` | gRPC/REST | 3002 | Order management, state machine |
| `rider-svc` | gRPC/REST | 3003 | Rider management, location |
| `product-svc` | gRPC/REST | 3004 | Products, categories, search |
| `cart-svc` | gRPC/REST | 3005 | Cart operations |
| `payment-svc` | gRPC/REST | 3006 | Payment processing |
| `notification-svc` | gRPC/REST | 3007 | Push, SMS, email |
| `analytics-svc` | gRPC/REST | 3008 | Metrics, reporting |
| `location-svc` | gRPC/REST | 3009 | Geospatial, routing, ETA |
| `tracking-gw` | WebSocket | 3010 | Real-time communication |

---

## 2. AWS Infrastructure Setup

### 2.1 AWS Account Structure

```
AWS Account: ShravanKirana
├── Region: ap-south-1 (Mumbai)
├── Availability Zones: ap-south-1a, ap-south-1b
└── Environment: Production
```

### 2.2 VPC Configuration

```
VPC: shravankirana-vpc (10.0.0.0/16)

Subnets:
  Public (Load Balancers):
    - ap-south-1a: 10.0.1.0/24
    - ap-south-1b: 10.0.2.0/24
  
  Private (Services):
    - ap-south-1a: 10.0.11.0/24
    - ap-south-1b: 10.0.12.0/24
  
  Data (Databases):
    - ap-south-1a: 10.0.21.0/24
    - ap-south-1b: 10.0.22.0/24
```

### 2.3 AWS Services Used

| Service | Purpose | Tier |
|---------|---------|------|
| **EKS** | Kubernetes cluster | Production |
| **RDS MongoDB Atlas** | Primary database | Production |
| **ElastiCache Redis** | Caching, sessions | Production |
| **RabbitMQ (MQ)** | Message broker | Production |
| **S3** | Static assets, media | Standard |
| **CloudFront** | CDN | Global |
| **Route 53** | DNS | Standard |
| **Application Load Balancer** | Load balancing | Production |
| **Secrets Manager** | Secrets management | Standard |
| **CloudWatch** | Logging, metrics | Standard |

---

## 3. Kubernetes & Service Mesh

### 3.1 EKS Cluster Configuration

```
EKS Cluster: shravankirana-cluster
  Version: 1.29
  Region: ap-south-1
  
Node Groups:
  system:
    Instance: t3.medium, Min: 1, Max: 3
  
  services:
    Instance: t3.large, Min: 2, Max: 10
  
  monitoring:
    Instance: t3.small, Min: 1, Max: 2
```

### 3.2 Istio Service Mesh

```
- Mutual TLS (STRICT mode)
- Automatic sidecar injection
- Distributed tracing with Jaeger
- Metrics with Prometheus
- Access logging
```

---

## 4. Microservices Architecture

### 4.1 Service Communication

```
EXTERNAL (REST)                    INTERNAL (gRPC)
─────────────────                  ─────────────────
Client ────► API Gateway ────► Kong ──────────► Services

Services ──► gRPC ────► Services

                  ┌──────────────────┐
                  │    RabbitMQ      │
                  │  (Async Events) │
                  └──────────────────┘
```

### 4.2 Service Responsibilities

#### Auth Service (auth-svc) - Port 3001
- OTP generation and verification
- JWT access/refresh token management
- User session management
- Role-based access control (customer, rider, admin)

#### Order Service (order-svc) - Port 3002
- Order CRUD operations
- State machine management
- Order timeline/audit log
- Integration with Rider Service for assignment

#### Rider Service (rider-svc) - Port 3003
- Rider registration and management
- Availability and online status
- Location tracking (real-time updates)
- Rider-performance metrics

#### Product Service (product-svc) - Port 3004
- Product CRUD
- Category and subcategory management
- Full-text search (MongoDB Atlas Search)
- Product caching (5 min TTL)

#### Cart Service (cart-svc) - Port 3005
- Cart CRUD operations
- Cart item management
- Cart caching (1 hour TTL)

#### Payment Service (payment-svc) - Port 3006
- Payment verification
- Payment status tracking

#### Notification Service (notification-svc) - Port 3007
- Push notifications (FCM)
- SMS (2Factor.in)
- Email (future)

#### Analytics Service (analytics-svc) - Port 3008
- Real-time metrics
- Daily/weekly reports
- Order fulfillment metrics

#### Location Service (location-svc) - Port 3009
- Geohash encoding/decoding
- Quadtree-based rider matching
- Route calculation
- ETA calculation
- Map provider abstraction (Google/MapMyIndia/OSRM)

#### Tracking Gateway (tracking-gw) - Port 3010
- WebSocket connection management
- Room-based subscriptions (order, user, rider)
- Real-time location broadcasting

---

## 5. Database Architecture

### 5.1 MongoDB Atlas Configuration

```
MongoDB Atlas Cluster: shravankirana-prod
├── Region: ap-south-1 (Mumbai)
├── Tier: M30 (3 shards, 8GB RAM each)
├── Storage: 500GB
├── Replication: 3 replicas
└── Backup: Daily snapshots
```

### 5.2 Database Schema

#### Users Collection
```javascript
{
  _id: ObjectId,
  phone: String,          // unique, indexed
  name: String,
  email: String,
  role: String,           // "customer" | "rider" | "admin"
  addresses: [{
    label: String,
    street: String,
    city: String,
    postalCode: String,
    coordinates: {
      type: "Point",
      coordinates: [Number, Number]  // [longitude, latitude]
    }
  }],
  isActive: Boolean,
  createdAt: Date
}
// Indexes: { phone: 1 }, { role: 1 }
```

#### Riders Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  currentLocation: {
    type: "Point",
    coordinates: [Number, Number]
  },
  lastLocationUpdate: Date,
  isAvailable: Boolean,
  isOnline: Boolean,
  stats: {
    totalDeliveries: Number,
    avgRating: Number,
    acceptanceRate: Number
  }
}
// Indexes: { currentLocation: "2dsphere" }, { isAvailable: 1, isOnline: 1 }
```

#### Products Collection
```javascript
{
  _id: ObjectId,
  name: String,
  nameHi: String,         // Hindi translation
  description: String,
  categoryId: ObjectId,
  price: Number,
  stock: Number,
  image: String,
  isAvailable: Boolean,
  barcode: String         // indexed
}
// Indexes: { barcode: 1 }, { categoryId: 1 }, { "searchVector": "AtlasSearch" }
```

#### Orders Collection
```javascript
{
  _id: ObjectId,
  orderId: String,       // "ORD-20260329-ABC12345"
  userId: ObjectId,
  riderId: ObjectId,
  items: [{ productId, name, quantity, price }],
  itemTotal: Number,
  deliveryFee: Number,
  totalAmount: Number,
  deliveryAddress: {
    coordinates: { type: "Point", coordinates: [Number, Number] }
  },
  orderStatus: String,   // PENDING | CONFIRMED | PACKED | ASSIGNED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED
  timeline: [{ status, timestamp, changedBy }],
  estimatedDeliveryTime: Date
}
// Indexes: { orderId: 1 }, { userId: 1 }, { riderId: 1 }, { orderStatus: 1 }, { "deliveryAddress.coordinates": "2dsphere" }
```

---

## 6. Message Queue (RabbitMQ)

### 6.1 Exchange & Queue Configuration

```
Exchanges:
  - order.events (topic)
  - rider.events (topic)
  - user.events (topic)
  - notification.events (fanout)

Queues:
  - order.created
  - order.status.changed
  - rider.location.updated
  - rider.matching
  - notification.push
  - notification.sms
  - analytics.orders
  - dead.letter.queue
```

### 6.2 Event Types

```typescript
interface OrderCreatedEvent {
  eventType: 'order.created';
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryAddress: DeliveryAddress;
  timestamp: Date;
}

interface OrderStatusChangedEvent {
  eventType: 'order.status.changed';
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: string;
  timestamp: Date;
}

interface RiderLocationUpdatedEvent {
  eventType: 'rider.location.updated';
  riderId: string;
  location: { latitude: number; longitude: number; heading?: number };
  timestamp: Date;
}

interface RiderMatchingRequestEvent {
  eventType: 'rider.matching.request';
  orderId: string;
  pickupLocation: { latitude: number; longitude: number };
  deliveryLocation: { latitude: number; longitude: number };
  requestedAt: Date;
}
```

---

## 7. API Gateway

### 7.1 Kong Configuration

```
Services:
  - auth-service: /api/v1/auth (POST, rate-limit: 10/min)
  - order-service: /api/v1/orders (GET, POST, PATCH, rate-limit: 100/min)
  - product-service: /api/v1/products (GET, POST, PUT, DELETE, rate-limit: 200/min)
  - rider-service: /api/v1/riders (GET, PATCH, rate-limit: 50/min)
  - cart-service: /api/v1/cart (all methods, rate-limit: 100/min)

Plugins:
  - rate-limiting (Redis-backed)
  - jwt authentication
  - cors
  - logging
```

---

## 8. Customer Mobile App

### 8.1 Screen Flow

```
AUTHENTICATION:
Splash → Login → OTP → Language Selection

MAIN TAB NAVIGATOR:
Home | Categories | Search | Cart | Account

PRODUCT FLOW:
Category List → Product Detail → Cart

ORDER FLOW:
Checkout → Payment → Order Confirmed → Tracking
```

### 8.2 Order Tracking Screen

```
┌─────────────────────────────────────────┐
│              MAP VIEW                    │
│                                          │
│  🏪 Store ─────── Route ─────── 🚴 Rider │
│                    │                    │
│                    └────── 🏠 Customer  │
│                                          │
├──────────────────────────────────────────┤
│  📦 Status: OUT_FOR_DELIVERY            │
│  🕐 ETA: 5 minutes                      │
│  📍 Distance: 500m                       │
│                                          │
│  Rider: Raj Kumar                        │
│  📞 98765 43210                          │
│  ⭐ 4.8 Rating                           │
│                                          │
│  [Call] [Message] [Cancel]              │
└─────────────────────────────────────────┘
```

### 8.3 Key Features

| Feature | Priority |
|---------|----------|
| Authentication (Phone + OTP) | P0 |
| Product Browsing | P0 |
| Cart Management | P0 |
| Order Placement | P0 |
| Order Tracking (Real-time map) | P0 |
| Order History | P1 |
| Push Notifications | P1 |
| Multi-language (EN/HI) | P1 |

---

## 9. Rider Mobile App

### 9.1 Screen Flow

```
AUTHENTICATION:
Splash → Login → OTP

HOME SCREEN:
┌─────────────────────────────────────────┐
│  ONLINE/OFFLINE TOGGLE 🔘               │
│                                          │
│  Today's Stats:                          │
│  [5 Deliveries] [₹450] [4.8★] [98%]    │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │ CURRENT ORDER                     │  │
│  │ Order #ORD-20260329-ABC          │  │
│  │ 🏠 123 Main St - 1.2 km          │  │
│  │ [View Details] [Navigate]        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 9.2 Order Status Update Flow

```
ADMIN ACTIONS (Admin Dashboard):
Confirmed → Packed → Assigned to Rider

RIDER APP:
Receives Push Notification
        ↓
Rider Views Order Details
        ↓
Rider Accepts OR Rejects
        ↓
If Accepted:
  Rider goes to Store
        ↓
  Rider Marks "PICKED UP" (customer gets live tracking)
        ↓
  Rider Navigates to Customer
        ↓
  Rider Marks "DELIVERED"
        ↓
  Customer gets confirmation
```

### 9.3 Rider App Screens

| Screen | Description |
|--------|-------------|
| Login/OTP | Phone + OTP authentication |
| Home | Online toggle, stats, current order |
| Available Orders | List of orders to accept |
| Order Details | Pickup/delivery info, navigation |
| Navigation | Turn-by-turn to destination |
| Complete Delivery | Mark picked up/delivered |
| Earnings | Daily/weekly earnings |
| Profile | Settings, vehicle details |

### 9.4 Location Tracking

```typescript
// Location tracking service
class RiderLocationService {
  async startTracking(riderId: string) {
    // Request permissions
    // Start watching location (every 3 seconds)
    // Send updates via WebSocket
    // Also send via gRPC for persistence
  }
  
  async startBackgroundTracking() {
    // Background location tracking
    // For when app is minimized
  }
}
```

---

## 10. Admin Dashboard

### 10.1 Order Management

```
ORDER ACTIONS:
- View all orders (filterable by status)
- Confirm order (PENDING → CONFIRMED)
- Pack order (CONFIRMED → PACKED)
- Assign rider (PACKED → ASSIGNED)
- Track order (real-time map)
- Cancel order (any status → CANCELLED)

RIDER ASSIGNMENT:
┌─────────────────────────────────────────┐
│  ASSIGN RIDER TO ORDER                   │
│                                          │
│  Order: ORD-20260329-ABC12345           │
│  Customer: John Doe                      │
│  Address: 123 Main St, Delhi            │
│                                          │
│  AVAILABLE RIDERS:                       │
│  ⭐ Raj Kumar | 4.8 | 12 deliveries    │
│  ⭐ Amit Singh | 4.6 | 8 deliveries     │
│  ⭐ Vikram Patel | 4.9 | 20 deliveries  │
│                                          │
│  [Cancel] [Assign Selected Rider]        │
└─────────────────────────────────────────┘
```

### 10.2 Rider Tracking Map

- Live location of all riders
- Color-coded by status (available, busy, offline)
- Click to see rider details
- Assign orders from map view

---

## 11. Real-time Communication

### 11.1 WebSocket Events

```typescript
// Customer App
'joinOrderRoom': { orderId }
'leaveOrderRoom': { orderId }

'server -> client':
'orderStatusUpdate': { orderId, status, timeline, estimatedDeliveryTime }
'riderLocationUpdate': { riderId, location: { latitude, longitude }, heading }
'etaUpdate': { orderId, estimatedDeliveryTime, durationMinutes }
'orderAssigned': { orderId, rider: { id, name, phone, rating } }

// Rider App
'server -> client':
'newOrderAssignment': { orderId, pickup, delivery, items }
'orderStatusUpdate': { orderId, status }
```

### 11.2 Room Structure

```
order_{orderId}  → Customer + Rider + Admin (watching)
user_{userId}    → Customer (personal notifications)
rider_{riderId}  → Rider (personal notifications)
admin            → All admins (broadcast)
```

---

## 12. Security Architecture

### 12.1 Authentication Flow

```
User enters phone → Send OTP Request → OTP via SMS
        ↓
User enters OTP → Verify OTP → Generate JWT
        ↓
Access Token (2 hours) + Refresh Token (10 days)
```

### 12.2 JWT Structure

```typescript
// Access Token
{
  sub: "user_id",
  phone: "9876543210",
  role: "customer" | "rider" | "admin",
  iat: timestamp,
  exp: timestamp + 2 hours
}

// Refresh Token
{
  sub: "user_id",
  type: "refresh",
  iat: timestamp,
  exp: timestamp + 10 days
}
```

### 12.3 Istio Security

```
- mTLS: STRICT mode (all service-to-service communication)
- Authorization policies per service
- JWT validation at ingress
```

---

## 13. Monitoring & Observability

### 13.1 Monitoring Stack

```
Metrics: Prometheus + Grafana
Logs: Fluent Bit + CloudWatch + ELK
Traces: Jaeger (Istio integration)
```

### 13.2 Key Metrics

| Metric | Type |
|--------|------|
| orders_total | Counter |
| orders_by_status | Gauge |
| order_delivery_duration_seconds | Histogram |
| rider_location_updates_total | Counter |
| api_request_duration_seconds | Histogram |
| active_connections | Gauge |
| cache_hit_ratio | Gauge |

---

## 14. CI/CD Pipeline

### 14.1 GitHub Actions Workflow

```
Push to main/develop
        ↓
┌───────────────────┐
│  Build & Test     │
│  - npm install     │
│  - lint           │
│  - typecheck      │
│  - unit tests     │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Build Images     │
│  - Docker build   │
│  - Push to ECR    │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Deploy to EKS    │
│  - kubectl apply │
│  - Helm upgrade   │
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Verify           │
│  - Health checks  │
│  - Smoke tests    │
└───────────────────┘
```

### 14.2 Environments

| Environment | Trigger | Description |
|-------------|---------|-------------|
| dev | Push to develop | Development testing |
| staging | PR to main | Pre-production |
| prod | Push to main | Production |

---

## 15. Implementation Roadmap

### Phase 1: Infrastructure (Weeks 1-4)
- AWS account setup, VPC, EKS cluster
- Istio service mesh installation
- MongoDB Atlas, Redis, RabbitMQ setup
- CI/CD pipeline, monitoring

### Phase 2: Core Services (Weeks 5-8)
- Auth Service (OTP, JWT)
- Product Service (CRUD, Search)
- Order Service (CRUD, State Machine)
- Cart Service, Payment Service

### Phase 3: Rider & Location (Weeks 9-12)
- Rider Service (management, availability)
- Location Service (Geohash, Quadtree, ETA)
- Rider Mobile App core (Auth, Orders)
- Rider Mobile App delivery (Navigation, Tracking)

### Phase 4: Customer App (Weeks 13-16)
- New Customer App architecture
- Authentication, Product browsing
- Cart, Checkout, Payment
- Order Tracking with real-time map

### Phase 5: Admin & Integration (Weeks 17-20)
- Admin Dashboard
- Order management
- Rider tracking map
- Push notifications

### Phase 6: Polish & Launch (Weeks 21-24)
- Integration testing
- Performance optimization
- Security testing
- Go-live

---

## 16. Cost Estimation

### Monthly AWS Costs

| Service | Configuration | Monthly Cost (INR) |
|---------|---------------|---------------------|
| EKS Cluster | 1 control plane | ₹6,500 |
| EKS Nodes | 6 x t3.large + 2 x t3.medium | ₹32,500 |
| MongoDB Atlas M30 | 3 shards, 8GB RAM | ₹45,000 |
| ElastiCache Redis | 3 x cache.r6g.large | ₹18,000 |
| RabbitMQ EC2 | 3 x t3.medium | ₹12,000 |
| S3 + CloudFront | 100GB + 500GB transfer | ₹3,900 |
| Data Transfer | 10TB | ₹7,000 |
| Route 53 + Secrets | - | ₹1,250 |
| CloudWatch | 10GB logs | ₹2,000 |
| **AWS Total** | | **₹128,150** (~ $1,540) |

### Third-party Services

| Service | Monthly Cost (INR) |
|---------|-------------------|
| OTP/SMS (2Factor.in) | ₹2,000 |
| Google Maps API | ₹15,000 |
| Domain (.com) | ₹800 |
| **Total** | **₹17,800** (~ $215) |

### Summary

| Category | Monthly (INR) | Monthly (USD) |
|----------|---------------|---------------|
| AWS | ₹128,150 | ~$1,540 |
| Third-party | ₹17,800 | ~$215 |
| **Total** | **₹145,950** | **~$1,755** |

**Budget:** $2,000/month  
**Margin:** ~$245/month

---

## Next Steps

To begin implementation, we need:

1. **AWS Access**
   - Programmatic keys (Access Key ID + Secret)
   - IAM permissions for EKS, EC2, S3, Route53

2. **Domain**
   - Domain name for API (e.g., shravankirana.com)
   - DNS delegation

3. **API Keys**
   - Google Maps API key
   - 2Factor.in API key
   - Firebase Cloud Messaging (free)

4. **MongoDB Atlas**
   - Cluster creation
   - Database user
   - Network whitelist (EKS security group)

5. **Team Alignment**
   - Confirm team members
   - Assign phase ownership
   - Communication channels

---

**Ready for your review and approval to begin Phase 1 implementation.**
