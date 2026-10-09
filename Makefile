.PHONY: help up down build build-no-cache start stop restart logs logs-follow clean ps prune inspect restart-service

# =============================================================================
# Variables
# =============================================================================
COMPOSE_FILE = -f infrastructure/docker/docker-compose.yml
COMPOSE_PROFILES = 
EXPORT_DIR = $(shell pwd)/infrastructure/docker
ENV_FILE = $(EXPORT_DIR)/.env

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

# =============================================================================
# Default target
# =============================================================================
help: ## Show this help message
	@echo ""
	@echo "$(BLUE)ShravanKirana Microservices - Make Commands$(NC)"
	@echo ""
	@echo "Usage: $(GREEN)make <target>$(NC)"
	@echo ""
	@echo "Main targets:"
	@echo "  $(GREEN)up$(NC)               - Start all services"
	@echo "  $(GREEN)down$(NC)             - Stop all services"
	@echo "  $(GREEN)build$(NC)            - Build all service images"
	@echo "  $(GREEN)logs$(NC)             - View logs (all services)"
	@echo "  $(GREEN)restart$(NC)          - Restart all services"
	@echo ""
	@echo "Service-specific targets:"
	@echo "  $(GREEN)up-auth$(NC)          - Start auth-svc only"
	@echo "  $(GREEN)up-order$(NC)         - Start order-svc only"
	@echo "  $(GREEN)logs-auth$(NC)        - View auth-svc logs"
	@echo "  $(GREEN)logs-order$(NC)       - View order-svc logs"
	@echo "  $(GREEN)restart-auth$(NC)    - Restart auth-svc"
	@echo "  $(GREEN)restart-order$(NC)   - Restart order-svc"
	@echo ""
	@echo "Utility targets:"
	@echo "  $(GREEN)ps$(NC)               - List running containers"
	@echo "  $(GREEN)clean$(NC)            - Stop and remove containers, volumes"
	@echo "  $(GREEN)prune$(NC)            - Remove all unused Docker resources"
	@echo "  $(GREEN)inspect<svc>$(NC)     - Inspect a service container"
	@echo ""
	@echo "Environment:"
	@echo "  $(YELLOW)Setup: cp infrastructure/docker/.env.example infrastructure/docker/.env$(NC)"
	@echo ""

# =============================================================================
# Main Commands
# =============================================================================

up: ## Start all services
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d
	@echo "$(GREEN)All services started. Access nginx at http://localhost$(NC)"
	@echo "$(GREEN)RabbitMQ Management: http://localhost:15672$(NC)"
	@echo "$(GREEN)Grafana: http://localhost:3001$(NC)"
	@echo "$(GREEN)Prometheus: http://localhost:9090$(NC)"

up-local: ## Start services with local MongoDB (includes mongodb profile)
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) --profile local-dev up -d
	@echo "$(GREEN)All services started with local MongoDB$(NC)"

down: ## Stop all services
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) down

build: ## Build all service images
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) build --parallel

build-no-cache: ## Build all service images without cache
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) build --no-cache --parallel

start: up

stop: down

restart: ## Restart all services
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart

clean: ## Stop and remove containers, volumes, and networks
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) down -v --remove-orphans
	@echo "$(RED)Cleaned up containers, volumes, and networks$(NC)"

prune: ## Remove all unused Docker resources
	@docker system prune -f
	@echo "$(GREEN)Docker system pruned$(NC)"

ps: ## List running containers
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) ps

# =============================================================================
# Log Commands
# =============================================================================

logs: ## View logs for all services (use Ctrl+C to exit)
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f

logs-follow: logs

logs-auth: ## View auth-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f auth-svc

logs-user: ## View user-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f user-svc

logs-rider: ## View rider-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f rider-svc

logs-order: ## View order-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f order-svc

logs-product: ## View product-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f product-svc

logs-cart: ## View cart-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f cart-svc

