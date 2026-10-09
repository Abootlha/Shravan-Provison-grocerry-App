# ShravanKirana - Microservices Migration Plan

**Version:** 1.0  
**Date:** March 29, 2026  
**Scale Target:** 100-500 orders/day (initial)  
**Infrastructure:** Docker Compose + EC2 t3.micro (Free Tier)  
**Database:** MongoDB Atlas M10 (Mumbai - ap-south-1)  
**Maps:** MapMyIndia  

---

## Migration Strategy: Strangler Fig Pattern

We'll use the **Strangler Fig Pattern** to gradually migrate the monolith:
- New services run alongside old modules
- Traffic is shifted incrementally
- Old modules are removed as new services take over
- Zero downtime migration

```
PHASE 1                          PHASE 2                          PHASE 3
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│   EXISTING      │             │   EXISTING      │             │   NEW           │
│   MONOLITH      │             │   MONOLITH      │             │   MICROSERVICES │
│                 │             │                 │             │                 │
│  ┌───────────┐  │  Traffic   │  ┌───────────┐  │  Traffic   │  ┌───────────┐  │
│  │   Auth    │◄─┼─ shift ───►│  │   Auth    │◄─┼─ shift ───►│  │   Auth    │  │
│  └───────────┘  │             │  └───────────┘  │             │  └───────────┘  │
│  ┌───────────┐  │             │                 │             │                 │
│  │  Orders   │  │             │  ┌───────────┐  │             │  ┌───────────┐  │
│  └───────────┘  │             │  │  Orders   │  │             │  │  Orders   │  │
│  ┌───────────┐  │             │  └───────────┘  │             │  └───────────┘  │
│  │ Products  │  │             │                 │             │                 │
│  └───────────┘  │             │  ┌───────────┐  │             │  ┌───────────┐  │
│       ...       │             │  │ Products  │  │             │  │ Products  │  │
│                 │             │  └───────────┘  │             │  └───────────┘  │
└─────────────────┘             └─────────────────┘             └─────────────────┘
      Week 1-4                      Week 5-8                       Week 9-16
```

---

## Phase 1: Infrastructure Setup (Weeks 1-3)

