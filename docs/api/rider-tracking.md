# Rider and live tracking API

The contract between the backend, the rider app (`apps/rider-app`) and the customer tracking screen. Base URL for REST: `/api/v1`. Socket.IO namespace: `/tracking` (for example `http://<host>:3000/tracking`).

All rider REST routes need a **rider access token** (`Authorization: Bearer <accessToken>`). A non-rider token gets `403`. Errors use the usual shape `{ statusCode, message, error, timestamp, path }`.

Ids: `:id` in `/orders/:id/...` is the Mongo `_id` of the order (the `id`/`_id` field), not the human `orderId` (`ORD-...`). Socket payloads carry both: `orderId` is the Mongo `_id`, `orderNumber` is the human id.

---

## Order lifecycle (rider view)

```
PENDING ──(store confirms)──> CONFIRMED + riderId reserved ──(rider accepts)──> ASSIGNED
   ──(store packs)──> PACKED ──(rider)──> PICKED_UP ──(rider)──> OUT_FOR_DELIVERY ──(rider + OTP)──> DELIVERED
```

- When an order is confirmed, the backend auto-reserves the nearest available rider: the order stays `CONFIRMED` with `riderId` set, the rider becomes `busy`, and the rider gets `newOrderAssignment`.
- The rider then **accepts** (`PATCH /orders/:id/accept`, status becomes `ASSIGNED`) or **rejects** (`PATCH /orders/:id/reject`, the order goes back to the pool and is offered to another rider).
- Any status may move to `CANCELLED`. Riders may cancel only before pickup.

---

## REST endpoints

### `GET /riders/me`
`{ rider }` where `rider` is the rider document without the password: `_id, name, username, phone, vehicleType, vehicleNumber?, status ('available'|'busy'|'offline'), isActive, totalDeliveries, rating, currentLocation { type:'Point', coordinates:[lng,lat] }, lastLocationUpdate, createdAt, updatedAt`.

### `PUT /riders/me`
Profile save. All fields optional; unknown fields are rejected (`400`).
```jsonc
{
  "name": "Ravi Kumar",              // 1–80 chars
  "vehicleType": "Two Wheeler",      // one of: Two Wheeler | Bicycle | Electric Bike | Three Wheeler | Four Wheeler
  "vehicleNumber": "UP53 AB 1234"    // 2–20 chars, letters/digits/spaces/hyphens; "" clears it
}
```
Response: `{ rider }`. Phone and username cannot be changed here (admin only).

### `PUT /riders/me/availability`
Body `{ isOnline?: boolean, isAvailable?: boolean }` → `{ rider }`.
- `isOnline:false` → `offline` (no new assignments).
- `isOnline:true` → `available` (or `busy` if `isAvailable:false`).
- A rider with an active order (CONFIRMED-reserved, ASSIGNED, PACKED, PICKED_UP, OUT_FOR_DELIVERY) always stays `busy`.

### `PUT /riders/me/location`
REST fallback for the `riderLocationUpdate` socket event (same rules).
```jsonc
{ "latitude": 26.69, "longitude": 83.46, "accuracy": 12, "heading": 90, "speed": 6.5 }
```
- `latitude` −90..90, `longitude` −180..180 (0 is valid), `accuracy`/`speed` ≥ 0, `heading` 0..360; `400` otherwise.
- `heading`/`speed` of -1 (iOS "unknown") are accepted and ignored.
- Throttled per rider to one accepted update every **2.5 s**. Extra updates are dropped silently: response `{ throttled: true }` (HTTP 200, **no `rider` field**). Accepted: `{ throttled: false, rider }`. Clients that read `response.rider` must handle the throttled shape.
- Each accepted update is stored, broadcast as `riderLocationUpdate` to every active order room, and (while `OUT_FOR_DELIVERY`) may trigger an `etaUpdate`.
- Recommended client cadence: every 5 s while online, more often is pointless.

### `GET /riders/me/metrics`
```jsonc
{
  "totalDeliveries": 128,             // all-time DELIVERED orders by this rider
  "avgRating": 4.6,                   // rider.rating (0 when unrated)
  "acceptanceRate": 92,               // % of offers accepted (accepted / (accepted + rejected)); 100 when no offers yet
  "currency": "INR",
  "timezone": "Asia/Kolkata",         // boundaries of today/week/month
  "earningsBasis": "deliveryFee+tip", // see below
  "today": { "deliveries": 6,  "earnings": 150 },
  "week":  { "deliveries": 31, "earnings": 775 },  // week starts Monday 00:00
  "month": { "deliveries": 97, "earnings": 2425 }
}
```
- Periods are counted by `actualDeliveryTime` of orders with status `DELIVERED` and `riderId` = me.
- **Earnings assumption**: there is no payout/commission model in the backend yet, so earnings = sum of `deliveryFee + tip` of delivered orders (`tip` is 0 when the order has none). Treat it as an estimate, not a payout statement.
- Online hours are **not returned**: presence history is not stored, so they cannot be computed honestly.

