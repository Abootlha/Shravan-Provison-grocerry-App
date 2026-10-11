# Real-Time Tracking Setup & Configuration Guide

## 📋 Prerequisites

Before setting up the tracking system, ensure you have:

- ✅ Node.js 18+ installed
- ✅ MongoDB running
- ✅ Redis server running
- ✅ MapMyIndia account with API keys
- ✅ React Native development environment

---

## 🔑 Step 1: MapMyIndia API Setup

### 1.1 Register for MapMyIndia Account

1. Visit [MapMyIndia Developer Portal](https://apis.mappls.com/)
2. Sign up for a developer account
3. Create a new project
4. Generate API credentials:
   - **API Key** (Client ID)
   - **REST API Key** (for server-side calls)

### 1.2 Configure Environment Variables

Update `backend/.env`:

```env
# MapMyIndia Configuration
MAPMYINDIA_API_KEY=your_api_key_here
MAPMYINDIA_REST_KEY=your_rest_key_here

# Redis Configuration (for real-time updates)
REDIS_HOST=localhost
REDIS_PORT=6379

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/shravankirana

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 1.3 Verify Configuration

Create a test script `backend/test-mapmyindia.js`:

```javascript
const axios = require('axios');
require('dotenv').config();

const testMapMyIndia = async () => {
    const apiKey = process.env.MAPMYINDIA_REST_KEY;
    const baseUrl = 'https://apis.mappls.com';
    
    try {
        // Test reverse geocoding
        const response = await axios.get(
            `${baseUrl}/advancedmaps/v1/${apiKey}/rev_geocode`,
            { params: { lat: 28.6139, lng: 77.2090 } }
        );
        
        console.log('✅ MapMyIndia API is working!');
        console.log('Location:', response.data?.results?.[0]?.formatted_address);
        return true;
    } catch (error) {
        console.error('❌ MapMyIndia API test failed:', error.message);
        return false;
    }
};

testMapMyIndia();
```

Run: `node backend/test-mapmyindia.js`

---

## 🗄️ Step 2: Database Setup

### 2.1 Update Order Schema

The tracking fields are already in the schema. Verify in `backend/src/modules/orders/schemas/order.schema.ts`:

```typescript
tracking: {
    isActive: { type: Boolean, default: false },
    deliveryExecutiveId: { type: mongoose.Schema.Types.ObjectId },
    lastLocation: {
        lat: { type: Number },
        lng: { type: Number },
        timestamp: { type: Date, default: Date.now }
    },
    route: [{
        polyline: String,
        distance: Number,
        duration: Number
    }],
    eta: { type: Date },
    currentTrackingStatus: {
        type: String,
        enum: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']
    }
}
```

### 2.2 Create Indexes for Performance

Create `backend/src/scripts/create-tracking-indexes.ts`:

```typescript
import { MongoClient } from 'mongodb';

async function createTrackingIndexes() {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db();
    
    // Index for tracking queries
    await db.collection('orders').createIndex({ 
        'tracking.isActive': 1,
        'tracking.deliveryExecutiveId': 1 
    });
    
    // Index for location-based queries
    await db.collection('orders').createIndex({ 
        'tracking.lastLocation': '2dsphere' 
    });
    
    // Index for order lookup
    await db.collection('orders').createIndex({ orderId: 1 });
    
    console.log('✅ Tracking indexes created successfully');
    await client.close();
}

createTrackingIndexes().catch(console.error);
```

Run: `npx ts-node backend/src/scripts/create-tracking-indexes.ts`

---

## 🔴 Step 3: Redis Setup

### 3.1 Install Redis

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### 3.2 Verify Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 3.3 Test Redis Pub/Sub

Terminal 1 (Subscriber):
```bash
redis-cli
SUBSCRIBE tracking-updates
```

Terminal 2 (Publisher):
```bash
redis-cli
PUBLISH tracking-updates '{"orderId":"TEST-001","event":"locationUpdate"}'
```

You should see the message in Terminal 1.

---

## 🚀 Step 4: Backend Deployment

### 4.1 Install Dependencies

```bash
cd backend
npm install
```

### 4.2 Build Backend

```bash
npm run build
```

### 4.3 Start Backend Services

**Development:**
```bash
npm run start:dev
```

**Production:**
```bash
npm run start:prod
```

### 4.4 Verify Backend is Running

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

### 4.5 Test WebSocket Connection

Create `backend/test-websocket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000/orders', {
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ WebSocket connected!');
    socket.emit('joinOrder', 'TEST-ORDER-001');
});

