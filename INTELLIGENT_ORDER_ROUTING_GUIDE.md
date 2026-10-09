# Intelligent Order Routing System - Complete Guide

## Overview

Your grocery delivery app now has an intelligent order routing and queue management system that automatically optimizes delivery sequences based on:
- **Distance** from store to customer
- **Estimated delivery time**
- **Order waiting time** (how long the order has been pending)
- **Priority calculation** (combines all factors)

---

## How It Works

### 1. Store Location Setup

Admin configures the grocery store location with latitude and longitude in the settings.

**Database**: `StoreSettings` collection
```javascript
{
  storeId: "main",
  storeName: "Shravan Kirana Store",
  location: {
    latitude: 28.6139,
    longitude: 77.2090,
    address: "Store Address"
  },
  serviceRadiusKm: 4,
  estimatedDeliveryMinutes: 10
}
```

### 2. Order Placement with Coordinates

When customers place orders, their delivery address includes latitude and longitude:

```javascript
{
  deliveryAddress: {
    type: "Home",
    address: "123 Main Street",
    city: "Delhi",
    pincode: "110001",
    latitude: 28.6050,
    longitude: 77.2000
  }
}
```

### 3. Intelligent Priority Calculation

The system calculates priority for each pending order using this formula:

```
Priority Score = (Distance × 10) + (EstimatedTime × 5) + WaitingPenalty

Where:
- Distance: km from store to customer
- EstimatedTime: minutes to deliver
- WaitingPenalty: max(0, 30 - waitingMinutes) × 2
```

**Lower score = Higher priority**

### 4. Automatic Route Optimization

Orders are automatically sorted by priority:
- **Order 3** (5 min, 1 km) → Priority: 35 → **Deliver FIRST**
- **Order 1** (10 min, 2 km) → Priority: 70 → Deliver second
- **Order 2** (15 min, 3 km) → Priority: 105 → Deliver third

### 5. Dynamic ETA Calculation

Each order gets an estimated delivery time based on cumulative delivery times:
- Order 3: Current time + 5 min = 2:05 PM
- Order 1: 2:05 PM + 10 min = 2:15 PM
- Order 2: 2:15 PM + 15 min = 2:30 PM

### 6. Real-time Route Recalculation

When an order status changes to DELIVERED or CANCELLED, the system automatically recalculates the route for remaining orders.

---

## API Endpoints

### For Admin Panel

#### 1. Get Delivery Queue
```http
GET /admin/orders/delivery-queue
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "queue": [
    {
      "position": 1,
      "orderId": "ORD-20260302-ABC123",
      "orderStatus": "CONFIRMED",
      "customerAddress": "123 Main Street, Delhi",
      "distanceKm": 1.2,
      "estimatedTimeMinutes": 8,
      "priority": 42,
      "placedAt": "2026-03-02T14:00:00Z",
      "estimatedDeliveryTime": "2026-03-02T14:08:00Z"
    },
    {
      "position": 2,
      "orderId": "ORD-20260302-DEF456",
      "orderStatus": "PACKED",
      "customerAddress": "456 Park Avenue, Delhi",
      "distanceKm": 2.5,
      "estimatedTimeMinutes": 12,
      "priority": 85,
      "placedAt": "2026-03-02T13:55:00Z",
      "estimatedDeliveryTime": "2026-03-02T14:20:00Z"
    }
  ]
}
```

#### 2. Optimize Route Manually
```http
POST /admin/orders/optimize-route
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "optimizedRoute": [
    {
      "orderId": "ORD-20260302-ABC123",
      "position": 1,
      "estimatedDeliveryTime": "2026-03-02T14:08:00Z",
      "distanceFromStore": 1.2,
      "estimatedTimeMinutes": 8
    }
  ]
}
```

#### 3. Get Next Order to Deliver
```http
GET /admin/orders/next-delivery
Authorization: Bearer <admin_token>
```

