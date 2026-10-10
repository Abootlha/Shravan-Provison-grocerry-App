# Mock API mode (dev and profiling builds only)

Runs the customer app with no backend: every REST call, the maps proxy and the
tracking socket are served from fixtures in this folder.

## Run (web)

From `customer-app/`:

```bash
# macOS / Linux / Git Bash
EXPO_PUBLIC_MOCK_API=1 npx expo start --web

# Windows cmd (no space before &&)
set EXPO_PUBLIC_MOCK_API=1&& npx expo start --web

# PowerShell
$env:EXPO_PUBLIC_MOCK_API='1'; npx expo start --web
```

If Expo fails with a react-navigation check error, also set
`EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1` (pre-existing issue, unrelated).
Restart with `--clear` after toggling the variable, because `EXPO_PUBLIC_*`
values are inlined at bundle time.

Log in with any 10-digit phone and any 4-digit OTP (e.g. `1234`). The browser
console shows a purple `[mock api] ENABLED` banner and one line per request.

## Profiling release builds (`EXPO_PUBLIC_PERF_MOCK=1`)

Debug builds are too slow to profile, but a release build normally has no data
without a backend. For performance work only, set `EXPO_PUBLIC_PERF_MOCK=1` when
building a release variant; the mock adapter and mock socket are then installed even
though `__DEV__` is false (per-request logging stays off).

```powershell
# PowerShell, from customer-app/ (emulator running)
$env:EXPO_PUBLIC_PERF_MOCK='1'; $env:EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK='1'
npx expo run:android --variant release
Remove-Item Env:EXPO_PUBLIC_PERF_MOCK   # before any other build
```

Windows: if the release build fails with ninja `manifest 'build.ninja' still dirty after 100 tries`,
CMake paths under `node_modules/**/.cxx/RelWithDebInfo` are over MAX_PATH. Enable long paths, or run
`android/gradlew app:assembleRelease -PreactNativeArchitectures=x86_64 --init-script short-cxx.gradle`
with an init script that sets
`android.externalNativeBuild.cmake.buildStagingDirectory = new File("C:/cx/${p.name}")` for every
project (in `allprojects { afterEvaluate { p -> ... } }`), then `adb install` the APK.

Production builds (EAS profiles, CI) must never set it. The variable is inlined at
bundle time, so without it the guard folds to `false` and Metro drops `mocks/`.
Check after touching the guard:

```bash
npx expo export --platform android --output-dir <tmp-dir-outside-repo>
grep -rl "Aashirvaad Shudh Chakki" <tmp-dir-outside-repo>   # must print nothing
```

Keep the guard written inline at each call site (`services/api.js`,
`services/socketService.js`); moving it into a shared helper stops Metro from
removing the `require('../mocks')`.

## What is mocked

- **Wiring:** `services/api.js` sets a mock axios adapter on every client and on
  bare `axios`. It also patches `fetch()` for URLs under `API_BASE_URL`, which
  covers the `/maps/*` proxy in `services/locationService.js`.
  `services/socketService.js` swaps `io()` for `mocks/mockSocket.js`.
  Both are behind `(__DEV__ && process.env.EXPO_PUBLIC_MOCK_API === '1') ||
  process.env.EXPO_PUBLIC_PERF_MOCK === '1'` with a `require` inside the branch, so
  production bundles never include `mocks/`.
- **Latency:** each response waits a random 250-500 ms, so loading and skeleton
  states are visible.
- **Endpoints:** `auth/*`, `users/me`, `users/addresses[/:i]`,
  `settings/store`, `settings/check-serviceability`, `categories[/nested|/:id|/:id/subcategories]`,
  `subcategories`, `item-groups`, `brands`, `products` (with `categoryId`, `subcategoryId`,
  `itemGroupId`, `search`, `page` and `limit`), `products/:id`, `products/barcode/:code`,
  `cart/*`, `orders` (create and list), `orders/user/:id`, `orders/:id`,
  `orders/:id/status`, `orders/:id/history`, `payments/seamless-hash` and
  `maps/search|geocode|reverse-geocode`. Mock-only extra: `GET /banners`.
  Response shapes mirror the Nest controllers. Only `/payments/*` uses
  `{ success, data }`.