### `GET /orders/available`
`{ orders }`: orders reserved for me that I have not accepted yet (status `CONFIRMED`, `riderId` = me), newest first, `userId` populated with `name, phone`.

### `GET /orders/current`
`{ order }`: my active order (ASSIGNED, PACKED, PICKED_UP or OUT_FOR_DELIVERY) as a tracking payload (see [Order payload](#order-payload)), or `{ order: null }`.

### `GET /orders/:id`
`{ order }` tracking payload. Riders only see orders assigned to them (`403` otherwise). The delivery OTP is never sent to riders.

### `PATCH /orders/:id/accept`
No body. Order must be `CONFIRMED` and reserved for me → becomes `ASSIGNED`. `400` wrong status, `403` not reserved for me, `409` changed concurrently. Response `{ order }`.

### `PATCH /orders/:id/reject`
Body optional: `{ "reason": "Vehicle issue" }` (≤ 300 chars).
- Allowed while the order is reserved for me and not picked up: `CONFIRMED` with `riderId` = me, or `ASSIGNED` (accepted, store not packed yet).
- Effect: `riderId` cleared, order goes (back) to `CONFIRMED`, a timeline/status-log entry is written (note `rider_rejected: <reason>`), I become `available` again (unless I went offline), and auto-assignment runs again **excluding me**. Admin dashboards get `order:updated`; the customer gets a status update (no rider).
- Errors: `403` not reserved for me, `400` already packed/picked up/finished, `409` changed concurrently.
- Response: `{ order, reassigned: boolean }` where `order` is the order after re-assignment (`riderId` may already be another rider, or `null` if nobody was available; admins can then assign manually).

### `PATCH /orders/:id/status`
```jsonc
{
  "status": "PICKED_UP",                 // rider may set PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED (before pickup only)
  "deliveryOtp": "1234",                 // required for DELIVERED (4–6 digits, 5 attempts max)
  "location": { "latitude": 26.69, "longitude": 83.46, "accuracy": 10 }   // optional
}
```
- `location` is validated (same ranges as above) and stored on the timeline entry for `PICKED_UP` and `DELIVERED` (`timeline[].location`). It is ignored for other statuses.
- Valid transitions: `PACKED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED`. `400` invalid transition / wrong OTP, `403` not my order, `409` concurrent change.
- Response `{ order }` (tracking payload).

---

## Socket.IO: `/tracking`

### Connecting
```js
io(`${HOST}/tracking`, { auth: { token: accessToken }, transports: ['websocket', 'polling'] })
```
The token can also be sent as `?token=` or an `Authorization: Bearer` header. It is checked **on connection**, the same way as REST: signature and expiry, refresh tokens rejected, logged-out sessions (logout / logout-all / admin revoke) rejected.

**Auth failures**

| When | What the client receives | What to do |
|---|---|---|
| During the handshake | `connect_error` with `err.message === 'unauthorized'` and `err.data = { code, message }` | Refresh the access token, set `socket.auth = { token }`, call `socket.connect()`. socket.io does not retry this by itself. |
| On an open socket (token expired, session revoked, or a message failed the per-message check) | `auth_error` event `{ code, message }`, then the server disconnects (`disconnect` reason `io server disconnect`) | Same: refresh, then reconnect with the new token. |

`code` is one of `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `REFRESH_TOKEN_NOT_ALLOWED`. If refreshing fails with 401 the session is over: sign out.

If the server cannot check the session (Redis down) the handshake fails with `err.message === 'auth_unavailable'` and `err.data.code === 'AUTH_UNAVAILABLE'`: do **not** refresh, just call `socket.connect()` again after a few seconds.

The server also closes the socket with `auth_error { code: 'TOKEN_EXPIRED' }` when the access token expires, so long-lived listeners renew their token instead of silently going stale.

### Rooms

| Room | Who is in it | Joined how |
|---|---|---|
| `rider_<riderId>` | The rider's own sockets | **Automatically on connect** for rider tokens. `joinRiderRoom` still works (idempotent). |
| `order_<orderMongoId>` | Order owner, assigned rider, staff | `joinOrderRoom { orderId }`. Riders are removed when unassigned. |

All rooms are shared across backend instances through the Redis adapter (falls back to single-instance when Redis is unavailable).

### Client → server

| Event | Payload | Reply / notes |
|---|---|---|
| `joinRiderRoom` | none | `joinedRiderRoom { riderId, roomName }` and `room.joined { ..., type:'rider' }` |
| `joinOrderRoom` | `{ orderId }` | `joinedOrderRoom { orderId, roomName }` and `room.joined { ..., type:'order' }`; `exception { message }` when not allowed |
| `leaveOrderRoom` | `{ orderId }` | `leftOrderRoom { orderId, roomName }` and `room.left` |
| `riderLocationUpdate` | `{ latitude, longitude, accuracy?, heading?, speed? }` (rider only) | `locationUpdateAck { success: true, throttled: boolean, timestamp }`. Throttled updates (< 2.5 s apart) are acknowledged with `throttled: true` and dropped. Invalid coordinates → `exception { message }`. 0 is a valid coordinate. |

### Server → rider (`rider_<riderId>`)

| Event (alias) | When | Payload |
|---|---|---|
| `newOrderAssignment` (`rider.assignment`) | An order is reserved for me (auto or admin) | `{ order: { id, orderId, orderNumber, status, pickup { name, phone, address { full, coordinates { latitude, longitude } } }, delivery { name, phone, address { full, coordinates } }, items, totalAmount, deliveryFee, tip } }` |
| `orderPacked` (`order.packed`) | Store packed my order | `{ orderId, status: 'PACKED', order, notification { title, body } }` |
| `orderStatusUpdate` (`order.status`) | Any status change of an order assigned to me | Same payload as the order room (below) |
| `orderCancelled` (`order.cancelled`) | An order assigned/reserved to me was cancelled (customer, admin, payment failure) | `{ orderId, orderNumber, status: 'CANCELLED', reason: string \| null, cancelledAt }` |
| `orderUnassigned` (`order.unassigned`) | I no longer have the order: admin unassigned me, admin reassigned it, or I rejected it | `{ orderId, orderNumber, reason: 'admin_unassigned' \| 'rider_rejected', timestamp }` |

On `orderCancelled` / `orderUnassigned` the rider app should drop the order from its UI and stop sending it anything; the server also removes the rider from the order room.

### Server → order room (`order_<orderMongoId>`): customer, rider, staff

| Event (alias) | Payload |
|---|---|
| `orderStatusUpdate` (`order.status`) | `{ orderId, status, paymentStatus, timeline, estimatedDeliveryTime, order, rider, tracking }` |
| `orderAssigned` (`order.assigned`) | `{ orderId, rider, order }` |
| `riderLocationUpdate` (`rider.location`) | `{ orderId, riderId, location { latitude, longitude, heading?, speed? }, timestamp, tracking, order }`, at most one per order every 2 s |
| `etaUpdate` (`eta.updated`) | `{ orderId, estimatedDeliveryTime, durationMinutes, distanceRemaining, tracking, order }`, recalculated from the rider location at most every 15 s while `OUT_FOR_DELIVERY` |

The delivery OTP is never included in socket payloads.

### Order payload
`order` / `GET /orders/:id` / `GET /orders/current` all use the tracking payload: the order document plus
```jsonc
{
  "rider": { "id", "name", "phone", "vehicleType", "vehicleNumber", "rating", "totalDeliveries", "status", "currentLocation": { "latitude", "longitude" } } | null,
  "customerName", "customerPhone",
  "storeName", "storePhone", "storeAddress", "storeLocation": { "latitude", "longitude" },
  "tracking": {
    "activeLeg": "to_store" | "to_customer" | null,
    "riderLocation": { "latitude", "longitude" } | null,
    "routeCoordinates": [{ "latitude", "longitude" }],
    "estimatedDeliveryTime", "durationMinutes", "distanceRemaining", "lastLocationUpdateAt"
  },
  "timeline": [{ "status", "timestamp", "changedBy", "location"?: { "latitude", "longitude", "accuracy"? }, "note"? }]
}
```

---

## Admin side effects (for reference)

Admin dashboards listen on the `/orders` namespace (`admin:orders` room, `order:new` / `order:updated`). Accept, reject, unassign, status changes and cancellations all emit `order:updated`.
