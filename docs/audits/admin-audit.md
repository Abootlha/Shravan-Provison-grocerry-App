# Admin panel audit

Scope: every page and component in `admin/`, tested against the dev backend (copy of the real catalogue). Read-only.

## Inventory
- Astro 5.16.6, React 19.2.3, Tailwind 4.1.18 (`@tailwindcss/vite`), no `@theme`, no `components.json`, no `@/*` alias.
- 14 pages: dashboard, products, categories, subcategories, item-groups, inventory, orders (live/completed/returns), riders, delivery, analytics, settings, login; pricing + customers are "coming soon" with hard-coded numbers.
- Largest components: ProductsManager 1741 lines, OrderTrackingManager 879, SubcategoriesManager 761, OrdersManager 720, RiderManager 619, CategoriesManager 590.
- `AdminLayout.astro` (735 lines) = vanilla-JS sidebar, header and auth guard.
- Dead code: LoginForm.tsx, Welcome.astro, Layout.astro, react/OrderDetail.tsx, react/RiderAssigner.tsx, ui/Breadcrumb.tsx; OrderTrackingManager/RiderTrackingMap only used in a test (tracking map unreachable).
- `ui/` is shadcn-like but not shadcn (hard-coded colours, homemade Tabs without ARIA, hand-drawn SVG chart). Radix packages installed but unused.
- No data cache; 26 `alert()`/`confirm()` calls; no toasts.
- Theme: dark-only amber/near-black with glow, orbs, grid background, `!important` overrides — conflicts with `docs/design/DESIGN.md`.

## Top problems
1. **Fake data shown as real (P0)** — Dashboard falls back to invented KPIs (₹164,320, 68 orders, 248 products…) when values are 0; Settings "Save" is a `setTimeout` that saves nothing.
2. **Dead controls** — `?action=add/import`, `/inventory?filter=low`, header search, ⌘K, notification bell, sidebar logout, Weekly/Monthly toggles.
3. **Missing core operations** — no rider assignment or tracking map in Orders; "Returns" = cancelled orders; no product archive; no rider edit/deactivate; read-only inventory with hard-coded reorder level.
4. **Accessibility** — modals without dialog semantics/Esc/focus trap; unlabeled inputs; hover-only actions; muted text fails AA contrast; no skip link.
5. **Responsive** — Products 951px wide on a 390px screen; Item Groups renders 115 cards (6,905px tall) without pagination.

## Bugs
| Sev | Bug | Where |
|---|---|---|
| P0 | Fake KPI fallbacks | `Dashboard.tsx` ~160–230 |
| P0 | Settings save is simulated | `SettingsManager.tsx:46` |
| P1 | Deactivated category disappears from admin permanently | `CategoriesManager.tsx:138`, `categories.service.ts:25` |
| P1 | Pending count reads `PLACED`; backend uses `PENDING` | `Dashboard.tsx:104` |
| P1 | Product save forces `isAvailable: true` | `ProductsManager.tsx:~316` |
| P1 | CSV import treats subcategory/item-group names as IDs | `productCsv.ts:112-113` |
| P1 | Category icon required by backend but missing in form | `CategoriesManager.tsx:103` |
| P1 | Any 403 logs the user out | `api.ts:~201` |
| P1 | Returns page race between two queries | `OrdersManager.tsx:71-88` |
| P2 | Two `/auth/refresh` calls per page load | `AdminLayout.astro:145`, `api.ts` |
| P2 | Product validation via chained `alert()`s; raw JSON errors | `ProductsManager.tsx:276-330` |
| P2 | Products re-fetches everything on every page change | `ProductsManager.tsx:132` |
| P2 | Rider stats from filtered list; wrong empty text | `RiderManager.tsx:126` |
| P2 | Order search only filters the current page | `OrdersManager.tsx:201` |
| P2 | Inconsistent low-stock threshold (<10 vs ≤10) | Products / Inventory |
| P2 | White-on-white Weekly button | `global.css:565+` |
| P2 | Silent delivery-settings failures; radius 0 can't be saved; hard-coded fallback location | `DeliveryManager.tsx:45-150` |
| P2 | Modal overlay under sticky header | layout |
| P2 | No refresh/polling for new orders | — |

## Fake / hard-coded data
- Dashboard: weekly revenue, category sales, order-status donut, deltas, "Across 12 categories", "LIVE".
- Analytics: deltas, conversion 68.5%, category performance.
- Real endpoints available: `/admin/analytics/daily|weekly|top-products`, `/admin/analytics/revenue-by-category` (unused). Missing: active products, out of stock, conversion.
- Settings placeholders (email, phone, address, GSTIN, fees); real values belong in `/settings/store`.
- Pricing/Customers stat tiles; header user "Admin User / Store Manager".
- Data issue: product "Priyagold" unit = "8047675773 G" (barcode in unit field).

## Missing features
Banners manager; fees/contact/timezone settings; category groups; product drafts / "Needs attention"; order filters (date, payment, rider) + working search; order detail with timeline + rider assignment; live tracking map; new-order alerts; variants UI; stock adjustments with reasons; bulk actions; product archive; rider edit/deactivate + payouts; customer list; audit log; roles/permissions; CSV export.

## Migration plan — shadcn/ui + beUI
Setup:
1. `admin/tsconfig.json`: `"baseUrl": "."`, `"paths": {"@/*": ["./src/*"]}`.
2. `npx shadcn@latest init` (CSS `src/styles/global.css`, `cn` in `src/lib/utils`).
3. `npx shadcn@latest add sidebar breadcrumb button input label textarea select checkbox switch dialog sheet alert-dialog dropdown-menu popover command tabs table badge card skeleton sonner form calendar chart tooltip separator scroll-area pagination avatar`
4. `npm i @tanstack/react-table @tanstack/react-query react-hook-form zod @hookform/resolvers`
5. beUI (sparingly): `npx shadcn@latest add @beui/animated-number @beui/animated-toast-stack @beui/date-range-picker`

Theme: shadcn `:root`/`.dark` tokens from DESIGN.md (primary #6C3CF4 / dark #7754F5, neutral canvas, success #0C831F, destructive #C62828, radius 10–12px, Plus Jakarta Sans, tabular numbers); light/dark toggle; remove glow, orbs, grid, `!important` overrides.

Mapping: Sidebar (+ Sheet on mobile), Command palette, DataTable (TanStack, server pagination, filters, bulk selection) for every table/grid, Dialog/Sheet, AlertDialog for destructive actions, Form + react-hook-form + zod, product editor as full-page Tabs, Sonner instead of `alert()`, shadcn Chart, date-range filters. Motion only for KPI numbers, toasts and the date picker; respect reduced motion.

Phases:
0. Remove fake data + fake Settings save; fix P1s.
1. Tokens, shell (Sidebar, Command, Sonner), shared React Query client (module singleton across Astro islands).
2. Orders (DataTable, detail Sheet, rider assignment, tracking map).
3. Products + Inventory.
4. Categories / subcategories / item groups.
5. Settings (fees, banners).
6. Analytics.
7. Riders, customers, roles, audit log.
