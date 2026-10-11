# Data architecture — MongoDB, Redis, HTTP caching, client cache

Source of truth for how data is stored, cached and fetched. Implementation is phased (B1 → B2 → C → A, see §6).

## 1. MongoDB

### Current problems
- Two text indexes declared on `products` (`@Prop({text:true})` on `name` and `index({name:'text',brand:'text'})`); MongoDB allows one, so one silently fails.
- `categoryId` / `parentId` stored as both ObjectId and string → queries use `$or:[ObjectId, string]` and miss indexes.
- Two subcategory sources of truth (`subcategories` collection vs `Category{type:'subcategory'}`); `SubcategoriesService.findAll` ignores `isActive`; base64 images stored in Mongo.
- Ambiguous pricing (`price`, `pricing.sellingPrice`, default variant); `pre('save')` sync doesn't run on `findByIdAndUpdate`; cart/order use `product.price ?? 0` → products without a price sell at ₹0.
- Variant stock never reserved (only top-level `stock`).
- Fees hard-coded in two places (`orders.service.ts` and `customer-app/screens/checkout/bill.js`).
- `StoreSettings` placeholder defaults (`contactPhone:'+919876543210'`).
- Addresses identified by array index; flat lat/lng.
- Rider fields duplicated on `User` with a `currentLocation` 2dsphere index defaulting to `[0,0]`.
- Unbounded `Cart.items`.

### Schema changes
1. One hierarchy: `Category` → `Subcategory` → `ItemGroup`. Migrate `Category{type:'subcategory'}` into `subcategories`; drop `type/parentId/level` from Category.
2. Product: required `pricing.{mrp,sellingPrice}` (min 0.01), `pack.unit`, ≥1 HTTPS image (DTO + `pre('validate')`). `price/originalPrice/unit/image` become read-only virtuals. `status: 'draft'|'active'|'archived'` (soft delete; public API returns only `active`; incomplete products become `draft`).
3. Variant stock: if variants exist, stock lives only in variants; reserve via positional `$inc` with `$gte` guard.
4. `OrderItem` snapshots `sku, unit, mrp, image` at order time.
5. `StoreSettings`: `fees:{deliveryFee, freeDeliveryThreshold, packagingFee, discountRate}`, `timezone:'Asia/Kolkata'`, `catalogVersion`; no placeholder defaults (`contactPhone` required, set in admin).
6. Addresses: subdocument `_id` + `location: Point`; routes `/users/addresses/:addressId`.
7. Remove rider fields + 2dsphere from `User` (riders live in `riders`).
8. Cart: max 50 lines; per-item `sku`; price snapshot only for "price changed" UI.
9. New `banners` collection: `{title, titleHi, image, target:{type:'category'|'product'|'url', id}, sortOrder, startsAt, endsAt, isActive}`.
10. `backend/scripts/migrate-catalog-v2.ts` (dry-run default): cast ids, move/null base64 images (→ draft), backfill `status`, report drafts. `mongodump` first.

### Indexes
```ts
// products (drop existing text indexes first)
ProductSchema.index({ name:'text', nameHi:'text', brand:'text', tags:'text' },
  { weights:{ name:10, nameHi:8, brand:5, tags:2 }, default_language:'none', name:'product_search' });
ProductSchema.index({ status:1, categoryId:1, soldCount:-1, _id:1 });
ProductSchema.index({ status:1, subcategoryId:1, soldCount:-1, _id:1 });
ProductSchema.index({ status:1, itemGroupId:1, soldCount:-1, _id:1 });
ProductSchema.index({ status:1, soldCount:-1, _id:1 });
ProductSchema.index({ updatedAt:1 });
ProductSchema.index({ 'variants.sku':1 }, { unique:true, sparse:true });
// orders
OrderSchema.index({ riderId:1, orderStatus:1, updatedAt:-1 });
OrderSchema.index({ paymentStatus:1, createdAt:-1 });
// users
UserSchema.index({ role:1, isActive:1 });
UserSchema.index({ 'addresses.location':'2dsphere' }, { sparse:true });
// brands / banners
BrandSchema.index({ isActive:1, sortOrder:1 });
BannerSchema.index({ isActive:1, startsAt:1, endsAt:1, sortOrder:1 });
```
Production: `autoIndex:false`; indexes built by `scripts/sync-indexes.ts`.

## 2. Redis

### Namespaces (environments separated by `REDIS_DB`)
- `sess:` sessions/OTP (existing `refresh:*`, `auth:*`, `otp_*` names kept so live sessions survive).
- `c:` disposable cache — every key has a TTL.
- `rl:` rate limits. `bull:` BullMQ.

### Versioned invalidation
`V = INCR c:catalog:ver` (mirrored to `storesettings.catalogVersion`). Every admin create/update/archive of catalogue entities calls `catalog.bump()` → INCR + socket `catalog:changed {version}`. Old keys simply expire — no `KEYS`/`SCAN`.
Stock changes don't bump V: list caches hold ids + catalogue fields; stock is merged at read time with one `_id $in` query; `c:prod:{id}` deleted on stock change.