socket.on('joined', (data) => {
    console.log('✅ Joined order room:', data);
});

socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
});

setTimeout(() => {
    socket.disconnect();
    process.exit(0);
}, 3000);
```

Run: `node backend/test-websocket.js`

---

## 📱 Step 5: Frontend Setup

### 5.1 Install Dependencies

```bash
npm install
```

### 5.2 Configure API Endpoint

Update `src/services/config.js`:

```javascript
const LOCAL_IP = '192.168.1.7'; // Your local IP

export const API_BASE_URL = __DEV__
    ? Platform.OS === 'web'
        ? 'http://localhost:3000'
        : `http://${LOCAL_IP}:3000`
    : 'https://api.shravankirana.com';

export const SOCKET_URL = API_BASE_URL;
```

### 5.3 Add Tracking Endpoints

Verify in `src/services/config.js`:

```javascript
export const ENDPOINTS = {
    // ... existing endpoints
    
    // Tracking endpoints
    TRACKING_INFO: (orderId) => `/tracking/${orderId}`,
    TRACKING_START: (orderId) => `/tracking/${orderId}/start`,
    TRACKING_LOCATION: (orderId) => `/tracking/${orderId}/location`,
    TRACKING_STOP: (orderId) => `/tracking/${orderId}/stop`,
};
```

### 5.4 Start Frontend

**Expo:**
```bash
npx expo start
```

**Web:**
```bash
npm run web
```

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

---

## 🧪 Step 6: Testing the System

### 6.1 Create Test Order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "deliveryAddress": {
      "address": "123 Test Street",
      "city": "Mumbai",
      "pincode": "400001"
    },
    "paymentMethod": "CASH"
  }'
```

### 6.2 Start Tracking

```bash
curl -X POST http://localhost:3000/tracking/ORDER_ID/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "deliveryExecutiveId": "DELIVERY_EXECUTIVE_ID"
  }'
```

### 6.3 Simulate Location Updates

Create `backend/simulate-delivery.js`:

```javascript
const axios = require('axios');

const orderId = 'YOUR_ORDER_ID';
const token = 'YOUR_JWT_TOKEN';

// Simulate movement from store to customer
const storeLat = 28.6139;
const storeLng = 77.2090;
const customerLat = 28.6050;
const customerLng = 77.2000;

let step = 0;
const totalSteps = 20;

const interval = setInterval(async () => {
    step++;
    const progress = step / totalSteps;
    
    const lat = storeLat + (customerLat - storeLat) * progress;
    const lng = storeLng + (customerLng - storeLng) * progress;
    
    try {
        await axios.post(
            `http://localhost:3000/tracking/${orderId}/location`,
            { lat, lng },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log(`✅ Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch (error) {
        console.error('❌ Update failed:', error.message);
    }
    
    if (step >= totalSteps) {
        clearInterval(interval);
        console.log('✅ Delivery simulation complete!');
    }
}, 3000); // Update every 3 seconds
```

Run: `node backend/simulate-delivery.js`

### 6.4 Monitor Real-time Updates

Open the app and navigate to Order Tracking screen. You should see:
- ✅ Map with moving delivery marker
- ✅ Real-time ETA updates
- ✅ Live notifications
- ✅ Status timeline updates

---

## 🔧 Step 7: Production Deployment

### 7.1 Environment Configuration

Create `backend/.env.production`:

```env
NODE_ENV=production
PORT=3000

# MongoDB (Production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/shravankirana

# Redis (Production)
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# MapMyIndia (Production)
MAPMYINDIA_API_KEY=your_production_api_key
MAPMYINDIA_REST_KEY=your_production_rest_key

# JWT
JWT_SECRET=your_strong_production_secret
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://shravankirana.com,https://app.shravankirana.com
```

### 7.2 Build for Production

```bash
cd backend
npm run build
```

### 7.3 Deploy Backend

**Using PM2:**
```bash
npm install -g pm2
pm2 start dist/main.js --name shravankirana-api
pm2 save
pm2 startup
```

**Using Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 7.4 Deploy Frontend

**Expo EAS Build:**
```bash
eas build --platform all
eas submit --platform all
```

**Web Deployment:**
```bash
npm run build:web
# Deploy to Vercel/Netlify/AWS S3
```

---

## 📊 Step 8: Monitoring & Logging

### 8.1 Setup Logging

Install Winston:
```bash
cd backend
npm install winston winston-daily-rotate-file
```

Configure in `backend/src/config/logger.ts`:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/tracking-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '14d'
        }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});
