# ShravanKirana Microservices Infrastructure

Production-ready infrastructure configuration for the ShravanKirana microservices architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Clients                                      │
│                    (Mobile App, Web Admin)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Nginx (Reverse Proxy)                          │
│                    Port 80 (HTTP) | Port 443 (HTTPS)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   Auth Svc    │           │   Order Svc   │           │  Product Svc  │
│    Port 8001  │           │    Port 8004  │           │    Port 8005  │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   User Svc    │           │   Rider Svc   │           │   Cart Svc    │
│    Port 8002  │           │    Port 8003  │           │    Port 8006  │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ Payment Svc   │           │Notification   │           │ Location Svc  │
│    Port 8007  │           │    Port 8008  │           │    Port 8009  │
└───────────────┘           └───────────────┘           └───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Tracking Gateway (WebSocket)                          │
│                           Port 8010                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         Analytics Svc                                    │
│                          Port 8011                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   RabbitMQ    │           │     Redis     │           │    MongoDB    │
│  5672, 15672  │           │     6379      │           │    27017      │
└───────────────┘           └───────────────┘           └───────────────┘
                                    │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Monitoring Stack                                 │
│                   Prometheus (9090) | Grafana (3001)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| auth-svc | 8001 | Authentication & authorization |
| user-svc | 8002 | User management |
| rider-svc | 8003 | Rider management & assignments |
| order-svc | 8004 | Order processing & management |
| product-svc | 8005 | Product catalog |
| cart-svc | 8006 | Shopping cart |
| payment-svc | 8007 | Payment processing (Razorpay) |
| notification-svc | 8008 | SMS, Email, Push notifications |
| location-svc | 8009 | Location services (MapMyIndia) |
| tracking-gw | 8010 | Real-time tracking (WebSocket) |
| analytics-svc | 8011 | Analytics & reporting |

## Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy & load balancer |
| rabbitmq | 5672, 15672 | Message broker |
| redis | 6379 | Cache & session store |
| mongodb | 27017 | Database (local dev only) |
| prometheus | 9090 | Metrics collection |
| grafana | 3001 | Dashboards & visualization |

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- Make (for convenience commands)

## Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp infrastructure/docker/.env.example infrastructure/docker/.env

# Edit .env and configure your values
nano infrastructure/docker/.env
```

### 2. Start Services

```bash
# Start all services
make up

# Or start with local MongoDB (for development)
make up-local
```

### 3. Verify Services

```bash
# Check service health
make health

# View logs
make logs
```

### 4. Access Services

| Service | URL |
|---------|-----|
| API Gateway | http://localhost |
| RabbitMQ Management | http://localhost:15672 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

## Makefile Commands

### Main Commands

```bash
make up              # Start all services
make down            # Stop all services
make build           # Build all service images
make restart         # Restart all services
make logs            # View logs (all services)
make ps              # List running containers
make clean           # Stop and remove containers, volumes
```

### Service-Specific Commands

```bash
# Start/Stop/Restart individual services
make up-auth         make down-auth         make restart-auth
make up-order        make down-order        make restart-order
make up-product      make down-product      make restart-product
make up-rider        make down-rider        make restart-rider
make logs-auth       make logs-order       make logs-product

# View specific logs
make logs-nginx      # Nginx reverse proxy
make logs-rabbitmq  # Message broker
make logs-redis     # Cache
make logs-grafana   # Dashboards
```

### Database Commands

```bash
make mongo-connect   # Connect to MongoDB shell
make redis-connect   # Connect to Redis CLI
```

### Health & Maintenance

```bash
make health          # Check health of all services
make prune           # Remove unused Docker resources
make reload-nginx    # Reload nginx configuration
make test-nginx-config
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | `your-super-secret-key` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `REDIS_PASSWORD` | Redis password | `redis123` |
| `RABBITMQ_USER` | RabbitMQ username | `admin` |
| `RABBITMQ_PASSWORD` | RabbitMQ password | `admin123` |

### API Keys

| Variable | Service | Where to Get |
|----------|---------|--------------|
| `MAPMYINDIA_API_KEY` | MapMyIndia | https://www.mapmyindia.com |
| `MAPMYINDIA_CLIENT_ID` | MapMyIndia | https://www.mapmyindia.com |
| `MAPMYINDIA_CLIENT_SECRET` | MapMyIndia | https://www.mapmyindia.com |
| `RAZORPAY_KEY_ID` | Razorpay | https://dashboard.razorpay.com |
| `RAZORPAY_KEY_SECRET` | Razorpay | https://dashboard.razorpay.com |
| `TWILIO_ACCOUNT_SID` | Twilio | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Twilio | https://console.twilio.com |
| `TWO_FACTOR_API_KEY` | 2Factor.in | https://2factor.in |
| `FCM_SERVER_KEY` | Firebase | https://console.firebase.google.com |

## Docker Compose Profiles

```bash
# Start with local MongoDB (for development)
docker compose --profile local-dev up -d

# Start infrastructure services only
docker compose up -d rabbitmq redis
```

## Nginx Configuration

The Nginx reverse proxy handles:
- **Rate limiting**: 100 req/s for API, 10 req/s for auth, 5 req/s for payments
- **CORS**: Configured for mobile app and web admin origins
- **WebSocket**: Enabled for tracking gateway (`/ws/tracking`, `/socket.io/`)
- **SSL**: Placeholder configured (uncomment for production)

### Adding SSL Certificates

1. Place certificates in `infrastructure/nginx/ssl/`
2. Uncomment the HTTPS server block in `nginx.conf`
3. Update `ssl_certificate` and `ssl_certificate_key` paths

## Monitoring

### Prometheus

- Metrics endpoint: http://localhost:9090
- Auto-discovers services via Docker labels

### Grafana

- URL: http://localhost:3001
- Default credentials: `admin` / `admin123`
- Pre-configured dashboards for:
  - Service health
  - Request rates
  - Error rates
  - Response times

## Production Checklist

- [ ] Change all default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up MongoDB Atlas (disable local MongoDB)
- [ ] Configure proper CORS origins
- [ ] Set up log aggregation
- [ ] Configure backup strategy
- [ ] Set up alerting
- [ ] Review rate limits
- [ ] Enable authentication on all services
- [ ] Configure firewall rules

## Troubleshooting

### Services not starting

```bash
# Check Docker logs
docker compose logs <service-name>

# Restart infrastructure first
docker compose restart rabbitmq redis
```

### Database connection issues

```bash
# Verify MongoDB is running
docker compose ps mongodb

# Check MongoDB logs
docker compose logs mongodb

# Connect to MongoDB
make mongo-connect
```

### Network issues

```bash
# Check network connectivity
docker network inspect shravankirana_shravankirana-network

# Recreate network
docker network rm shravankirana_shravankirana-network
docker compose up -d
```

## License

MIT