- **Orders:** 5 seeded orders: one `OUT_FOR_DELIVERY` with a moving rider
  (ETA about 8 min, loops every 60 s), one `CONFIRMED`, two `DELIVERED` and one
  `CANCELLED`. Placed orders move through CONFIRMED, then PACKED (12 s), then
  OUT_FOR_DELIVERY (24 s), then DELIVERED.
- **Payments (web):** the PayU form post is intercepted and redirected to
  `/?payment=success&orderId=...`. The first `GET /orders/:id` poll returns
  `PENDING` and the second returns `COMPLETED`. Native WebView payments are not
  intercepted.
- **Rider-only and admin-only endpoints** return 403, as on the real backend.
  This includes `GET /orders/current` and `PATCH /orders/:id/status`
  (customers can't cancel).

On web, profile edits, addresses, placed orders and cart are saved in
`localStorage` (`shravan.mockApi.v1`). Clear that key to reset.

## Pack shot credits

Mock product images live in `mocks/packshots/*.webp`. Each is a transparent cut-out
(background removed with [rembg](https://github.com/danielgatis/rembg), MIT), trimmed,
centred on a 480×480 square with a 6% margin and saved as WebP. `fixtures/catalog.js`
maps product names to them (`PACKSHOTS`) and resolves each to a URI with
`expo-asset`. Like the rest of `mocks/`, they are only bundled in mock-mode dev builds.

**Licences**

- Images from **Open Food Facts** / **Open Beauty Facts** are © their contributors,
  licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The cut-outs
  are adaptations and are shared under the same licence. Source: the product's "front"
  photo; the product page is linked below.
- Images from **Unsplash** are under the [Unsplash Licence](https://unsplash.com/license)
  (free to modify, attribution appreciated).
- The brand names and pack designs are their owners' trademarks. They are used only as
  realistic dev fixtures and must not ship in a production catalogue.

To add one, take a front photo, cut it out with `rembg i in.jpg out.png` (or the
backend's `local` provider), normalise it the same way, then add a row below.

| File | Source | Licence | Link |
|---|---|---|---|
| aashirvaadAtta | Open Food Facts, product 8901725121129 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901725121129 |
| alooBhujia | Open Food Facts, product 8904004400694 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8904004400694 |
| amulButter | Open Food Facts, product 8901262010016 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901262010016 |
| amulDahi | Open Food Facts, product 3948262211062 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/3948262211062 |
| amulGhee | Open Food Facts, product 0656846560460 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/0656846560460 |
| amulPaneer | Open Food Facts, product 7613404145067 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/7613404145067 |
| amulTaaza | Open Food Facts, product 8901262260121 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901262260121 |
| apple | Unsplash photo 1560806887-1e4cd0b6cbd6 | Unsplash Licence | https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6 |
| banana | Unsplash photo 1571771894821-ce9b6c11b08e | Unsplash Licence | https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e |
| besan | Open Food Facts, product 8901725121754 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901725121754 |
| britanniaBread | Unsplash photo 1509440159596-0249088772ff | Unsplash Licence | https://images.unsplash.com/photo-1509440159596-0249088772ff |
| bru | Open Food Facts, product 0068400564553 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/0068400564553 |
| cerelac | Open Food Facts, product 6260418702420 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/6260418702420 |
| coke | Open Food Facts, product 3948764012273 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/3948764012273 |
| colgate | Open Food Facts, product 6281001112013 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/6281001112013 |
| coriander | Unsplash photo 1709482107035-9ac8a2fb2ac9 | Unsplash Licence | https://images.unsplash.com/photo-1709482107035-9ac8a2fb2ac9 |
| dove | Open Food Facts, product 0011111404724 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/0011111404724 |
| eggs | Unsplash photo 1582722872445-44dc5f7e3c8f | Unsplash Licence | https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f |
| everestGaram | Open Food Facts, product 8901786101009 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901786101009 |
| fortuneAtta | Open Food Facts, product 8906000210291 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8906000210291 |
| fortuneRice | Open Food Facts, product 8906007287883 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8906007287883 |
| fortuneSunlite | Open Food Facts, product 8906007280280 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8906007280280 |
| goodDay | Open Food Facts, product 8901063092433 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901063092433 |
| greenChilli | Unsplash photo 1599987141071-f5810d32e21a | Unsplash Licence | https://images.unsplash.com/photo-1599987141071-f5810d32e21a |
| haldiramMoong | Open Food Facts, product 8904004403718 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8904004403718 |
| harpic | Open Food Facts, product 8901396173595 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901396173595 |
| harvestGold | Open Food Facts, product 8906020460010 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8906020460010 |
| indiaGate | Open Food Facts, product 0690225301244 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/0690225301244 |
| kissan | Open Food Facts, product 8901030897542 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901030897542 |
| lays | Open Food Facts, product 06231512 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/06231512 |
| lizol | Open Food Facts, product 8901396126027 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901396126027 |
| maggi | Open Food Facts, product 8901058851304 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901058851304 |
| mango | Unsplash photo 1553279768-865429fa0078 | Unsplash Licence | https://images.unsplash.com/photo-1553279768-865429fa0078 |
| marieGold | Open Food Facts, product 8901063023949 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901063023949 |
| mdhDeggi | Open Food Facts, product 6291103750143 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/6291103750143 |
| moongDal | Open Food Facts, product 8904004403800 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8904004403800 |
| motherDairy | Unsplash photo 1563636619-e9143da7973b | Unsplash Licence | https://images.unsplash.com/photo-1563636619-e9143da7973b |
| mustardOil | Open Food Facts, product 4906400009444 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/4906400009444 |
| nescafe | Open Food Facts, product 7891000255063 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/7891000255063 |
| okra | Unsplash photo 1425543103986-22abb7d7e8d2 | Unsplash Licence | https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2 |
| onion | Unsplash photo 1618512496248-a07fe83aa8cb | Unsplash Licence | https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb |
| pampersPants | Open Beauty Facts, product 8006540069448 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/8006540069448 |
| pampersWipes | Open Beauty Facts, product 8006530116305 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/8006530116305 |
| paperBoat | Open Food Facts, product 8906080600357 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8906080600357 |
| parleG | Open Food Facts, product 8901719101038 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901719101038 |
| patanjaliGhee | Open Food Facts, product 0634654802354 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/0634654802354 |
| potato | Unsplash photo 1518977676601-b53f82aba655 | Unsplash Licence | https://images.unsplash.com/photo-1518977676601-b53f82aba655 |
| realJuice | Open Food Facts, product 3020640007600 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/3020640007600 |
| redLabel | Open Food Facts, product 8901030882579 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901030882579 |
| saffolaGold | Open Food Facts, product 8901088155458 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901088155458 |
| shampoo | Open Beauty Facts, product 4084500015012 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/4084500015012 |
| surfMatic | Open Beauty Facts, product 8906189771965 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/8906189771965 |
| surfPowder | Open Beauty Facts, product 8941102310159 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/8941102310159 |
| tataSalt | Open Food Facts, product 14018808 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/14018808 |
| tataTea | Open Food Facts, product 8901052004034 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901052004034 |
| thumsUp | Open Food Facts, product 8901764042911 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8901764042911 |
| tomato | Unsplash photo 1592924357228-91a4daadcfea | Unsplash Licence | https://images.unsplash.com/photo-1592924357228-91a4daadcfea |
| toorDal | Open Food Facts, product 8904064662124 | CC-BY-SA 3.0 | https://world.openfoodfacts.org/product/8904064662124 |
| vimBar | Unsplash photo 1607006344152-62699f97b42c | Unsplash Licence | https://images.unsplash.com/photo-1607006344152-62699f97b42c |
| vimGel | Open Beauty Facts, product 8901030760624 | CC-BY-SA 3.0 | https://world.openbeautyfacts.org/product/8901030760624 |