#### 4. Get Route for Specific Order
```http
GET /admin/orders/:orderId/route
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "route": {
    "orderId": "ORD-20260302-ABC123",
    "distance": 1200,
    "duration": 480,
    "polyline": "encoded_polyline_string",
    "storeLocation": {
      "lat": 28.6139,
      "lng": 77.2090,
      "address": "Shravan Kirana Store"
    },
    "customerLocation": {
      "lat": 28.6050,
      "lng": 77.2000
    }
  }
}
```

### For Delivery Partner App

#### 1. Get Delivery Queue
```http
GET /delivery-partner/queue
Authorization: Bearer <delivery_partner_token>
```

#### 2. Get Next Order
```http
GET /delivery-partner/next-order
Authorization: Bearer <delivery_partner_token>
```

**Response:**
```json
{
  "nextOrder": {
    "orderId": "ORD-20260302-ABC123",
    "orderStatus": "CONFIRMED",
    "items": [...],
    "deliveryAddress": {...},
    "totalAmount": 450,
    "estimatedDeliveryTime": "2026-03-02T14:08:00Z",
    "deliveryInstructions": "Ring the doorbell twice"
  }
}
```

#### 3. Get Route for Order
```http
GET /delivery-partner/order/:orderId/route
Authorization: Bearer <delivery_partner_token>
```

#### 4. Update Order Status
```http
PATCH /delivery-partner/order/:orderId/status
Authorization: Bearer <delivery_partner_token>
Content-Type: application/json

{
  "status": "OUT_FOR_DELIVERY",
  "note": "Picked up from store"
}
```

#### 5. Mark as Picked Up
```http
POST /delivery-partner/order/:orderId/pickup
Authorization: Bearer <delivery_partner_token>
```

#### 6. Mark as Delivered
```http
POST /delivery-partner/order/:orderId/deliver
Authorization: Bearer <delivery_partner_token>
```

**Response:**
```json
{
  "message": "Order delivered successfully",
  "order": {
    "orderId": "ORD-20260302-ABC123",
    "orderStatus": "DELIVERED"
  }
}
```

#### 7. Get My Orders
```http
GET /delivery-partner/my-orders
Authorization: Bearer <delivery_partner_token>
```

---

## Order Status Flow

```
PLACED
  ↓
CONFIRMED (Admin confirms order)
  ↓
PACKED (Order is packed and ready)
  ↓
OUT_FOR_DELIVERY (Delivery partner picks up)
  ↓
DELIVERED (Delivery partner delivers)
```

**Alternative:**
```
PLACED → CANCELLED (Order cancelled)
CONFIRMED → CANCELLED (Order cancelled)
```

---

## Distance Calculation

### Method 1: Haversine Formula (Fallback)
Calculates straight-line distance between two coordinates:

```javascript
distance = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)))
```