| Key | TTL | Pattern |
|---|---|---|
| `c:cat:v{V}:tree` | 24h | cache-aside + version |
| `c:prod:v{V}:list:{scope}:{id}:{cursor}:{limit}` | 15m | cache-aside + version |
| `c:prod:v{V}:search:{sha1(q)}:{cursor}` | 5m | cache-aside + version |
| `c:prod:{id}` | 10m | cache-aside, DEL on write |
| `c:settings:store`, `c:banners:v{V}` | 1h | write-through |
| cart | — | not cached (single indexed read) |

Stampede protection: `getOrSet(key, ttl, loader)` with `SET c:lock:{key} NX PX 3000`, short waits, DB fallback, ±10% TTL jitter, in-process promise de-dupe.

### Memory (1 GB VPS)
Recommended: a second `redis-server` on :6380 for cache only (`maxmemory 64mb`, `allkeys-lru`, no persistence) via `REDIS_CACHE_URL`; main instance keeps `noeviction` + AOF for sessions/BullMQ (`maxmemory 128mb`). Throttler storage moves to Redis (`rl:`), search limited to 30/min/IP.

### BullMQ
Existing queues plus `catalog-maintenance` (nightly) and `cart-cleanup` (daily); `removeOnComplete:{count:100}`, `removeOnFail:{count:500}`.

## 3. HTTP caching contract
- `GET /catalog/version` → `{version, settingsUpdatedAt}`, `no-cache`.
- Catalogue reads: `ETag: W/"c{V}-{hash(query)}"`, 304 on match without DB access, `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- Product detail: ETag from `updatedAt` + stock hash, `max-age=0, must-revalidate`.
- Settings: `max-age=300` + ETag. Personal data: `private, no-store`.
- Cursor pagination for products/orders (`?cursor&limit=20` → `{items, nextCursor}`); search `limit≤50` by text score; admin keeps page/total.

## 4. Client cache (customer app; rider/admin follow)
TanStack Query v5 + AsyncStorage persister (no native rebuild; 7-day maxAge; buster = app version; persist only `meta.persist` queries).

| Query key | staleTime | gcTime |
|---|---|---|
| `['catalog','version']` | 0 | 1d |
| `['categories','tree']` | ∞ (version-driven) | 7d |
| `['products','list',scope,id]` (infinite) | 10m | 1d |
| `['products','detail',id]` | 60s | 1d |
| `['search',q]` | 2m | 30m |
| `['settings','store']`, `['banners']` | 10m | 7d |
| `['cart']` | 0 | 7d |
| `['orders','list']` | 30s | 1d |
| `['orders','detail',id]` | ∞ while active (socket-fed) | 1d |
| `['me']`, `['addresses']` | 5m | 7d |

- `useCatalogVersion` on foreground + `catalog:changed` → invalidate categories/products/banners.
- Tracking socket events write into `['orders','detail',id]`.
- Prefetch category products and PDP; PDP `initialData` from list cache.
- Server cart is the source of truth: optimistic mutations, 300 ms debounce, offline queue (NetInfo + `resumePausedMutations`), guest cart merged on login (`POST /cart/merge`).
- Offline: cached catalogue + "offline, prices may change" bar; checkout disabled.
- Images: `expo-image` `cachePolicy="memory-disk"`, `recyclingKey`, prefetch first rail.
- Redux keeps only auth/session, language, location, wishlist ids, UI prefs.

## 5. No-fake-data policy
- Public catalogue returns only valid `active` records; client `normalizeProduct` returns `null` for incomplete records (logged), never "fills in".
- Remove `constants/data.js` catalogue/banners; `CATEGORY_GROUPS` → `Category.group` set in admin.
- Banners from `GET /banners` (carousel hidden when empty).
- Bill from `settings.fees` + server `POST /orders/quote` (pay amount comes from the quote).
- ETA from settings / `GET /settings/eta`; open/closed computed server-side from `storeTimings` + timezone.
- No wallet option until a wallet exists; no ratings without real reviews.
- Every list has an honest empty state; mock mode stays dev-only (CI check).
- Admin: `BannersManager`, fees/contact/timezone in settings, category groups, product "Needs attention" (drafts).

## 6. Phases
- **B1 backend data:** schemas, banners module, migration + index sync scripts, fees from settings, `POST /orders/quote`, variant stock, order snapshots. Verify: quote == order totals, dry-run report, `explain()` IXSCAN.
- **B2 Redis + HTTP:** `getOrSet`, cache client, remove `KEYS`, catalog version service, ETag interceptor, cursor pagination, `catalog:changed`, Redis throttler, docs. Verify: TTLs on `c:*`, 304s, admin edit visible after foreground.
- **C customer app:** TanStack Query + persister, query hooks, screen-by-screen migration (Home → Category → PDP → Search → Orders → Checkout), server cart + merge, remove fake data, image caching. Verify: airplane-mode launch, offline cart replay, 304s.
- **A admin + rider:** shared QueryClient, BannersManager, settings fees, product drafts, rider hooks.
