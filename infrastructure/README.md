# Infrastructure

Production-oriented Docker setup for the ShravanKirana NestJS backend (`backend/`).
The old microservices layout (`services/`, RabbitMQ, Prometheus/Grafana) is archived and
not deployed; see `services/README.md`.

```
clients (customer app, rider app, admin) ──HTTPS──> nginx :443 ──> backend :3000 ──> MongoDB
                                                    (:80 → 301)              └────> Redis (cache, BullMQ, socket.io adapter)
```

| Service  | Image                | Published ports | Notes                                        |
|----------|----------------------|-----------------|----------------------------------------------|
| nginx    | nginx:1.27-alpine    | 80, 443         | TLS termination, rate limits, websockets     |
| backend  | built from `backend/`| none (internal) | `node dist/main`, non-root                   |
| mongodb  | mongo:7              | none (internal) | root auth required                           |
| redis    | redis:7-alpine       | none (internal) | `requirepass` required, AOF persistence      |

## Files

- `docker/docker-compose.yml`: the stack. Every secret is a required env var (`${VAR:?}`), so nothing starts with default passwords.
- `docker/.env.example`: copy to `docker/.env` and fill in.
- `nginx/nginx.conf`: proxies `/api/` and `/socket.io/` (websocket upgrade) to `backend:3000`. Every other path returns 404, including `/metrics`. Port 80 serves `/health` and ACME challenges and redirects everything else to HTTPS. CORS is left to the backend (`CORS_ORIGINS`); nginx adds no CORS headers.

## Deploy

```bash
cd infrastructure/docker
cp .env.example .env            # fill in every value
mkdir -p ../nginx/ssl           # put fullchain.pem + privkey.pem here (gitignored)
docker compose config -q        # validates that every required var is set
docker compose up -d --build
```

To run the CI-built image instead of building on the host, set
`BACKEND_IMAGE=ghcr.io/<owner>/<repo>/backend:<sha>` in `.env` and run
`docker compose pull backend && docker compose up -d --no-build`.

To use MongoDB Atlas, set `MONGODB_URI` to the Atlas URI and remove the `mongodb`
service and its `depends_on` entry.

## Local development

Use the root `docker-compose.yml` instead (backend + MongoDB + Redis, with MongoDB/Redis bound to 127.0.0.1). See the root `README.md`.

## Known gaps

- The backend has no health endpoint yet, so the backend container has no `HEALTHCHECK`. nginx's `/health` only shows that nginx is up.
- The backend must read `REDIS_PASSWORD` for its Redis connections (BullMQ, cache, socket.io adapter). Until it does, it cannot connect to the password-protected Redis.