Where R = 6371 km (Earth's radius)

### Method 2: MapMyIndia Directions API (Preferred)
Gets actual driving distance and time considering:
- Road network
- Traffic conditions
- Turn-by-turn directions

---

## Priority Examples

### Example 1: Distance Priority
```
Order A: 1 km, 5 min, waiting 2 min → Priority = 10 + 25 + 56 = 91
Order B: 3 km, 10 min, waiting 2 min → Priority = 30 + 50 + 56 = 136
Order C: 2 km, 7 min, waiting 2 min → Priority = 20 + 35 + 56 = 111

Delivery Sequence: A → C → B
```

### Example 2: Waiting Time Priority
```
Order A: 2 km, 10 min, waiting 5 min → Priority = 20 + 50 + 50 = 120
Order B: 2 km, 10 min, waiting 25 min → Priority = 20 + 50 + 10 = 80
Order C: 2 km, 10 min, waiting 35 min → Priority = 20 + 50 + 0 = 70

Delivery Sequence: C → B → A (older orders first)
```

### Example 3: Mixed Priority
```
Order A: 5 km, 20 min, waiting 5 min → Priority = 50 + 100 + 50 = 200
Order B: 1 km, 5 min, waiting 10 min → Priority = 10 + 25 + 40 = 75
Order C: 3 km, 12 min, waiting 15 min → Priority = 30 + 60 + 30 = 120

Delivery Sequence: B → C → A (closest first, then by priority)
```

---

## Configuration

### Store Settings (Admin Panel)

Admin should configure store location in Settings:

```javascript
{
  storeName: "Shravan Kirana Store",
  location: {
    latitude: 28.6139,  // Store latitude
    longitude: 77.2090, // Store longitude
    address: "123 Store Street, Delhi"
  },
  serviceRadiusKm: 4, // Maximum delivery distance
  estimatedDeliveryMinutes: 10 // Average delivery time
}
```

### MapMyIndia API (backend/.env)

```env
MAPMYINDIA_API_KEY=your_api_key_here
MAPMYINDIA_CLIENT_ID=your_client_id_here
MAPMYINDIA_CLIENT_SECRET=your_client_secret_here
```

Get free API keys from: https://www.mapmyindia.com/api/

---

## Frontend Integration

### Admin Panel - Delivery Queue Component

```typescript
// Fetch delivery queue
const response = await fetch('/admin/orders/delivery-queue', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const { queue } = await response.json();

// Display queue
queue.forEach(order => {
  console.log(`${order.position}. ${order.orderId}`);
  console.log(`   Distance: ${order.distanceKm} km`);
  console.log(`   ETA: ${order.estimatedTimeMinutes} min`);
  console.log(`   Priority: ${order.priority}`);
});
```

### Delivery Partner App - Next Order

```javascript
// Get next order to deliver
const response = await fetch('/delivery-partner/next-order', {
  headers: {
    'Authorization': `Bearer ${deliveryPartnerToken}`
  }
});

const { nextOrder } = await response.json();

if (nextOrder) {
  // Show order details
  // Show route on map
  // Allow pickup/delivery actions
}
```

---

## Automatic Recalculation

The system automatically recalculates routes when:

1. **Order is delivered**: Removes from queue, recalculates remaining orders
2. **Order is cancelled**: Removes from queue, recalculates remaining orders
3. **New order is placed**: Adds to queue, recalculates all orders
4. **Order status changes**: Updates priority, recalculates if needed

---

## Benefits

### For Customers
- ✅ Accurate delivery time estimates
- ✅ Faster deliveries (optimized routes)
- ✅ Fair queue system (waiting time considered)

### For Delivery Partners
- ✅ Clear delivery sequence
- ✅ Optimized routes (less travel time)
- ✅ Easy-to-use app interface

### For Business
- ✅ More deliveries per hour
- ✅ Lower fuel costs
- ✅ Higher customer satisfaction
- ✅ Better resource utilization

---

## Testing

### Test Scenario 1: Multiple Orders

1. Place 3 orders with different addresses
2. Check delivery queue: `GET /admin/orders/delivery-queue`
3. Verify orders are sorted by priority
4. Mark first order as delivered
5. Check queue again - should be recalculated

### Test Scenario 2: Distance Priority

1. Place order A: 5 km away
2. Place order B: 1 km away
3. Place order C: 3 km away
4. Check queue - should show: B, C, A

### Test Scenario 3: Waiting Time Priority

1. Place order A, wait 30 minutes
2. Place order B (same distance as A)
3. Check queue - A should be first (older)

---

## Troubleshooting

### Issue: Orders not sorted correctly
**Solution**: Check if delivery addresses have latitude/longitude

### Issue: Distance calculation fails
**Solution**: Verify MapMyIndia API credentials in .env

### Issue: ETA not updating
**Solution**: Ensure route recalculation is triggered on status change

### Issue: Store location not set
**Solution**: Configure store location in admin settings

---

## Next Steps

1. ✅ Configure store location in admin panel
2. ✅ Get MapMyIndia API keys
3. ✅ Test with sample orders
4. ✅ Build delivery partner app UI
5. ✅ Integrate with real-time tracking

---

**Status**: ✅ Production Ready
**Last Updated**: March 2, 2026