```

### 8.2 Monitor Redis

```bash
redis-cli monitor
```

### 8.3 Monitor WebSocket Connections

Add to `backend/src/sockets/orders.gateway.ts`:

```typescript
@WebSocketGateway()
export class OrdersGateway {
    private connectedClients = new Map();
    
    handleConnection(client: Socket) {
        this.connectedClients.set(client.id, {
            connectedAt: new Date(),
            rooms: []
        });
        this.logger.log(`Total connections: ${this.connectedClients.size}`);
    }
    
    handleDisconnect(client: Socket) {
        this.connectedClients.delete(client.id);
        this.logger.log(`Total connections: ${this.connectedClients.size}`);
    }
}
```

---

## ✅ Verification Checklist

- [ ] MapMyIndia API keys configured and tested
- [ ] MongoDB running with tracking indexes
- [ ] Redis running and pub/sub working
- [ ] Backend server running on port 3000
- [ ] WebSocket connections working
- [ ] Frontend can connect to backend
- [ ] Can create test orders
- [ ] Can start tracking
- [ ] Location updates work in real-time
- [ ] Map displays correctly
- [ ] ETA calculations working
- [ ] Notifications appearing
- [ ] Production environment configured

---

## 🐛 Troubleshooting

### Issue: WebSocket not connecting

**Solution:**
1. Check if backend is running: `curl http://localhost:3000/health`
2. Verify CORS settings in `backend/src/main.ts`
3. Check firewall rules
4. Try polling transport: `transports: ['polling', 'websocket']`

### Issue: MapMyIndia API errors

**Solution:**
1. Verify API keys are correct
2. Check API quota/limits
3. Test with curl:
```bash
curl "https://apis.mappls.com/advancedmaps/v1/YOUR_REST_KEY/rev_geocode?lat=28.6139&lng=77.2090"
```

### Issue: Location not updating

**Solution:**
1. Check Redis is running: `redis-cli ping`
2. Verify pub/sub channels: `redis-cli PSUBSCRIBE '*'`
3. Check backend logs for errors
4. Verify JWT token is valid

### Issue: Map not displaying

**Solution:**
1. Check WebView permissions
2. Verify internet connection
3. Check console for JavaScript errors
4. Try clearing app cache

---

## 📚 Next Steps

1. ✅ Setup complete - System is ready
2. 📖 Read [TRACKING_USER_GUIDE.md](./TRACKING_USER_GUIDE.md)
3. 👨‍💼 Read [TRACKING_ADMIN_GUIDE.md](./TRACKING_ADMIN_GUIDE.md)
4. 🧪 Run [TRACKING_TEST_SCENARIOS.md](./TRACKING_TEST_SCENARIOS.md)
5. 🚀 Deploy to production

---

**Setup Complete!** 🎉

Your real-time tracking system is now configured and ready to use!