logs-payment: ## View payment-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f payment-svc

logs-notification: ## View notification-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f notification-svc

logs-location: ## View location-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f location-svc

logs-tracking: ## View tracking-gw logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f tracking-gw

logs-analytics: ## View analytics-svc logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f analytics-svc

logs-nginx: ## View nginx logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f nginx

logs-rabbitmq: ## View RabbitMQ logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f rabbitmq

logs-redis: ## View Redis logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f redis

logs-mongo: ## View MongoDB logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f mongodb

logs-prometheus: ## View Prometheus logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f prometheus

logs-grafana: ## View Grafana logs
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) logs -f grafana

# =============================================================================
# Service-specific Start Commands
# =============================================================================

up-auth: ## Start auth-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d auth-svc

up-user: ## Start user-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d user-svc

up-rider: ## Start rider-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d rider-svc

up-order: ## Start order-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d order-svc

up-product: ## Start product-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d product-svc

up-cart: ## Start cart-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d cart-svc

up-payment: ## Start payment-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d payment-svc

up-notification: ## Start notification-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d notification-svc

up-location: ## Start location-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d location-svc

up-tracking: ## Start tracking-gw only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d tracking-gw

up-analytics: ## Start analytics-svc only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d analytics-svc

up-nginx: ## Start nginx only
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d nginx

up-monitoring: ## Start Prometheus and Grafana
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d prometheus grafana

up-infra: ## Start infrastructure services (RabbitMQ, Redis, MongoDB)
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) up -d rabbitmq redis

# =============================================================================
# Service-specific Stop Commands
# =============================================================================

down-auth: ## Stop auth-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop auth-svc

down-user: ## Stop user-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop user-svc

down-rider: ## Stop rider-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop rider-svc

down-order: ## Stop order-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop order-svc

down-product: ## Stop product-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop product-svc

down-cart: ## Stop cart-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop cart-svc

down-payment: ## Stop payment-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop payment-svc

down-notification: ## Stop notification-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop notification-svc

down-location: ## Stop location-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop location-svc

down-tracking: ## Stop tracking-gw
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop tracking-gw

down-analytics: ## Stop analytics-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) stop analytics-svc

# =============================================================================
# Service-specific Restart Commands
# =============================================================================

restart-auth: ## Restart auth-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart auth-svc

restart-user: ## Restart user-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart user-svc

restart-rider: ## Restart rider-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart rider-svc

restart-order: ## Restart order-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart order-svc

restart-product: ## Restart product-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart product-svc

restart-cart: ## Restart cart-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart cart-svc

restart-payment: ## Restart payment-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart payment-svc

restart-notification: ## Restart notification-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart notification-svc

restart-location: ## Restart location-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart location-svc

restart-tracking: ## Restart tracking-gw
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart tracking-gw

restart-analytics: ## Restart analytics-svc
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart analytics-svc

restart-nginx: ## Restart nginx
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart nginx

restart-rabbitmq: ## Restart RabbitMQ
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart rabbitmq

restart-redis: ## Restart Redis
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart redis

restart-mongo: ## Restart MongoDB
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart mongodb

restart-monitoring: ## Restart Prometheus and Grafana
	@cd $(EXPORT_DIR) && docker compose $(COMPOSE_FILE) restart prometheus grafana

# =============================================================================
# Inspect Commands
# =============================================================================

inspect-auth: ## Inspect auth-svc container
	@docker inspect shravankirana-auth-svc

inspect-user: ## Inspect user-svc container
	@docker inspect shravankirana-user-svc

inspect-rider: ## Inspect rider-svc container
	@docker inspect shravankirana-rider-svc

inspect-order: ## Inspect order-svc container
	@docker inspect shravankirana-order-svc

inspect-product: ## Inspect product-svc container
	@docker inspect shravankirana-product-svc

inspect-cart: ## Inspect cart-svc container
	@docker inspect shravankirana-cart-svc

