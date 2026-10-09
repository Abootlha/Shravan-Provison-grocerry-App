#!/bin/bash

# ShravanKirana - Start All Backend Services

echo "🚀 Starting ShravanKirana Backend Services..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Start MongoDB if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo -e "${YELLOW}Starting MongoDB...${NC}"
    mkdir -p ~/data/db ~/logs
    /home/talha/bin/mongod --dbpath ~/data/db --fork --logpath ~/logs/mongod.log 2>/dev/null || mongod --dbpath ~/data/db --fork --logpath ~/logs/mongod.log 2>/dev/null || true
    sleep 2
fi

# Start Redis if not running
if ! pgrep -x "redis-server" > /dev/null; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    redis-server --daemonize yes 2>/dev/null || true
    sleep 1
fi

# Base directory
BASE_DIR="/home/talha/Desktop/ShravanKirana/services"

# Services configuration: name http_port grpc_port
SERVICES=(
    "auth-svc:8001:8002"
    "user-svc:8002:3002"
    "rider-svc:8003:3003"
    "order-svc:8004:3004"
    "product-svc:8005:3005"
    "cart-svc:8006:3006"
    "payment-svc:8007:3007"
    "notification-svc:8008:3008"
    "location-svc:8009:3009"
    "tracking-gw:8010:3010"
    "analytics-svc:8011:3011"
)

# Kill existing services
pkill -f "node.*services" 2>/dev/null
sleep 1

# Start each service with nohup
for svc in "${SERVICES[@]}"; do
    IFS=':' read -r name http_port grpc_port <<< "$svc"
    
    svc_dir="$BASE_DIR/$name"
    
    if [ -d "$svc_dir" ]; then
        echo -e "${GREEN}Starting $name (HTTP:$http_port)${NC}"
        cd "$svc_dir"
        nohup env PORT=$http_port HTTP_PORT=$http_port GRPC_PORT=$grpc_port node dist/main.js > ~/logs/$name.log 2>&1 &
        disown
    else
        echo -e "${RED}Service directory not found: $svc_dir${NC}"
    fi
done

# Wait for services to start
echo ""
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
sleep 8

# Check status
echo ""
echo "=== Service Status ==="
for svc in "${SERVICES[@]}"; do
    IFS=':' read -r name http_port <<< "$svc"
    if curl -s --connect-timeout 2 "http://localhost:$http_port/" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name ($http_port)${NC}"
    else
        echo -e "${RED}✗ $name ($http_port)${NC}"
    fi
done

echo ""
echo "📝 Logs available at: ~/logs/"
echo "   View with: tail -f ~/logs/<service-name>.log"
echo ""
echo -e "${GREEN}All services started!${NC}"
