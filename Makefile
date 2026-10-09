.PHONY: help up down build logs ps clean prod-up prod-down prod-logs prod-ps prod-config backend-dev backend-test admin-dev admin-test mongo-connect redis-connect

# Local dev stack (root docker-compose.yml): backend + MongoDB + Redis
COMPOSE = docker compose
# Production-style stack: nginx + backend + MongoDB + Redis
PROD_COMPOSE = docker compose -f infrastructure/docker/docker-compose.yml --env-file infrastructure/docker/.env

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Setup: cp .env.example .env  (local)  |  cp infrastructure/docker/.env.example infrastructure/docker/.env  (prod)"

# ---- Local development -----------------------------------------------------

up: ## Start backend + MongoDB + Redis (local)
	$(COMPOSE) up -d --build

down: ## Stop the local stack
	$(COMPOSE) down

build: ## Build the backend image
	$(COMPOSE) build backend

logs: ## Follow local stack logs
	$(COMPOSE) logs -f

ps: ## List local stack containers
	$(COMPOSE) ps

clean: ## Stop the local stack and delete its volumes (wipes local DB)
	$(COMPOSE) down -v --remove-orphans

backend-dev: ## Run the backend with hot reload on the host (needs MongoDB/Redis)
	cd backend && npm run start:dev

backend-test: ## Run backend unit tests
	cd backend && npm test -- --ci

admin-dev: ## Run the admin dashboard dev server
	cd admin && npm run dev

admin-test: ## Run admin tests
	cd admin && npm test

mongo-connect: ## Open mongosh in the local MongoDB container
	$(COMPOSE) exec mongodb sh -c 'mongosh -u "$$MONGO_INITDB_ROOT_USERNAME" -p "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin shravankirana'

redis-connect: ## Open redis-cli in the local Redis container
	$(COMPOSE) exec redis sh -c 'REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli'

# ---- Production-style stack ------------------------------------------------

prod-config: ## Validate the production compose file and env
	$(PROD_COMPOSE) config -q

prod-up: ## Start nginx + backend + MongoDB + Redis
	$(PROD_COMPOSE) up -d --build

prod-down: ## Stop the production stack
	$(PROD_COMPOSE) down

prod-logs: ## Follow production stack logs
	$(PROD_COMPOSE) logs -f

prod-ps: ## List production stack containers
	$(PROD_COMPOSE) ps