inspect-payment: ## Inspect payment-svc container
	@docker inspect shravankirana-payment-svc

inspect-notification: ## Inspect notification-svc container
	@docker inspect shravankirana-notification-svc

inspect-location: ## Inspect location-svc container
	@docker inspect shravankirana-location-svc

inspect-tracking: ## Inspect tracking-gw container
	@docker inspect shravankirana-tracking-gw

inspect-analytics: ## Inspect analytics-svc container
	@docker inspect shravankirana-analytics-svc

inspect-nginx: ## Inspect nginx container
	@docker inspect shravankirana-nginx

inspect-rabbitmq: ## Inspect RabbitMQ container
	@docker inspect shravankirana-rabbitmq

inspect-redis: ## Inspect Redis container
	@docker inspect shravankirana-redis

# =============================================================================
# Health Check Commands
# =============================================================================

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@echo "Auth Svc:       $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/health 2>/dev/null || echo "DOWN")"
	@echo "User Svc:       $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8002/health 2>/dev/null || echo "DOWN")"
	@echo "Rider Svc:      $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8003/health 2>/dev/null || echo "DOWN")"
	@echo "Order Svc:      $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8004/health 2>/dev/null || echo "DOWN")"
	@echo "Product Svc:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8005/health 2>/dev/null || echo "DOWN")"
	@echo "Cart Svc:       $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8006/health 2>/dev/null || echo "DOWN")"
	@echo "Payment Svc:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8007/health 2>/dev/null || echo "DOWN")"
	@echo "Notification:   $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8008/health 2>/dev/null || echo "DOWN")"
	@echo "Location Svc:   $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8009/health 2>/dev/null || echo "DOWN")"
	@echo "Tracking Gw:    $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8010/health 2>/dev/null || echo "DOWN")"
	@echo "Analytics Svc:  $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8011/health 2>/dev/null || echo "DOWN")"
	@echo "Nginx:          $$(curl -s -o /dev/null -w '%{http_code}' http://localhost/health 2>/dev/null || echo "DOWN")"
	@echo "RabbitMQ:       $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:15672 2>/dev/null || echo "DOWN")"
	@echo "Grafana:        $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null || echo "DOWN")"
	@echo "Prometheus:     $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:9090/-/healthy 2>/dev/null || echo "DOWN")"

# =============================================================================
# Development Commands
# =============================================================================

dev-auth: ## Start auth-svc in development mode with hot reload
	@cd ../services/auth-svc && npm run dev

dev-order: ## Start order-svc in development mode with hot reload
	@cd ../services/order-svc && npm run dev

# =============================================================================
# Database Commands
# =============================================================================

mongo-connect: ## Connect to MongoDB container
	@docker exec -it shravankirana-mongodb mongosh -u admin -p admin123

redis-connect: ## Connect to Redis container
	@docker exec -it shravankirana-redis redis-cli -a redis123

rabbitmq-connect: ## Connect to RabbitMQ container
	@docker exec -it shravankirana-rabbitmq rabbitmqctl status

# =============================================================================
# Maintenance Commands
# =============================================================================

reload-nginx: ## Reload nginx configuration without restarting
	@docker exec shravankirana-nginx nginx -s reload

test-nginx-config: ## Test nginx configuration
	@docker exec shravankirana-nginx nginx -t

# =============================================================================
# Cleanup Commands
# =============================================================================

remove-stopped: ## Remove stopped containers
	@docker container prune -f

remove-images: ## Remove unused images
	@docker image prune -a -f

remove-volumes: ## Remove unused volumes
	@docker volume prune -f

full-clean: ## Full cleanup - containers, volumes, images, networks
	@docker compose $(COMPOSE_FILE) down -v --remove-orphans
	@docker container prune -f
	@docker image prune -a -f
	@docker volume prune -f
	@docker network prune -f
	@echo "$(RED)Full cleanup completed$(NC)"