### Week 1: AWS EC2 Setup

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 1.1 | Launch EC2 t3.micro instance (Ubuntu 22.04) in Mumbai | DevOps | 1 |
| 1.2 | Configure security groups (SSH, HTTP, HTTPS, MongoDB, Redis) | DevOps | 0.5 |
| 1.3 | Set up Elastic IP and domain DNS (Route 53) | DevOps | 1 |
| 1.4 | Install Docker and Docker Compose | DevOps | 1 |
| 1.5 | Configure Nginx reverse proxy | DevOps | 1 |
| 1.6 | Set up SSL certificate (Let's Encrypt) | DevOps | 0.5 |
| 1.7 | Configure firewall (ufw) | DevOps | 0.5 |
| 1.8 | Create Docker network | DevOps | 0.25 |
| 1.9 | Set up SSH key-based authentication | DevOps | 0.25 |
| 1.10 | Create deployment user | DevOps | 0.5 |
| 1.11 | Set up log rotation | DevOps | 0.25 |
| 1.12 | Configure automated backups for EC2 | DevOps | 0.5 |

**Week 1 Total: 8 hours**

---

### Week 2: MongoDB Atlas M10 Setup

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 2.1 | Create MongoDB Atlas account | DevOps | 0.5 |
| 2.2 | Deploy M10 cluster in Mumbai (ap-south-1) | DevOps | 1 |
| 2.3 | Configure network access (whitelist EC2 IP) | DevOps | 0.5 |
| 2.4 | Create database user with read/write permissions | DevOps | 0.25 |
| 2.5 | Create databases (users, orders, products, riders) | DevOps | 0.25 |
| 2.6 | Set up database indexes | DevOps | 1 |
| 2.7 | Configure Atlas Search (products collection) | DevOps | 1 |
| 2.8 | Set up Atlas Charts for monitoring | DevOps | 0.5 |
| 2.9 | Configure Atlas Backup (daily snapshots) | DevOps | 0.5 |
| 2.10 | Test connection from EC2 | DevOps | 0.5 |
| 2.11 | Document connection string | DevOps | 0.25 |
| 2.12 | Create MongoDB schema documentation | Backend | 1 |

**Week 2 Total: 8 hours**

---

### Week 3: Redis, RabbitMQ & Monitoring Setup

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 3.1 | Deploy Redis container via Docker Compose | DevOps | 0.5 |
| 3.2 | Configure Redis persistence (RDB + AOF) | DevOps | 0.5 |
| 3.3 | Deploy RabbitMQ container | DevOps | 0.5 |
| 3.4 | Configure RabbitMQ users and vhosts | DevOps | 0.5 |
| 3.5 | Set up RabbitMQ management UI | DevOps | 0.25 |
| 3.6 | Deploy Prometheus container | DevOps | 0.5 |
| 3.7 | Configure Prometheus scrape targets | DevOps | 1 |
| 3.8 | Deploy Grafana container | DevOps | 0.5 |
| 3.9 | Create Grafana dashboards (services, infrastructure) | DevOps | 1 |
| 3.10 | Set up container health checks | DevOps | 0.5 |
| 3.11 | Configure log aggregation (Fluent Bit) | DevOps | 0.75 |
| 3.12 | Create Docker Compose production file | DevOps | 1 |

**Week 3 Total: 8 hours**

---

### Week 4: CI/CD Pipeline

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 4.1 | Create GitHub repository structure (monorepo) | Backend | 1 |
| 4.2 | Set up GitHub Actions workflow | DevOps | 2 |
| 4.3 | Create Dockerfiles for each service | Backend | 3 |
| 4.4 | Configure Docker registry (ECR or Docker Hub) | DevOps | 0.5 |
| 4.5 | Set up staging environment | DevOps | 1 |
| 4.6 | Configure automatic deployment to staging | DevOps | 1 |
| 4.7 | Create Helm charts (optional for Docker Compose) | DevOps | 1 |
| 4.8 | Set up secrets management (.env files) | DevOps | 0.5 |
| 4.9 | Create deployment scripts | DevOps | 0.5 |
| 4.10 | Document deployment process | DevOps | 1 |
| 4.11 | Set up rollback procedure | DevOps | 0.5 |
| 4.12 | Create runbooks | DevOps | 1 |

**Week 4 Total: 14 hours**

---

## Phase 2: Core Services Development (Weeks 5-8)

### Week 5: Auth Service

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 5.1 | Create auth-svc project structure | Backend | 0.5 |
| 5.2 | Implement proto/gRPC definitions | Backend | 1 |
| 5.3 | Implement OTP generation (2Factor.in) | Backend | 1 |
| 5.4 | Implement OTP verification | Backend | 1 |
| 5.5 | Implement JWT access token generation | Backend | 1 |
| 5.6 | Implement JWT refresh token generation | Backend | 1 |
| 5.7 | Implement token validation | Backend | 1 |
| 5.8 | Implement logout (token invalidation) | Backend | 0.5 |
| 5.9 | Add Redis session management | Backend | 1 |
| 5.10 | Implement role-based access control | Backend | 1 |
| 5.11 | Create REST endpoints (for API Gateway) | Backend | 1 |
| 5.12 | Add health check endpoint | Backend | 0.25 |
| 5.13 | Write unit tests | Backend | 2 |
| 5.14 | Write integration tests | Backend | 2 |

**Week 5 Total: 14 hours**

---

### Week 6: User & Rider Services

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 6.1 | Create user-service project structure | Backend | 0.5 |
| 6.2 | Implement user CRUD operations | Backend | 2 |
| 6.3 | Implement user address management | Backend | 1.5 |
| 6.4 | Implement user profile updates | Backend | 1 |
| 6.5 | Create rider-service project structure | Backend | 0.5 |
| 6.6 | Implement rider registration | Backend | 1 |
| 6.7 | Implement rider availability toggle | Backend | 1 |
| 6.8 | Implement rider online/offline status | Backend | 1 |
| 6.9 | Implement rider location updates | Backend | 2 |
| 6.10 | Implement rider metrics (ratings, deliveries) | Backend | 1.5 |
| 6.11 | Implement find nearby riders (geospatial query) | Backend | 2 |
| 6.12 | Add MongoDB 2dsphere indexes | Backend | 0.5 |
| 6.13 | Write unit tests | Backend | 3 |
| 6.14 | Integration with Auth service | Backend | 1 |

**Week 6 Total: 18 hours**

---

### Week 7: Order Service (Core)

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 7.1 | Create order-service project structure | Backend | 0.5 |
| 7.2 | Implement order creation flow | Backend | 2 |
| 7.3 | Implement order state machine | Backend | 2 |
| 7.4 | Implement order status transitions | Backend | 2 |
| 7.5 | Implement order timeline/audit log | Backend | 1.5 |
| 7.6 | Implement rider assignment | Backend | 1.5 |
| 7.7 | Implement order cancellation | Backend | 1 |
| 7.8 | Implement order queries (by user, by rider, by status) | Backend | 1.5 |
| 7.9 | Add MongoDB indexes for performance | Backend | 0.5 |
| 7.10 | Implement Redis caching for order status | Backend | 1 |
| 7.11 | Publish events to RabbitMQ | Backend | 1 |
| 7.12 | Consume events from RabbitMQ | Backend | 1 |
| 7.13 | Write unit tests | Backend | 3 |
| 7.14 | Write integration tests | Backend | 2 |

**Week 7 Total: 20 hours**

---

### Week 8: Product & Cart Services

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 8.1 | Create product-service project structure | Backend | 0.5 |
| 8.2 | Implement product CRUD | Backend | 2 |
| 8.3 | Implement category management | Backend | 1.5 |
| 8.4 | Implement brand management | Backend | 1 |
| 8.5 | Implement product search (Atlas Search) | Backend | 2 |
| 8.6 | Implement barcode lookup | Backend | 0.5 |
| 8.7 | Add Redis caching for products | Backend | 1 |
| 8.8 | Create cart-service project structure | Backend | 0.5 |
| 8.9 | Implement cart CRUD | Backend | 1.5 |
| 8.10 | Implement add/remove/update cart items | Backend | 2 |
| 8.11 | Implement cart total calculation | Backend | 1 |
| 8.12 | Implement stock validation | Backend | 1 |
| 8.13 | Add Redis caching for carts | Backend | 1 |
| 8.14 | Write unit tests | Backend | 3 |
| 8.15 | Write integration tests | Backend | 2 |

**Week 8 Total: 20 hours**

---

## Phase 3: Rider & Location Services + Rider App (Weeks 9-12)

### Week 9: Location Service & MapMyIndia Integration

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 9.1 | Create location-service project structure | Backend | 0.5 |
| 9.2 | Implement geohash encoding/decoding | Backend | 1.5 |
| 9.3 | Implement quadtree-based rider index | Backend | 2 |
| 9.4 | Implement nearby rider queries | Backend | 2 |
| 9.5 | Integrate MapMyIndia Directions API | Backend | 2 |
| 9.6 | Integrate MapMyIndia Distance Matrix API | Backend | 2 |
| 9.7 | Implement ETA calculation | Backend | 1.5 |
| 9.8 | Implement route caching | Backend | 1 |
| 9.9 | Implement route polyline encoding | Backend | 1 |
| 9.10 | Add Redis caching for routes and ETA | Backend | 1 |
| 9.11 | Implement driver matching algorithm | Backend | 2 |
| 9.12 | Write unit tests | Backend | 3 |
| 9.13 | Integration tests | Backend | 2 |

**Week 9 Total: 22 hours**

---

### Week 10: Rider App - Authentication & Core

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 10.1 | Set up React Native/Expo project | Mobile | 1 |
| 10.2 | Configure navigation structure | Mobile | 1 |
| 10.3 | Implement phone login screen | Mobile | 2 |
| 10.4 | Implement OTP verification | Mobile | 2 |
| 10.5 | Implement JWT storage and refresh | Mobile | 1.5 |
| 10.6 | Create home screen with online toggle | Mobile | 2 |
| 10.7 | Implement order list view | Mobile | 2 |
| 10.8 | Implement order details screen | Mobile | 2 |
| 10.9 | Create earnings screen | Mobile | 1.5 |
| 10.10 | Implement profile screen | Mobile | 1.5 |
| 10.11 | Add Redux state management | Mobile | 1 |
| 10.12 | Integrate Socket.io client | Mobile | 1.5 |
| 10.13 | Write unit tests | Mobile | 2 |

**Week 10 Total: 21 hours**

---

### Week 11: Rider App - Order Flow & Notifications

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 11.1 | Implement push notification handling | Mobile | 2 |
| 11.2 | Implement new order assignment screen | Mobile | 2 |
| 11.3 | Implement order acceptance flow | Mobile | 1.5 |
| 11.4 | Implement order rejection flow | Mobile | 1 |
| 11.5 | Integrate MapMyIndia Maps SDK | Mobile | 2 |
| 11.6 | Implement navigation to pickup | Mobile | 2 |
| 11.7 | Implement pickup confirmation | Mobile | 1.5 |
| 11.8 | Implement navigation to delivery | Mobile | 2 |
| 11.9 | Implement delivery confirmation | Mobile | 1.5 |
| 11.10 | Add background location tracking | Mobile | 2 |
| 11.11 | Implement location sending to server | Mobile | 1.5 |
| 11.12 | Add order status update flow | Mobile | 1.5 |
| 11.13 | Write unit tests | Mobile | 2 |

**Week 11 Total: 22 hours**

---

### Week 12: Rider App - Polish & Testing

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 12.1 | Performance optimization | Mobile | 2 |
| 12.2 | Add loading states and skeletons | Mobile | 1.5 |
| 12.3 | Add error handling and retry logic | Mobile | 1.5 |
| 12.4 | Add offline mode indicators | Mobile | 1 |
| 12.5 | Battery optimization for location | Mobile | 1.5 |
| 12.6 | Add deep linking | Mobile | 1 |
| 12.7 | iOS build configuration | Mobile | 1 |
| 12.8 | Android build configuration | Mobile | 1 |
| 12.9 | TestFlight/Play Store preparation | Mobile | 2 |
| 12.10 | End-to-end testing | QA | 3 |
| 12.11 | Bug fixes | Mobile | 3 |
| 12.12 | Documentation | Mobile | 1 |

**Week 12 Total: 19 hours**

---

## Phase 4: Customer App Redesign (Weeks 11-14, parallel)

### Week 11: Customer App - Auth & Home

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 11.1 | Set up new React Native project | Mobile | 1 |
| 11.2 | Configure navigation | Mobile | 1 |
| 11.3 | Implement phone login | Mobile | 1.5 |
| 11.4 | Implement OTP verification | Mobile | 1.5 |
| 11.5 | Create home screen layout | Mobile | 2 |
| 11.6 | Implement category grid | Mobile | 1.5 |
| 11.7 | Implement product list | Mobile | 2 |
| 11.8 | Implement product detail screen | Mobile | 2 |
| 11.9 | Add Redux store | Mobile | 1 |
| 11.10 | Integrate API client | Mobile | 1 |
| 11.11 | Add multi-language support (EN/HI) | Mobile | 2 |

**Week 11 Total: 16.5 hours**

---

### Week 12: Customer App - Commerce

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 12.1 | Implement cart screen | Mobile | 2 |
| 12.2 | Implement quantity controls | Mobile | 1 |
| 12.3 | Implement address selection | Mobile | 2 |
| 12.4 | Implement add new address | Mobile | 1.5 |
| 12.5 | Implement checkout screen | Mobile | 2 |
| 12.6 | Implement payment selection (COD) | Mobile | 1 |
| 12.7 | Implement order confirmation | Mobile | 1.5 |
| 12.8 | Implement order history | Mobile | 1.5 |
| 12.9 | Implement order details | Mobile | 1.5 |
| 12.10 | Add Socket.io for updates | Mobile | 1.5 |
| 12.11 | Implement push notifications | Mobile | 1 |

**Week 12 Total: 16 hours**

---

### Week 13: Customer App - Order Tracking

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 13.1 | Create tracking screen layout | Mobile | 1 |
| 13.2 | Integrate MapMyIndia Maps | Mobile | 2 |
| 13.3 | Display rider marker (animated) | Mobile | 2 |
| 13.4 | Display route polyline | Mobile | 2 |
| 13.5 | Implement ETA display | Mobile | 1 |
| 13.6 | Implement status stepper | Mobile | 1.5 |
| 13.7 | Display rider info card | Mobile | 1 |
| 13.8 | Implement call/message rider | Mobile | 1 |
| 13.9 | Handle real-time location updates | Mobile | 2 |
| 13.10 | Handle order status updates | Mobile | 1.5 |
| 13.11 | Implement reconnection logic | Mobile | 1 |
| 13.12 | Add delivery instructions | Mobile | 0.5 |

**Week 13 Total: 16.5 hours**

---

### Week 14: Customer App - Polish & Launch

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 14.1 | Performance optimization | Mobile | 2 |
| 14.2 | Add loading states | Mobile | 1 |
| 14.3 | Add error handling | Mobile | 1.5 |
| 14.4 | Deep linking for order tracking | Mobile | 1 |
| 14.5 | Share tracking link | Mobile | 0.5 |
| 14.6 | iOS build setup | Mobile | 1 |
| 14.7 | Android build setup | Mobile | 1 |
| 14.8 | App store screenshots | Mobile | 1 |
| 14.9 | TestFlight/Play Store submission | Mobile | 2 |
| 14.10 | End-to-end testing | QA | 3 |
| 14.11 | Bug fixes | Mobile | 3 |
| 14.12 | Documentation | Mobile | 1 |

**Week 14 Total: 18 hours**

---

## Phase 5: Admin Dashboard & Integration (Weeks 15-16)

### Week 15: Admin Dashboard - Core

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 15.1 | Set up Astro project structure | Frontend | 1 |
| 15.2 | Create login page | Frontend | 1.5 |
| 15.3 | Implement admin authentication | Frontend | 1 |
| 15.4 | Create dashboard layout | Frontend | 1 |
| 15.5 | Implement KPI cards | Frontend | 1.5 |
| 15.6 | Implement order list table | Frontend | 2 |
| 15.7 | Implement order filters | Frontend | 1 |
| 15.8 | Implement order details modal | Frontend | 1.5 |
| 15.9 | Implement status change dropdown | Frontend | 1 |
| 15.10 | Implement rider assignment | Frontend | 2 |
| 15.11 | Integrate Socket.io for live updates | Frontend | 1.5 |
| 15.12 | Add order timeline view | Frontend | 1 |

**Week 15 Total: 16 hours**

---

### Week 16: Admin Dashboard - Rider Tracking & Launch

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 16.1 | Implement rider list | Frontend | 1.5 |
| 16.2 | Implement rider details | Frontend | 1 |
| 16.3 | Create live rider map | Frontend | 2 |
| 16.4 | Add rider markers to map | Frontend | 1.5 |
| 16.5 | Implement map controls (zoom, filter) | Frontend | 1 |
| 16.6 | Implement product management | Frontend | 2 |
| 16.7 | Implement category management | Frontend | 1.5 |
| 16.8 | Integrate Socket.io for rider locations | Frontend | 1.5 |
| 16.9 | Add notifications panel | Frontend | 1 |
| 16.10 | Performance optimization | Frontend | 1 |
| 16.11 | End-to-end testing | QA | 3 |
| 16.12 | Bug fixes and polish | Frontend | 2 |
| 16.13 | Production deployment | DevOps | 2 |

**Week 16 Total: 21 hours**

---

## Phase 6: Migration & Testing (Weeks 15-16, parallel with Phase 5)

### Week 15: Monolith Migration

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 15.1 | Deploy Auth service to production | DevOps | 1 |
| 15.2 | Configure Nginx to route auth requests to new service | DevOps | 0.5 |
| 15.3 | Test auth service in production | Backend | 1 |
| 15.4 | Deploy User service to production | DevOps | 1 |
| 15.5 | Configure Nginx to route user requests | DevOps | 0.5 |
| 15.6 | Deploy Rider service to production | DevOps | 1 |
| 15.7 | Configure Nginx to route rider requests | DevOps | 0.5 |
| 15.8 | Deploy Location service to production | DevOps | 1 |
| 15.9 | Configure Nginx to route location requests | DevOps | 0.5 |
| 15.10 | Test all services together | Backend | 2 |
| 15.11 | Load testing | QA | 2 |
| 15.12 | Bug fixes | Backend | 2 |

**Week 15 Total: 13.5 hours**

---

### Week 16: Final Migration & Launch

#### Tasks

| Task | Description | Owner | Hours |
|------|-------------|-------|-------|
| 16.1 | Deploy Order service to production | DevOps | 1 |
| 16.2 | Configure Nginx to route order requests | DevOps | 0.5 |
| 16.3 | Deploy Product service to production | DevOps | 1 |
| 16.4 | Configure Nginx to route product requests | DevOps | 0.5 |
| 16.5 | Deploy Cart service to production | DevOps | 1 |
| 16.6 | Configure Nginx to route cart requests | DevOps | 0.5 |
| 16.7 | Deploy Payment service to production | DevOps | 1 |
| 16.8 | Configure Nginx to route payment requests | DevOps | 0.5 |
| 16.9 | Deploy Notification service to production | DevOps | 1 |
| 16.10 | Deploy Tracking Gateway to production | DevOps | 1 |
| 16.11 | Full integration testing | QA | 3 |
| 16.12 | Performance testing | QA | 2 |
| 16.13 | Security audit | Backend | 1 |
| 16.14 | DNS cutover | DevOps | 0.5 |
| 16.15 | Monitoring and alerts verification | DevOps | 1 |
| 16.16 | Go-live checklist | All | 1 |

**Week 16 Total: 16 hours**

---

## Summary: All Tasks

### Phase 1: Infrastructure (Weeks 1-4)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 1 | 12 tasks | 8 hours |
| Week 2 | 12 tasks | 8 hours |
| Week 3 | 12 tasks | 8 hours |
| Week 4 | 12 tasks | 14 hours |
| **Phase 1 Total** | **48 tasks** | **38 hours** |

### Phase 2: Core Services (Weeks 5-8)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 5 | 14 tasks | 14 hours |
| Week 6 | 14 tasks | 18 hours |
| Week 7 | 14 tasks | 20 hours |
| Week 8 | 15 tasks | 20 hours |
| **Phase 2 Total** | **57 tasks** | **72 hours** |

### Phase 3: Rider & Location (Weeks 9-12)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 9 | 13 tasks | 22 hours |
| Week 10 | 13 tasks | 21 hours |
| Week 11 | 13 tasks | 22 hours |
| Week 12 | 12 tasks | 19 hours |
| **Phase 3 Total** | **51 tasks** | **84 hours** |

### Phase 4: Customer App (Weeks 11-14, parallel)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 11 | 11 tasks | 16.5 hours |
| Week 12 | 11 tasks | 16 hours |
| Week 13 | 12 tasks | 16.5 hours |
| Week 14 | 12 tasks | 18 hours |
| **Phase 4 Total** | **46 tasks** | **67 hours** |

### Phase 5: Admin & Integration (Weeks 15-16)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 15 | 12 tasks | 16 hours |
| Week 16 | 13 tasks | 21 hours |
| **Phase 5 Total** | **25 tasks** | **37 hours** |

### Phase 6: Migration (Weeks 15-16, parallel)

| Week | Tasks | Total Hours |
|------|-------|-------------|
| Week 15 | 12 tasks | 13.5 hours |
| Week 16 | 16 tasks | 16 hours |
| **Phase 6 Total** | **28 tasks** | **29.5 hours** |

---

## Grand Total

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Infrastructure | 48 | 38 |
| Phase 2: Core Services | 57 | 72 |
| Phase 3: Rider & Location | 51 | 84 |
| Phase 4: Customer App | 46 | 67 |
| Phase 5: Admin & Integration | 25 | 37 |
| Phase 6: Migration | 28 | 29.5 |
| **TOTAL** | **255 tasks** | **327.5 hours** |

---

## Resource Allocation

### Team: 1 Backend + 1 Mobile + 1 DevOps (part-time)

| Role | Week 1-4 | Week 5-8 | Week 9-12 | Week 11-14 | Week 15-16 |
|------|----------|----------|-----------|------------|-------------|
| **Backend** | 6h/week | 14h/week | 10h/week | 4h/week | 8h/week |
| **Mobile** | 1h/week | 1h/week | 14h/week | 14h/week | 4h/week |
| **DevOps** | 8h/week | 3h/week | 3h/week | 1h/week | 6h/week |
| **QA** | 1h/week | 2h/week | 2h/week | 4h/week | 6h/week |

---

## Critical Path

```
Week 1-4: Infrastructure must be ready before any service development

Week 5: Auth service is critical path (all other services depend on it)

Week 6: User & Rider services depend on Auth

Week 7: Order service depends on User, Rider

Week 8: Product & Cart services are independent but needed for full flow

Week 9: Location service depends on Rider service

Week 10-12: Rider App development (parallel with Location service)

Week 11-14: Customer App development (parallel with Rider app)

Week 15-16: Migration and integration
```

---

## Dependencies Matrix

| Service | Depends On |
|---------|-----------|
| auth-svc | None |
| user-svc | auth-svc |
| rider-svc | auth-svc, user-svc |
| order-svc | auth-svc, user-svc, rider-svc |
| product-svc | None (can start immediately) |
| cart-svc | auth-svc, user-svc, product-svc |
| payment-svc | auth-svc, order-svc |
| notification-svc | auth-svc |
| location-svc | rider-svc |
| analytics-svc | order-svc, rider-svc |
| tracking-gw | auth-svc, order-svc, rider-svc |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| EC2 t3.micro insufficient for all services | Medium | High | Start with essential services only, scale vertically first |
| MongoDB M10 performance issues | Low | Medium | Optimize queries, add indexes, consider upgrading to M20 |
| MapMyIndia API reliability | Low | Medium | Implement caching, fallback to OSRM |
| Integration issues during migration | High | Medium | Comprehensive testing, rollback plan |
| Single point of failure (EC2) | High | High | Set up monitoring, create AMI backup |
| OTP service downtime | Low | Medium | Implement OTP retry logic, fallback to email |

---

## Definition of Done

### For Each Service:
- [ ] Service runs in Docker container
- [ ] Health check endpoint responds
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] Deployed to staging environment
- [ ] Load tested (ab - 100 concurrent requests)
- [ ] Monitored in Grafana
- [ ] Logs aggregated to CloudWatch
- [ ] API documentation created
- [ ] Deployed to production
- [ ] Verified working in production

### For Each App:
- [ ] Builds successfully on iOS
- [ ] Builds successfully on Android
- [ ] All screens render correctly
- [ ] All user flows work end-to-end
- [ ] Push notifications work
- [ ] Performance acceptable (<2s load time)
- [ ] Crash-free rate >99%
- [ ] Submitted to App Store / Play Store

---

## Next Steps

1. **AWS EC2 Setup** - Launch instance, configure security groups
2. **Docker & Docker Compose** - Install and configure
3. **MongoDB Atlas** - Create account, deploy M10 cluster
4. **GitHub Repository** - Set up monorepo structure
5. **Auth Service** - First service to build

---

**Ready to begin Phase 1: Infrastructure Setup?**

The first concrete task is to launch the EC2 instance. Would you like me to create detailed step-by-step instructions for this, or do you have the EC2 instance already running?
