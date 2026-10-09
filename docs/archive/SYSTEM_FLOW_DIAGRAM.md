# System Flow Diagram - Visual Guide

## Complete Order Flow with Intelligent Routing

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER APP                                 │
│                                                                      │
│  1. Select Language (English/Hindi)                                 │
│  2. Browse Products (Auto-translated)                               │
│  3. Add to Cart                                                     │
│  4. Place Order with Address (lat/lng)                             │
│                                                                      │
│  Order Details:                                                     │
│  ┌──────────────────────────────────────┐                          │
│  │ Order ID: ORD-20260302-ABC123        │                          │
│  │ Items: Milk, Bread, Eggs             │                          │
│  │ Total: ₹450                          │                          │
│  │ Address: 123 Main St                 │                          │
│  │ Coordinates: 28.6050, 77.2000        │                          │
│  └──────────────────────────────────────┘                          │
│                          ↓                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────────┐
│                    BACKEND SERVER                                    │
│                          ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  ORDER ROUTING SERVICE (Intelligent Optimization)          │   │
│  │                                                             │   │
│  │  Step 1: Get Store Location                                │   │
│  │  ┌─────────────────────────────────────┐                   │   │
│  │  │ Store: Shravan Kirana               │                   │   │
│  │  │ Lat: 28.6139, Lng: 77.2090          │                   │   │
│  │  └─────────────────────────────────────┘                   │   │
│  │                                                             │   │
│  │  Step 2: Calculate Distance for All Pending Orders         │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ Order 1: 2.0 km → 10 min → Priority: 70            │   │   │
│  │  │ Order 2: 3.0 km → 15 min → Priority: 105           │   │   │
│  │  │ Order 3: 1.0 km → 5 min  → Priority: 35  ⭐ FIRST  │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  Step 3: Sort by Priority (Lower = Higher Priority)        │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │ 1. Order 3 (Priority: 35)  → ETA: 2:05 PM          │   │   │
│  │  │ 2. Order 1 (Priority: 70)  → ETA: 2:15 PM          │   │   │
│  │  │ 3. Order 2 (Priority: 105) → ETA: 2:30 PM          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  Step 4: Update Database with ETAs                         │   │
│  │  Step 5: Notify Admin & Delivery Partner                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────────┐
│                      ADMIN PANEL                                     │
│                          ↓                                          │
│  View Delivery Queue:                                               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Position │ Order ID  │ Distance │ Time │ Priority │ ETA    │   │
│  ├──────────┼───────────┼──────────┼──────┼──────────┼────────┤   │
│  │    1     │ Order 3   │  1.0 km  │ 5min │    35    │ 2:05PM │   │
│  │    2     │ Order 1   │  2.0 km  │10min │    70    │ 2:15PM │   │
│  │    3     │ Order 2   │  3.0 km  │15min │   105    │ 2:30PM │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Actions:                                                           │
│  [Confirm Order] [Pack Order] [Assign Delivery Partner]            │
│                          ↓                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────────┐
│                  DELIVERY PARTNER APP                                │
│                          ↓                                          │
│  Get Next Order:                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 🎯 NEXT DELIVERY                                            │   │
│  │                                                             │   │
│  │ Order ID: ORD-20260302-ABC123 (Order 3)                    │   │
│  │ Customer: John Doe                                          │   │
│  │ Address: 123 Main St, Delhi                                 │   │
│  │ Distance: 1.0 km                                            │   │
│  │ ETA: 5 minutes                                              │   │
│  │ Items: Milk, Bread, Eggs                                    │   │
│  │ Total: ₹450                                                 │   │
│  │                                                             │   │
│  │ [View Route] [Mark Picked Up] [Navigate]                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
│  View Route on Map:                                                 │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │     🏪 Store                                                │   │
│  │      │                                                      │   │
│  │      │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │      │                                                      │   │
│  │      │ (1.0 km, 5 minutes)                                 │   │
│  │      │                                                      │   │
│  │      ↓                                                      │   │
│  │     🏠 Customer                                             │   │
│  │                                                             │   │
│  │  [Start Navigation] [Call Customer]                        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
│  Mark as Picked Up → OUT_FOR_DELIVERY                              │
│                          ↓                                          │
│  Navigate to Customer (Real-time tracking)                         │
│                          ↓                                          │
│  Mark as Delivered → DELIVERED                                     │
│                          ↓                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────────┐
│                    BACKEND SERVER                                    │
│                          ↓                                          │
│  Order 3 Delivered! Recalculate Route...                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  NEW DELIVERY QUEUE (Auto-recalculated)                    │   │
│  │                                                             │   │
│  │  1. Order 1 (Priority: 70)  → ETA: 2:10 PM (updated!)     │   │
│  │  2. Order 2 (Priority: 105) → ETA: 2:20 PM (updated!)     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          ↓                                          │
│  Notify Admin & Delivery Partner of Updated Queue                  │
│                          ↓                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────────┐
│                  DELIVERY PARTNER APP                                │
│                          ↓                                          │
│  Get Next Order (Order 1):                                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 🎯 NEXT DELIVERY                                            │   │
│  │                                                             │   │
│  │ Order ID: ORD-20260302-DEF456 (Order 1)                    │   │
│  │ Distance: 2.0 km                                            │   │
│  │ ETA: 10 minutes                                             │   │
│  │                                                             │   │
│  │ [View Route] [Mark Picked Up] [Navigate]                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ... Repeat process ...                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Priority Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIORITY CALCULATION                          │
│                                                                  │
│  Input: Order with delivery address                             │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 1: Calculate Distance                               │  │
│  │                                                           │  │
│  │ Store Location: (28.6139, 77.2090)                       │  │
│  │ Customer Location: (28.6050, 77.2000)                    │  │
│  │                                                           │  │
│  │ Using Haversine Formula:                                 │  │
│  │ Distance = 1.2 km                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 2: Calculate Estimated Time                         │  │
│  │                                                           │  │
│  │ Average Speed: 20 km/h                                   │  │
│  │ Travel Time: (1.2 / 20) × 60 = 3.6 min                  │  │
│  │ Preparation Time: 5 min                                  │  │
│  │                                                           │  │
│  │ Total Estimated Time = 9 minutes                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 3: Calculate Waiting Penalty                        │  │
│  │                                                           │  │
│  │ Order Placed: 2:00 PM                                    │  │
│  │ Current Time: 2:05 PM                                    │  │
│  │ Waiting Time: 5 minutes                                  │  │
│  │                                                           │  │
│  │ Waiting Penalty = max(0, 30 - 5) × 2 = 50               │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Step 4: Calculate Final Priority                         │  │
│  │                                                           │  │
│  │ Priority = (Distance × 10) + (Time × 5) + Penalty        │  │
│  │          = (1.2 × 10) + (9 × 5) + 50                     │  │
│  │          = 12 + 45 + 50                                  │  │
│  │          = 107                                           │  │
│  │                                                           │  │
│  │ ⭐ Lower Priority = Higher Delivery Priority             │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  Output: Priority Score = 107                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Real-Time Tracking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REAL-TIME TRACKING                            │
│                                                                  │
│  Customer App                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📱 Order Tracking Screen                                 │  │
│  │                                                           │  │
│  │ Order: ORD-20260302-ABC123                               │  │
│  │ Status: OUT_FOR_DELIVERY                                 │  │
│  │ ETA: 5 minutes                                           │  │
│  │                                                           │  │
│  │ ┌─────────────────────────────────────────────────────┐ │  │
│  │ │                    MAP VIEW                          │ │  │
│  │ │                                                      │ │  │
│  │ │  🏪 Store ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │  │
│  │ │                                                      │ │  │
│  │ │                    🚴 Delivery Partner (animated)    │ │  │
│  │ │                                                      │ │  │
│  │ │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │  │
│  │ │                                                      │ │  │
│  │ │                                        🏠 Your Home  │ │  │
│  │ └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ Delivery Partner: Raj Kumar                              │  │
│  │ Distance: 500m away                                      │  │
│  │ [Call Delivery Partner]                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↕ WebSocket Connection                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Backend Server (Real-time Updates)                       │  │
│  │                                                           │  │
│  │ Every 30 seconds:                                        │  │
│  │ 1. Get delivery partner location                         │  │
│  │ 2. Calculate distance to customer                        │  │
│  │ 3. Update ETA                                            │  │
│  │ 4. Broadcast via WebSocket                               │  │
│  │ 5. Send push notification if < 500m                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↕ WebSocket Connection                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Delivery Partner App                                     │  │
│  │                                                           │  │
│  │ 1. GPS tracks location                                   │  │
│  │ 2. Sends location to server                              │  │
│  │ 3. Receives route updates                                │  │
│  │ 4. Shows turn-by-turn navigation                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Language Translation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  LANGUAGE TRANSLATION FLOW                       │
│                                                                  │
│  User Opens App                                                  │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Language Selection Screen                                │  │
│  │                                                           │  │
│  │ [🇬🇧 English]  [🇮🇳 हिंदी]                               │  │
│  │                                                           │  │
│  │ User selects: हिंदी                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  Save to Redux Store & AsyncStorage                             │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ UI Text Translation (Instant)                            │  │
│  │                                                           │  │
│  │ "Shop by Category" → "श्रेणी के अनुसार खरीदें"           │  │
│  │ "Add to Cart" → "कार्ट में जोड़ें"                       │  │
│  │ "Checkout" → "चेकआउट"                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Backend Data Translation (Auto)                          │  │
│  │                                                           │  │
│  │ Fetch Products from API                                  │  │
│  │         ↓                                                 │  │
│  │ Product: { name: "Milk", nameHi: null }                  │  │
│  │         ↓                                                 │  │
│  │ Check if Hindi translation exists                        │  │
│  │         ↓ (No)                                            │  │
│  │ Call Google Translate API                                │  │
│  │         ↓                                                 │  │
│  │ "Milk" → "दूध"                                           │  │
│  │         ↓                                                 │  │
│  │ Save to database: { name: "Milk", nameHi: "दूध" }       │  │
│  │         ↓                                                 │  │
│  │ Display: "दूध"                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│         ↓                                                        │
│  User sees fully translated app in Hindi!                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow

```
Customer App → Backend API → Database → Backend API → Customer App
     ↓              ↓            ↓            ↓              ↓
  Place Order   Validate    Save Order   Calculate      Show ETA
                  Data                     Route
                                             ↓
                                    Order Routing Service
                                             ↓
                                    Priority Calculation
                                             ↓
                                    Sort by Priority
                                             ↓
                                    Update ETAs
                                             ↓
                                    Notify Admin
                                             ↓
                                    Admin Panel
                                             ↓
                                    Assign Delivery Partner
                                             ↓
                                    Delivery Partner App
                                             ↓
                                    Real-time Tracking
                                             ↓
                                    Customer App (Live Map)
```

---

This visual guide shows how all components work together to create an intelligent, efficient delivery system!
