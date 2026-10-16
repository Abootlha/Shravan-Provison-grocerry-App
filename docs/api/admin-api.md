# Admin API

Endpoints added or changed for the admin redesign. Base URL: `/api/v1`. All admin routes need a staff access token (`Authorization: Bearer <token>` or the `accessToken` cookie).

## Conventions

- **Roles**: `admin` (everything) and `manager` (orders, riders, inventory, customers, analytics; read-only catalogue; no settings, fees, team, audit log, archive/delete). Each endpoint lists who can call it. Wrong role → `403 { message: "Admin access required" | "You do not have permission to do this" }`.
- **Login**: `POST /auth/admin/login { username, password }` now works for `admin` and `manager`. `user.role` in the response tells the panel which menus to show.
- **Lists** return a named array plus `total`, `page`, `limit`, `totalPages`. `page` ≥ 1 (default 1), `limit` 1–100 (default 20).
- **Query strings are validated strictly.** Unknown query parameters return `400`. Booleans are `true`/`false`. List filters such as `status` accept comma-separated values.
- **Errors**: `{ statusCode, message, error, timestamp, path }`, plus `code` (and any extra fields) for coded errors such as `STORE_CLOSED`.
- **Ids**: invalid ObjectIds in `/:id` routes return `400 { message: "Invalid id" }` where marked _(id checked)_.
- **Audit**: every successful POST/PUT/PATCH/DELETE by an admin or manager is recorded in `auditlogs` (see [Audit log](#audit-log)).

---

## Store settings

### `GET /settings/store` (public)
Additive change. New fields are marked ★.
```jsonc
{
  "storeName": "Shravan Kirana Store",
  "location": { "latitude": 26.69, "longitude": 83.46, "address": "…" },
  "storeTimings": { "openTime": "08:00", "closeTime": "22:00" },
  "contactPhone": "+91…" | null,          // no placeholder default any more
  "contactEmail": "store@…" | null,        // ★
  "address": "Registered address" | null,  // ★ (location.address is the pickup point)
  "gstin": "09AAACH7409R1ZZ" | null,       // ★
  "timezone": "Asia/Kolkata",              // ★
  "fees": {                                // ★ defaults = the old hard-coded values
    "deliveryFee": 25,
    "freeDeliveryThreshold": 200,
    "packagingFee": 5,
    "discountRate": 0.05                   // fraction of item total
  },
  "serviceRadiusKm": 4,
  "estimatedDeliveryMinutes": 10,
  "isActive": true,                        // false = store paused manually
  "isOpen": true,                          // ★ computed now from storeTimings + timezone + isActive
  "nextOpenAt": "2026-10-13T02:30:00.000Z" | null // ★ ISO; null when open or paused (isActive=false)
}
```
Timings: `openTime == closeTime` means open 24 hours; `closeTime < openTime` is an overnight window (e.g. 18:00–02:00).

### `POST /settings/store` — admin
Partial update; send only what changes. Response: `{ message, settings }` where `settings` has the GET shape.
```jsonc
{
  "storeName": "string ≤100",
  "location": { "latitude": -90..90, "longitude": -180..180, "address": "string ≤500" },
  "storeTimings": { "openTime": "HH:mm", "closeTime": "HH:mm" },
  "contactPhone": "+91 98…" ,           // "" clears
  "contactEmail": "a@b.c",              // "" or null clears
  "address": "string ≤500",             // "" or null clears
  "gstin": "15-char GSTIN",             // "" or null clears; stored upper-case
  "timezone": "IANA zone, e.g. Asia/Kolkata",
  "fees": {                             // each field optional; others keep their value
    "deliveryFee": 0..10000,
    "freeDeliveryThreshold": 0..100000,
    "packagingFee": 0..10000,
    "discountRate": 0..0.9
  },
  "serviceRadiusKm": 0.5..50,
  "estimatedDeliveryMinutes": 1..240,
  "isActive": true
}
```
`isOpen` / `nextOpenAt` are read-only; sending them returns 400.

---

## Orders

### `POST /orders` (customer) — changed
Fees now come from `settings.fees` (same totals as before with the defaults). Drafts, archived products and products without a positive price are rejected (`400 "Product … is no longer available"`).
When the store is closed:
```json
409 { "statusCode": 409, "code": "STORE_CLOSED", "message": "The store is closed right now. Please order once it opens.", "nextOpenAt": "2026-10-13T02:30:00.000Z" }
```
`nextOpenAt` is `null` when the store is paused (`isActive=false`).

### `POST /orders/quote` (any signed-in user)
Same items payload as `POST /orders` (`price`, `name`, `image` are accepted and ignored). Uses the same calculation as order creation and does not reserve stock.
```jsonc
// request
{ "items": [ { "productId": "<id>", "quantity": 2 } ] }   // 1–50 lines, quantity 1–100
// 200
{
  "itemTotal": 60, "deliveryFee": 25, "packagingFee": 5, "discount": 3, "totalAmount": 87,
  "freeDeliveryThreshold": 200,
  "isOpen": true, "nextOpenAt": null,
  "items": [ { "productId": "<id>", "name": "Milk", "quantity": 2, "price": 30, "lineTotal": 60, "image": "…" } ]
}
```
Errors: `400` unavailable product or not enough stock.

### `GET /admin/orders` — admin, manager
Query (all optional):

| param | values |
|---|---|
| `page`, `limit` | pagination |
| `status` | comma list of `PENDING,CONFIRMED,ASSIGNED,PACKED,PICKED_UP,OUT_FOR_DELIVERY,DELIVERED,CANCELLED` |
| `paymentStatus` | `PENDING` \| `COMPLETED` \| `FAILED` \| `REFUNDED` |
| `paymentMethod` | `COD` \| `UPI` \| `CARD` \| `WALLET` |
| `riderId` | rider id |
| `unassigned` | `true` = no rider (ignored if `riderId` is set) |
| `requiresManualReview` | `true` / `false` |
| `dateFrom`, `dateTo` | ISO date or date-time on `createdAt`. A bare `YYYY-MM-DD` for `dateTo` includes that whole day (UTC). `startDate`/`endDate` are accepted as legacy aliases. |
| `q` | ≤100 chars. Starts with `ORD` → orderId prefix; otherwise orderId contains `q` (case-insensitive) **or** customer name/phone contains `q` |
| `sort` | `-createdAt` (default), `createdAt`, `-updatedAt`, `updatedAt`, `-totalAmount`, `totalAmount` |

```jsonc
{
  "orders": [ {
    "_id", "orderId", "orderStatus", "paymentStatus", "paymentMethod",
    "itemTotal", "deliveryFee", "packagingFee", "discount", "totalAmount",
    "items": [ { "productId", "name", "quantity", "price", "image" } ],
    "deliveryAddress": { "type", "address", "city", "pincode", "coordinates": { "type": "Point", "coordinates": [lng, lat] } },
    "userId": { "_id", "name", "phone" },
    "riderId": { "_id", "name", "phone", "vehicleType", "status" } | null,
    "timeline": [ { "status", "timestamp", "changedBy" } ],
    "requiresManualReview", "manualReviewReason", "cancellationReason",
    "estimatedDeliveryTime", "actualDeliveryTime", "createdAt", "updatedAt"
  } ],
  "total", "page", "limit", "totalPages"
}
```
`deliveryOtp` is never returned.

### `GET /admin/orders/:id` — admin, manager
`:id` = Mongo `_id` or `orderId` (`ORD-…`). Response `{ order }`: the tracking payload plus `statusTimeline`.
```jsonc
{ "order": {
  /* all order fields as above (userId/riderId populated) */
  "rider": { "id", "name", "phone", "vehicleType", "rating", "totalDeliveries", "status", "currentLocation": { "latitude", "longitude" } | null } | null,
  "customerName", "customerPhone",
  "storeName", "storePhone", "storeAddress", "storeLocation": { "latitude", "longitude" },
  "tracking": { "activeLeg": "to_store" | "to_customer" | null, "riderLocation", "routeCoordinates", "estimatedDeliveryTime", "durationMinutes", "distanceRemaining", "lastLocationUpdateAt" },
  "statusTimeline": [ {
    "previousStatus": "PENDING" | null, "status": "CONFIRMED", "note": "…" | null,
    "changedBy": "<id>", "changedByName": "Asha" | null, "changedByRole": "admin" | "manager" | "customer" | "rider" | null,
    "at": "ISO"
  } ]
} }
```
404 when not found.

### `PATCH /admin/orders/:id/status` — admin, manager (changed: managers allowed)
`{ "status": "CONFIRMED" | "PACKED" | "CANCELLED", "note"?: "≤500" }` → `{ order }`. `ASSIGNED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED` → 403 (rider-controlled). Invalid transition → 400. Concurrent change → 409. Admins and managers may cancel after pickup (flags manual review). Confirming auto-assigns the nearest available rider; if none, the response has `riderAssignmentPending: true`.

### `PATCH /admin/orders/:id/assign-rider` — admin, manager
`{ "riderId": "<id>" }` → `{ order }`. Only `CONFIRMED`, paid (or COD) orders; rider must be active and `available`. Errors: 400 `Rider is deactivated` / `Rider is not available` / `Cannot assign rider while order is …` / already assigned; 404 rider/order. The legacy `PATCH /orders/:id/assign-rider` still works (now also for managers).

### `PATCH /admin/orders/:id/unassign-rider` — admin, manager
No body → `{ order }`. Only while `CONFIRMED` (before the rider accepts); frees the rider. 400 otherwise, 409 on a concurrent change.

### Live order events (Socket.IO)
Namespace `/orders`, auth token in `auth.token` (or `?token=` / `Authorization: Bearer`). Admin and manager sockets join room `admin:orders` automatically on connect; `emit('joinAdminOrders')` also works (ack event `joinedAdminOrders`, or `error`). Refresh tokens are rejected.

Events (payload is a summary; refetch `GET /admin/orders/:id` for detail):
- `order:new` — a customer placed an order.
- `order:updated` — status change, rider (un)assignment, rider accept, payment success/failure.
```jsonc
{ "_id", "orderId", "orderStatus", "paymentStatus", "paymentMethod", "totalAmount", "itemCount",
  "userId", "riderId" | null, "requiresManualReview", "createdAt", "updatedAt" }
```

---

## Products and inventory

Product schema additions: `status: "draft" | "active" | "archived"` (missing = active) and `reorderLevel` (default 10). Low stock everywhere = `0 < stock ≤ reorderLevel`; out of stock = `stock ≤ 0`.
Public `GET /products` lists only active + available products; public `GET /products/:id` returns `{ product: null }` for drafts and archived products.

`POST /products` and `PUT /products/:id` (admin) accept optional `status` and `reorderLevel`. `PUT /products/:id` now changes only the fields that are sent (an omitted `isAvailable` keeps its value — the admin form must stop sending `isAvailable: true` by default) and keeps `pricing.sellingPrice`/`pricing.mrp`/`pack.unit`/`pricing.gst` in sync with `price`/`originalPrice`/`unit`/`gst`.

### `GET /admin/products` — admin, manager
| param | values |
|---|---|
| `page`, `limit`, `q` | `q` matches name, nameHi, brand, barcode, sku (contains, case-insensitive) |
| `status` | `draft` \| `active` \| `archived` (omit = all) |
| `categoryId`, `subcategoryId`, `itemGroupId` | ids |
| `stock` | `low` \| `out` |
| `needsAttention` | `true` → missing/zero price, no image, missing unit, or a unit containing 8+ digits (barcode) |
| `isAvailable` | `true` / `false` |
| `sort` | `name`, `price`, `stock`, `soldCount`, `createdAt`, `updatedAt` (prefix `-` for descending; default `-updatedAt`) |

```jsonc
{
  "products": [ {
    "_id", "name", "nameHi", "brand", "barcode", "sku",
    "categoryId": { "_id", "name" }, "subcategoryId": { "_id", "name" } | null, "itemGroupId": { "_id", "name" } | null,
    "price", "originalPrice", "pricing": { "mrp", "sellingPrice", "gst" }, "unit", "pack": { "unit", "weight" },
    "stock", "reorderLevel", "image", "images", "isAvailable", "status", "soldCount", "createdAt", "updatedAt",
    "stockState": "ok" | "low" | "out",
    "issues": [ "missing_price" | "no_image" | "missing_unit" | "unit_looks_like_barcode" ]
  } ],
  "total", "page", "limit", "totalPages"
}
```

### `GET /admin/products/counts` — admin, manager
`{ "all", "active", "draft", "archived", "needsAttention", "lowStock", "outOfStock" }` (needsAttention excludes archived; low/out count active products only).

### `GET /admin/products/:id` — admin, manager
`{ product }` — full document (any status) with the same `status`, `reorderLevel`, `stockState`, `issues` additions.

### `PATCH /admin/products/:id/status` — admin
`{ "status": "draft" | "active" | "archived" }` → `{ product }`. Archive = soft delete (hidden from the app, kept for orders).

### `POST /admin/products/bulk-status` — admin
`{ "ids": ["<id>", …1–200], "status": "archived" }` → `{ "matched", "modified" }`.

### `PATCH /admin/products/:id/reorder-level` — admin, manager
`{ "reorderLevel": 0..100000 }` → `{ product }`.

### `POST /admin/products/:id/stock-adjustments` — admin, manager
```jsonc
// request
{ "delta": -3, "reason": "restock" | "damage" | "correction" | "return" | "other", "note"?: "≤500" }
// 201
{
  "product": { "_id", "name", "stock": 9, "reorderLevel": 10, "stockState": "low" },
  "adjustment": { "_id", "productId", "delta", "previousStock", "newStock", "reason", "note", "actorId", "actorRole", "createdAt" }
}
```
`delta` is a non-zero integer (±1,000,000). Atomic; removing more than is in stock → `409 "Not enough stock to remove that many"`. 404 unknown product.
`PUT /products/:id/stock { quantity }` (legacy) still adds `quantity` and is recorded as a `restock` adjustment; managers can call it now.

### `GET /admin/products/:id/stock-adjustments` — admin, manager
`?page&limit` → `{ "adjustments": [ { …adjustment, "actorId": { "_id", "name", "role" } | null } ], total, page, limit, totalPages }`, newest first.

---

## Categories, subcategories, item groups

Category: `icon` is optional now (create and update; `""` clears it). New optional `group` and `groupHi` (≤50 chars) for home-screen grouping, settable through `POST /categories` and `PUT /categories/:id`.

All three return deactivated records only with `includeInactive=true`; never cached:

| endpoint | roles | extra query | response |
|---|---|---|---|
| `GET /admin/categories` | admin, manager | `type=category\|subcategory` (default `category`) | `{ categories: [...] }` |
| `GET /admin/subcategories` | admin, manager | `parentId` | `{ subcategories: [... parentId populated {_id,name,icon,color}] }` |
| `GET /admin/item-groups` | admin, manager | `subcategoryId` | `{ itemGroups: [... subcategoryId populated {_id,name,parentId}] }` |

Sorted by `sortOrder`, then `name`. Re-enable with the existing `PUT /categories/:id { isActive: true }` (admin) etc. Create/update/delete stay admin-only.

---

## Product scraper

Staff paste product page links; a BullMQ queue (`product-scrape`, 2 at a time) scrapes each into a preview. Images are normalised to 800px pack shots and stored in Cloudflare R2 (`catalog/scraped/<id>/…`), or inline as data URIs (max 4) when R2 is not configured. Nothing reaches the catalogue until an admin approves it.

Sources: Blinkit (embedded page state: price, MRP, unit, category path, nutrition, shelf life, veg flag, gallery), BigBasket (`__NEXT_DATA__`), and any page with schema.org JSON-LD or OpenGraph tags. Sites that block bots fail with a clear message ("The site blocked the scraper (HTTP 403)"). Set `SCRAPER_BROWSER=off` to never try a headless browser; with `auto` (default) Playwright is used only if it is installed on the server.

Status flow: `queued` → `scraping` → `ready` (to review) → `approved` | `declined`; `scraping` → `failed` → (retry) `queued`. A link that is open (anything but `declined`) is not scraped twice.

Categorisation: the source's category path and the product name are matched against the store's categories, subcategories and item groups (including item-group `tags`). The result is stored in `suggestion { categoryId, subcategoryId, itemGroupId, confidence: high|medium|low, matched[] }`; `high`/`medium` suggestions pre-fill `categoryId`/`subcategoryId`/`itemGroupId`, `low` ones are only shown. A category chosen at submit time wins over the suggestion.

| endpoint | roles | body / query | response |
|---|---|---|---|
| `GET /admin/scraper/status` | admin, manager | | `{ r2Configured, browser, maxImages }` |
| `GET /admin/scraper/counts` | admin, manager | | `{ ready, in_progress, failed, approved, declined, all }` |
| `GET /admin/scraper/items` | admin, manager | `?status=ready\|in_progress\|failed\|approved\|declined&q&batchId&page&limit` | `{ items: [... images: [cover only], imageCount], total, page, limit, totalPages }` |
| `GET /admin/scraper/items/:id` | admin, manager | | `{ item }` |
| `POST /admin/scraper/items` | admin | `{ urls: string[] (1-100), categoryId?, subcategoryId?, itemGroupId? }` | `{ batchId, queued, skipped: [{ url, reason }] }` |
| `PATCH /admin/scraper/items/:id` | admin | `{ name?, brand?, description?, highlights?, price?, mrp?, unit?, barcode?, stock?, categoryId?, subcategoryId?, itemGroupId? (null clears), imageUrls? (kept images, in order) }` | `{ item }`; only while `ready`; removed images are deleted from R2 |
| `POST /admin/scraper/items/:id/approve` | admin | same edits + `publishAs: "active" (default) \| "draft"` | `{ item, product }`; needs name, price > 0, unit and category; 409 if already reviewed |
| `POST /admin/scraper/items/:id/decline` | admin | `{ reason? }` | `{ item }`; works on `ready` and `failed`; deletes the R2 images |
| `POST /admin/scraper/items/:id/retry` | admin | | `{ item }`; `failed` only |
| `POST /admin/scraper/items/bulk-approve` | admin | `{ ids (≤100), publishAs? }` | `{ results: [{ id, ok, message?, productId? }], approved }` |
| `POST /admin/scraper/items/bulk-decline` | admin | `{ ids (≤100), reason? }` | `{ results, declined }` |

An approved preview becomes a normal product (`images` = the R2 URLs, `pricing`, `pack.unit`, `shelfLife`, `attributes.storage/dietary`, `nutrition`). Approvals and declines are recorded in the audit log like other staff writes.

---

## Banners

Schema: `{ _id, title, titleHi, image (https), target: { type: "category" | "product" | "url", id?, url? }, sortOrder, startsAt, endsAt, isActive, createdAt, updatedAt }`.

### `GET /banners` (public)
`{ "banners": [ { "_id", "title", "titleHi", "image", "target": { "type", "id"? , "url"? }, "sortOrder", "startsAt", "endsAt" } ] }` — active, `startsAt ≤ now < endsAt` (null = open-ended), by `sortOrder`, max 20, cached 60 s.

### `GET /admin/banners` — admin, manager
`{ banners: [...] }` — all banners, by `sortOrder`.

### `POST /admin/banners` — admin
```jsonc
{
  "title": "≤120", "titleHi"?: "≤120",
  "image": "https://…",
  "target": { "type": "category", "id": "<categoryId>" }   // or product + id, or { "type": "url", "url": "https://…" }
  "sortOrder"?: 0,              // default: after the last banner
  "startsAt"?: "ISO" | null, "endsAt"?: "ISO" | null,      // endsAt must be after startsAt
  "isActive"?: true
}
```
→ `201 { banner }`.

### `PATCH /admin/banners/:id` — admin _(id checked)_
Any subset of the create fields → `{ banner }`. 404 unknown.

### `DELETE /admin/banners/:id` — admin _(id checked)_
→ `{ message: "Banner deleted" }`.

### `POST /admin/banners/reorder` — admin
`{ "ids": ["<id>", …] }` (no duplicates, all must exist) → `{ banners }` with `sortOrder` = position.

---

## Riders

Rider documents never include `password` any more (also fixed on `GET /riders`, `/riders/:id`, `/riders/me`). Existing `GET /riders`, `GET /riders/available`, `GET /riders/:id`, `POST /riders` are now open to managers.

### `GET /admin/riders` — admin, manager
Query: `status=available|busy|offline`, `isActive=true|false`.
```jsonc
{
  "riders": [ {
    "_id", "name", "username", "phone", "vehicleType", "status", "isActive", "rating", "totalDeliveries",
    "currentLocation", "lastLocationUpdate", "lastActiveAt", "createdAt", "updatedAt",
    "stats": { "deliveredCount", "cancelledCount", "activeOrderCount", "deliveredToday", "lastDeliveredAt" }
  } ],
  "summary": { "total", "active", "inactive", "available", "busy" }   // over all riders, not the filter
}
```
Stats are computed from orders. `activeOrderCount` counts `CONFIRMED`, `ASSIGNED`, `PACKED`, `PICKED_UP`, `OUT_FOR_DELIVERY`. `deliveredToday` uses the server's local day.

### `GET /admin/riders/:id` — admin, manager _(id checked)_ → `{ rider }`

### `GET /admin/riders/:id/stats` — admin, manager _(id checked)_
`{ "riderId", "deliveredCount", "cancelledCount", "activeOrderCount", "deliveredToday", "lastDeliveredAt", "activeOrders": [ { "_id", "orderId", "orderStatus", "totalAmount", "createdAt", "updatedAt" } ] }`

### `PATCH /admin/riders/:id` — admin, manager _(id checked)_
`{ "name"?: "≤100", "phone"?: "10-digit, optional +91", "vehicleType"?: "Two Wheeler" | "Bicycle" | "Electric Bike" | "Three Wheeler" | "Four Wheeler" }` → `{ rider }`. Phone is stored as `+91XXXXXXXXXX`; 409 if another rider has it; 400 for an empty body.

### `PATCH /admin/riders/:id/status` — admin, manager _(id checked)_
`{ "isActive": false }` → `{ rider }`. Deactivating sets `status: offline`, signs the rider out on every device, blocks password/OTP login and refresh, and blocks assignment. 409 if the rider has an active order.

---

## Customers

### `GET /admin/customers` — admin, manager
Query: `page`, `limit`, `q` (name, phone or email contains), `sort` = `-createdAt` (default) | `createdAt` | `name` | `-name` | `orderCount` | `-orderCount` | `totalSpent` | `-totalSpent` | `lastOrderAt` | `-lastOrderAt`.
```jsonc
{
  "customers": [ {
    "_id", "name", "phone", "email", "profilePicture", "role": "customer", "isActive", "addresses", "createdAt", "updatedAt",
    "orderCount",      // all orders
    "deliveredCount",
    "totalSpent",      // sum of totalAmount of DELIVERED orders
    "lastOrderAt"      // null if never ordered
  } ],
  "total", "page", "limit", "totalPages"
}
```

### `GET /admin/customers/:id` — admin, manager _(id checked)_
```jsonc
{
  "customer": { /* as in the list */ },
  "addresses": [ { "type", "address", "city", "pincode", "isDefault", "latitude", "longitude" } ],
  "recentOrders": [ { "_id", "orderId", "orderStatus", "paymentStatus", "paymentMethod", "totalAmount", "itemCount", "createdAt", "deliveryAddress": { "address", "city" } } ]  // latest 10
}
```
404 for unknown ids or non-customers.

---

## Analytics

Existing `daily`, `weekly`, `top-products`, `revenue-by-category` are unchanged and now open to managers.

### `GET /admin/analytics/summary` — admin, manager
Query: `from`, `to` — `YYYY-MM-DD` (store-local calendar days, inclusive) or ISO timestamps (their local date is used). Default: the last 7 days including today. Max 366 days; `from > to` → 400.
```jsonc
{
  "range": { "from": "2026-10-06", "to": "2026-10-12", "timezone": "Asia/Kolkata" },
  "revenue": 12345.5,          // Σ totalAmount of non-cancelled orders created in range
  "orders": 81,                // non-cancelled orders created in range
  "cancelledOrders": 3,
  "averageOrderValue": 152.41, // revenue / orders (0 when no orders)
  "ordersByStatus": { "PENDING": 2, "CONFIRMED": 1, "ASSIGNED": 0, "PACKED": 0, "PICKED_UP": 0, "OUT_FOR_DELIVERY": 1, "DELIVERED": 77, "CANCELLED": 3 },
  "activeProducts": 240,       // current, not range-bound
  "outOfStock": 12,            // active products, stock ≤ 0
  "lowStock": 9,               // active products, 0 < stock ≤ reorderLevel
  "newCustomers": 14,          // customers created in range
  "timeseries": [ { "date": "2026-10-06", "orders": 10, "revenue": 1520 } ]  // every day in range, zeros included
}
```
No conversion rate (not measurable).

---

## Team (staff accounts) — admin only

### `GET /admin/team`
`{ "members": [ { "_id", "name", "username", "role": "admin" | "manager", "isActive", "email", "createdAt", "updatedAt" } ] }`

### `POST /admin/team`
`{ "name": "≤100", "username": "3–50 of [A-Za-z0-9._-]", "password": "12–128 chars", "role": "admin" | "manager", "isActive"?: true, "email"?: "…" }` → `201 { member }`. 409 username taken. Passwords are bcrypt-hashed and never returned.

### `PATCH /admin/team/:id` _(id checked)_
`{ "name"?, "role"?, "isActive"?, "password"? (12–128), "email"? }` → `{ member }`.
- You cannot change your own role or deactivate yourself (400).
- The last active admin cannot be demoted or deactivated (409).
- Changing role, deactivating or resetting the password signs the member out everywhere.
- 404 for customers/riders/unknown ids.

---

## Audit log

Every successful POST/PUT/PATCH/DELETE by an admin or manager (all `/admin/**`, settings, catalogue, riders, order actions; not `/auth/**`) is written to `auditlogs`.

### `GET /admin/audit-log` — admin
Query: `page`, `limit`, `actorId`, `entity` (e.g. `products`, `orders`, `settings`, `banners`, `riders`, `team`, `categories`), `entityId`, `action` (exact, e.g. `products.status`), `from`, `to` (ISO, on `createdAt`), `q` (summary contains).
```jsonc
{
  "logs": [ {
    "_id", "actorId", "actorName": "Asha", "role": "manager",
    "action": "products.stock-adjustments",   // entity + route suffix, or entity.create|update|delete
    "entity": "products", "entityId": "<id>",
    "summary": "Asha: products.stock-adjustments <id> delta=-3, reason=damage",
    "diff": { "changes": { /* request body; secrets redacted, long values truncated */ } } | { "truncated": true, "keys": [] },
    "ip", "method": "POST", "path": "/api/v1/admin/products/<id>/stock-adjustments", "statusCode": 201,
    "createdAt"
  } ],
  "total", "page", "limit", "totalPages"
}
```
Settings changes use action `settings.update`.

---

## Indexes added

| collection | index | used by |
|---|---|---|
| products | `{status, categoryId, updatedAt:-1}`, `{status, subcategoryId, updatedAt:-1}`, `{status, updatedAt:-1}` | admin product list filters + default sort |
| products | `{status, stock}` | low/out-of-stock filters, counts, analytics |
| stockadjustments | `{productId, createdAt:-1}`, `{createdAt:-1}` | adjustment history |
| orders | `{riderId, orderStatus, updatedAt:-1}` | rider filter, rider stats, deactivation check |
| orders | `{paymentStatus, createdAt:-1}`, `{paymentMethod, createdAt:-1}`, `{requiresManualReview, createdAt:-1}` | admin order filters |
| orders (existing) | `{orderStatus, createdAt}`, `{createdAt:-1}`, `{userId, createdAt:-1}`, unique `orderId` | status/date filters, customer stats lookup, `ORD…` prefix search |
| users | `{role, createdAt:-1}` | customer list, team list, new customers |
| banners | `{isActive, startsAt, endsAt, sortOrder}`, `{sortOrder, createdAt:-1}` | public and admin banner lists |
| auditlogs | `{createdAt:-1}`, `{actorId, createdAt:-1}`, `{entity, entityId, createdAt:-1}` | audit log filters |

Text searches (`q`) on products, customers and order ids that are not `ORD…` prefixes use case-insensitive regexes, i.e. a scan bounded by the other filters; fine at the current catalogue size.

## Caching

- Product list caches are versioned: keys `products:v{V}:…` with `V = c:catalog:ver`. Any admin change to products, categories, subcategories or item groups (including status, reorder level and stock adjustments) runs `INCR c:catalog:ver` and deletes `product:{id}`. No `KEYS` anywhere (`RedisService.delPattern` now uses `SCAN` + `UNLINK` and has no callers).
- `c:banners:active` (60 s) is deleted on every banner change.
