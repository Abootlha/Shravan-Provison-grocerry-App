# ShravanKirana

Grocery ordering and delivery platform: a customer app, a rider app, an admin dashboard,
and one NestJS backend that all three talk to.

## Components

| Path              | What it is                                                     | Stack                                                    |
|-------------------|----------------------------------------------------------------|----------------------------------------------------------|
| `backend/`        | The only API server. REST under `/api/v1`, Socket.io namespaces `/tracking` and `/orders` | NestJS 11, MongoDB (Mongoose), Redis (cache, BullMQ, socket.io adapter), JWT, PayU |
| `customer-app/`   | Customer mobile app (Android/iOS/web)                          | Expo / React Native, Redux Toolkit                       |
| `apps/rider-app/` | Delivery rider app                                             | Expo / React Native, TypeScript                          |
| `admin/`          | Admin dashboard (products, orders, riders, inventory)          | Astro (static) + React, Tailwind                         |
| `tools/scraper/`  | Ad-hoc product data scraper (dev tool, not deployed)           | Node, Playwright, Cheerio                                |
| `infrastructure/` | Production Docker Compose + nginx for the backend              | Docker, nginx                                            |
| `services/`, `shared/` | **Archived** microservices prototype. Not deployed, not maintained. See `services/README.md` | |

More docs: `App_Flow_And_Architecture.md`, `docs/`. Older status notes are in `docs/archive/` and may be out of date.

## Local setup

Prerequisites: Node.js 20, npm, Docker (for MongoDB/Redis).

### 1. Backend + MongoDB + Redis

```bash
cp .env.example .env                  # MongoDB/Redis credentials for docker compose
cp backend/.env.example backend/.env  # backend settings (maps, OTP, PayU, JWT...)
docker compose up -d --build          # backend on :3000, MongoDB/Redis on 127.0.0.1 only
```

To run the backend on the host with hot reload instead, start only the databases
(`docker compose up -d mongodb redis`), point `backend/.env` at them
(`MONGODB_URI=mongodb://<user>:<pass>@localhost:27017/shravankirana?authSource=admin`,
`REDIS_HOST=localhost`, `REDIS_PASSWORD=...`), then:

```bash
cd backend && npm ci && npm run start:dev
```

### 2. Admin dashboard

```bash
cd admin
cp .env.example .env
npm ci
npm run dev        # http://localhost:4321, talks to http://localhost:3000/api/v1
```

`npm run build` requires `PUBLIC_API_URL` and `PUBLIC_TRACKING_URL` and fails without them.

### 3. Mobile apps

```bash
cd customer-app   # or apps/rider-app
cp .env.example .env
npm ci
npm start         # Expo
```

On a physical device, set `API_BASE_URL` / `TRACKING_URL` to your machine's LAN IP.

## Environment variables

Each package documents its own variables. Never commit a real `.env`.

| File                              | Used by                                        |
|-----------------------------------|------------------------------------------------|
| `.env.example`                    | root `docker-compose.yml` (DB/Redis passwords) |
| `backend/.env.example`            | backend                                        |
| `admin/.env.example`              | admin (`PUBLIC_*`, baked into the static build) |
| `customer-app/.env.example`       | customer app                                   |
| `apps/rider-app/.env.example`     | rider app                                      |
| `infrastructure/docker/.env.example` | production compose stack                    |

Anything in the admin or mobile app env files ends up in the shipped bundle, so it must not hold secrets.

## Testing

```bash
cd backend && npm test        # Jest
cd admin && npm test          # Vitest (npm run test:watch for watch mode)
cd apps/rider-app && npx tsc --noEmit
```

## CI

`.github/workflows/ci-cd.yml` runs on pushes and PRs to `main`/`develop`:

- **backend**: `npm ci`, ESLint, `tsc --noEmit`, Jest, `nest build`
- **admin**: `npm ci`, Vitest, `astro build`
- **rider-app**: `npm ci`, `tsc --noEmit`
- **customer-app**: `npm ci`, `expo config` check

On pushes to `main`, the backend Docker image is built and pushed to
`ghcr.io/<owner>/<repo>/backend`. No deploy step is configured yet.

## Deployment

See `infrastructure/README.md` for the production stack (nginx with TLS, then backend, MongoDB and Redis).
