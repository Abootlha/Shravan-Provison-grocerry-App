# ShravanKirana UI kit

The design-system foundation for the customer app. **Every screen is built only from what's in this folder,
`constants/theme.js` and `theme/motion.js`.** If you need something that isn't here, compose it from these
primitives. Don't hand-roll colours, font sizes, shadows or animation timings.

```js
import { Screen, Text, Headline, Button, Card, AddToCartButton, PriceTag, toast } from '../components/ui';
import { useTheme, makeStyles, layout, springs, press } from '../theme';          // runtime theme + motion
import { type, space, radii, z } from '../constants/theme';                      // static (mode-independent) tokens
```

> **Source of truth: [`docs/design/DESIGN.md`](../../../docs/design/DESIGN.md).** It supersedes the colour and
> decoration parts of `redesign-research.md` Part C (layout, anatomy and motion choices there still stand). Where this
> file and DESIGN.md disagree, DESIGN.md wins.

> **Both themes are first-class.** Light and dark switch at runtime — System by default, with a user override
> (System / Light / Dark). Colours and shadows come from `useTheme()` / `makeStyles`, never from a static import.
> **Converting a screen? Read [§9 Migration guide](#9-migration-guide--static-colours--runtime-theme).**

Live playground (dev only): `screens/DesignSystemScreen.js`.
- Web: the mock dev server (`node customer-app/mocks/start-web.js`, port 8097), then open `http://localhost:8097/?ds`.
- Device: `navigation.navigate('DesignSystem')`.

---

## 0. Tokens and roles (light / dark)

**The idea in one line:** a calm neutral frame, colour from the products (packshots, produce), and **one brand colour —
violet — only where the user acts.** Green means savings. Red means error. Nothing else is coloured.

| Role | Token(s) | Light | Dark | Use — and nothing else |
|---|---|---|---|---|
| Canvas | `canvas` | `#F5F5F3` | `#0F0F0F` | App background. Warm neutral, never lavender. Flat (no wash). |
| Surface | `surface` · `surfaceRaised` | `#FFFFFF` · `#FFFFFF` | `#1A1A1A` · `#232323` | Cards, sheets, header, dock. |
| Sunken / image well | `surfaceSunken` · `imageWell` | `#F2F2F0` | `#202020` | Product image wells, inputs, skeleton bones. |
| Ink | `ink` · `inkStrong` | `#151515` | `#F2F2F2` | Headings, prices. 16.7:1 canvas / 15.6:1 dark surface. |
| Ink secondary | `inkSecondary` | `#555555` | `#B3B3B3` | Body. 6.8:1 / 8.3:1. |
| Ink muted | `inkMuted` | `#6B6B6B` | `#8F8F8F` | Meta. The floor: 4.9:1 canvas, 4.75:1 well / 5.4:1 surface, 4.9:1 raised. |
| Hairline | `hairline` · `border` · `borderStrong` | `#E6E6E3` · `#DADAD6` · `#C4C4BF` | white 8% · 12% · 20% | Card borders, dividers. |
| **Brand violet** | `brand` (fill) · `brandText` (text/icon) | `#6C3CF4` · `#6C3CF4` | `#7754F5` · `#A68BFF` | Primary button, ADD/stepper, active tab, links, selected state, focus ring. **Nothing else.** White on fill 5.85 / 4.8. |
| Brand pressed | `brandStrong` | `#5A2BE0` | `#C4B2FF` (ink on tint) | Pressed fill; violet ink on the brand tint (6.4 / 7.9). |
| **Brand tint — the ONE tint** | `brandTint` | `#F1ECFE` | violet 16% | Selected chip / row / dock indicator background **only**. |
| Savings green | `success` · `successInk` · `successTint` · `offer` | `#0C831F` · `#0A6B1A` · `#E8F5EA` | `#4CC26A` · `#4CC26A` · green 14% | Discount amounts, "You saved", FREE delivery, veg mark, discount badge. White on `#0C831F` 4.9. |
| Error | `error` · `errorInk` · `errorTint` | `#C62828` | fill `#C62828` · ink `#FF8A80` | Errors, destructive. 5.6:1. |
| Floating dark surface | `surfaceNight` | `#151515` (ink) | `#232323` (raised) + hairline | Cart pill, toasts. Never indigo. |
| Inverse | `surfaceInverse` / `inkInverse` | `#151515` / white | `#F2F2F2` / `#1A1A1A` | Map pins, ink count bubbles. |
| Overlays | `scrim` · `scrimLight` · `onImageScrim` · `pressOverlay` | black 50 · 24 · 36 · 5% | black 64 · 40 · 48 · white 6% | |

### What happened to the old tokens (keys kept so nothing crashes)
| Old role | Now |
|---|---|
| `night[*]`, `surfaceNight`, `onNight*` (indigo) | Neutral ink greys: `night[900]` = `#151515`; `surfaceNight` = `#151515` light / `#232323` dark. |
| `lavender[*]` washes | Neutrals: 25 `#FAFAF9` · 50 `#F5F5F3` · 100 `#F2F2F0` · 200 `#E6E6E3` · 300 `#D6D6D2`. The selected tint is `brandTint`. |
| `gold`, `goldTint`, `goldInk`, `goldStrong`, `onGold`, `goldScale`, `yellow` | **Savings green** (`#0C831F` / `#E8F5EA` / `#0A6B1A`, white on fill). Nothing gold is visible. |
| `offer` / `offerInk` / `rating` | Savings green. |
| `tint.*` / `tileInk.*` (peach, sky, rose, mint, lilac, violet, gold, green, yellow) | **All** = the neutral image well + ink. `tileTint(i)` returns the same neutral for every index. |
| `HEADER_THEMES.default/fresh/dairy/snacks/festive` | **All** = the plain surface header (white / `#1A1A1A`, ink, hairline). No per-category re-tint. |
| `HEADER_THEMES.brand` / `night` | Flat brand violet / flat ink with white ink — kept only so auth & legacy screens stay legible until the screen pass moves them to white. |
| `imageWellGlow`, `WellLight` | Transparent / renders nothing. |
| `highlight`, `highlightOnBrand`, `highlightTop*` | Transparent / zero-width. No lit edges. |
| `glassFill`, `glassSolid`, … | Solid surface (`#FFF` / `#1A1A1A`); `*Night` = ink / raised. |
| `info` (blue) | Neutral `#3D3D3D` / `#B3B3B3`. No blue. |
| `violet.alt` | = `#6C3CF4` (was the light end of the brand gradient). |

### Gradients — none, except the scrim
Every key of `gradients` / `darkGradients` still exists so `<LinearGradient colors={…}>` calls don't crash, but each one
is **flat** (all stops identical): `header` → surface · `hero` → ink `#151515` (dark `#232323`) · `heroViolet` / `brand` /
`brandDeep` / `progress` → brand violet · `night` → ink · `gold` / `freeDelivery` → savings green · `glow` / `glowGold` →
transparent · `canvasWash` → canvas. The **only** real gradient is `gradients.scrim` (`transparent → black 40%`), for text
sitting on photography.

### Dose caps (DESIGN.md)
| Thing | Cap |
|---|---|
| Brand violet | Where the user acts: primary button, ADD/stepper, active tab, links, selected state, focus ring. One primary CTA per view. |
| Brand tint `#F1ECFE` | Selected chip / row / dock indicator only. |
| Gradients | **0**, except `gradients.scrim` under text on a photo. |
| Glass / blur | **Max 2 uses**: round buttons floating over photos or maps (`IconButton variant="glass" allowBlur`, `GlassSurface allowBlur`). Everything else solid. |
| Glow | **0.** (`shadows.glow` is an empty style.) |
| Shadow | **One level** — `shadows.floating` (`0 4 16 rgba(0,0,0,.08)` light; black 40% + hairline dark) — only for things that float above content: dock, cart pill, active-order bar, sheets, toasts, map controls. Cards are flat + hairline. `shadows.sm` = none; `md` / `lg` = floating. |
| Mixed-weight `Headline` / `Em` | **Max 1 per screen** — the Home hero line and the tracking ETA. |
| Bricolage (display face) | `hero` / `display` / `h1` only — the 2–3 largest headings per screen. |
| Mascot | Empty / error / unserviceable states only. Static, single entrance. |
| 3D icons | Only to identify a category (tabs, tiles without photos). No floating sticker clusters. |
| Idle loops | **0.** Skeleton shimmer only while loading; RotatingPlaceholder (3 s) is a functional hint. |

### Theme runtime
| Piece | Where | What |
|---|---|---|
| `ThemeProvider` | `theme/ThemeProvider.js`, mounted once in `App.js` | `mode` `'system'` (default) / `'light'` / `'dark'`, persisted in AsyncStorage (`@shravankirana/theme-mode`). System follows the OS live. Also drives the React Navigation theme, the StatusBar, `Appearance.setColorScheme` and the web page background / `color-scheme`. |
| `useTheme()` | `import { useTheme } from '../theme'` | `{ colors, gradients, shadows, hardEdge, highlightTop, highlightTopOnBrand, headerThemes, tileTint(i), isDark, scheme, mode, setMode, type, space, radii, z, … }`. A stable object per scheme. |
| `makeStyles((t) => ({…}))` | same | Returns a **hook** `useStyles()`; `StyleSheet.create(factory(t))` once per scheme, cached. |
| `makeThemed((t) => value)` | same | Same caching for lookup tables that aren't styles. |
| `themes.light` / `themes.dark` | `constants/theme.js` | Resolved theme objects for code outside React (map styles, notification colours). |
| `darkColors`, `darkGradients`, `darkShadows`, `darkHardEdge`, `DARK_HEADER_THEMES` | `constants/theme.js` | The dark palette; mirrors every key of `colors` (a dev check warns on drift). |
| `colors`, `gradients`, `shadows`, `HEADER_THEMES` (static) | `constants/theme.js` | The LIGHT palette, for files not yet migrated. |
| `ThemeModeControl` | `components/ui` | The System / Light / Dark segmented control. |

---

## 1. Direction in one paragraph

Shravan is a neighbourhood kirana that delivers fast. The product is groceries, so **the colour on screen comes from the
products**, not the UI. The UI is a calm, confident, neutral frame — warm off-white canvas, white cards with a hairline,
near-black ink — with **one brand colour, violet `#6C3CF4`, used where the user acts**. Savings are green; errors are red.
Reference feel: Zepto/Blinkit density and speed with Apple/FirstClub restraint. **Not** Dribbble concept shots: no
gradients, no glow, no lavender washes, no indigo, no gold, no pastel category tints, no frosted glass on everything, no
idle animation.

---

## 2. Tokens (`constants/theme.js`)

The colour roles are in §0. Full contrast numbers are in the header comments of `constants/theme.js`.

### When to use which surface
| Need | Use | Not |
|---|---|---|
| The main action on a screen | `brand` (Button `primary`, ADD, slide-to-pay) | ink, green |
| Selected chip / segmented option / dock tab | `brandTint` + violet border/ink (Chip default) | solid ink or solid violet pills |
| A floating dark element (cart pill, toast) | `surfaceNight` (ink / raised) | indigo, violet |
| Product discount pill, "You saved ₹X", "FREE" | savings green (`Badge tone="discount"`, `<Text color="success">`) | gold, violet, blue |
| Category tile / image well | `imageWell` neutral + the product photo | pastel tints |
| A label that marks nothing in particular | `Badge` default `neutral` | violet badges |

### Header themes (`headerThemes`)
`default` and every category key (`fresh`, `dairy`, `snacks`, `festive`) = the plain surface header:
`{ bg: surface, ink, inkSecondary, statusBar: 'dark' (dark mode 'light'), searchBg: sunken (dark: raised), gradient: flat surface }`.
The selected category tab indicator (violet underline) is the only state colour. `brand` / `night` are flat legacy surfaces (see §0).

### Typography (`type`, `fontFamily`)
**Plus Jakarta Sans for everything** (UI, body, prices — tabular nums). **Bricolage Grotesque only for `hero`, `display`, `h1`**
(`DISPLAY_VARIANTS`) — the 2–3 largest headings per screen (screen titles, Home ETA). `h2` and below are Jakarta.
**No uppercase, no wide tracking** — small labels are sentence case 12/600 (`<Text uppercase>` is accepted and ignored).
**Never set `fontWeight`** — choose the weight through `fontFamily` or `<Text weight>` (Android ignores fontWeight on custom fonts).

| Variant | Size/line | Face · weight | Use |
|---|---|---|---|
| `hero` | 36/42 | Bricolage 700 | Home ETA line, order-placed number |
| `display` | 30/36 | Bricolage 700 | Big ETA, tracking ETA |
| `h1` | 24/30 | Bricolage 700 | Screen titles |
| `h2` | 20/26 | Jakarta 700 | Section titles |
| `h3` | 17/22 | Jakarta 700 | Sheet titles, card group headers |
| `title` | 16/22 | Jakarta 700 | Card titles |
| `body` / `bodyStrong` | 14/20 | Jakarta 400 / 600 | Copy |
| `label` | 13/18 | Jakarta 600 | Product names, chips, links |
| `caption` | 12/16 | Jakarta 500 | Units, meta |
| `micro` | 12/16 | Jakarta 600, no tracking | Small labels, sentence case |
| `button` | 15/20 | Jakarta 700 | Button labels |
| `price` / `priceLarge` / `priceHero` (28) / `priceStrike` / `counter` | | Jakarta 700–800 | **Tabular numerals** built in |

**Mixed-weight headlines — max ONE per screen** (Home hero line, tracking ETA only):
```jsx
<Headline variant="display" lead="Arriving in" emphasis="8 mins" emphasisColor="brand" />
```
Section titles are plain `<Text variant="h2">`.

### Space, radius, layers, elevation
- `space`: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 (gutter) · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 48 · 6xl 64`; `s(n) = n*4`.
- `radii` (roles — prefer these): `chip 8 · add 8 · button 10 · input 10 · well 10 · card 12 · sheet 16 · dock 18`.
  Legacy size keys map onto them: `xs 6 · sm 10 · md 12 · lg 12 · xl 16`. `pill 999` is **for circles only** (avatars,
  icon buttons, dots) — never a button, chip, badge or input shape.
- `shadows`: `floating` is the one elevation (see dose caps); `sm` = none, `md`/`lg` = floating, `glow` = none.
  `hardEdge` is now a plain 1px brand border. The shadowed view **must have a backgroundColor**.
- `z`: `base 0 · raised 1 · sticky 10 · header 20 · tabBar 30 · overlay 40 · sheet 50 · toast 60 · max 100`.
- `HIT = 44`: the minimum touch target.

### Legacy
`COLORS`, `SIZES`, `FONTS`, `SHADOWS` keep every key (`COLORS.primary` = `#6C3CF4`, `secondary` = ink, `accent` =
`#6C3CF4`, `info` = neutral). **Don't use the legacy exports in new code.**

---

## 3. Motion (`theme/motion.js`)

| Spring | Config | Use |
|---|---|---|
| `springs.snappy` | d20 s380 m0.7 | Press feedback, toggles, chips, stepper, small morphs |
| `springs.gentle` | d22 s170 m1 | Content entering, progress fill, list items |
| `springs.bouncy` | d11 s260 m0.75 | Celebrations, badge bump, success disc, heart pop |
| `springs.sheet` | d30 s300 m1 | Sheets and toasts that travel far |
| `springs.drag` | d24 s260 m0.9 | Snap-back after a gesture is released |

- `press.scale 0.96` (buttons and chips), `press.subtle 0.98` (big cards), `press.deep 0.92` (tiny glyphs).
- `durations`: `instant 90 · fast 160 · base 220 · slow 320`, plus `shimmer` (skeletons only), `toast` and `rotate` (3000). **Use durations only for opacity and colour fades.**
- `easings.out` (strong ease-out), `easings.inOut`, `easings.drawer`. `easings.linear` is for shimmer and spinners only. **Never use ease-in.**
- `stagger`: 35 ms per item, capped at 8 items, 12 px rise. `staggerDelay(i)` → the capped delay in ms, for your own `withDelay`.
- `transitions`: native-stack option presets to spread into `options`: `push` (slide, 320 ms, full-width back gesture), `fade` (PDP, 260), `modal` (bottom-up, 340), `auth`, `none`.
- `layout`: Layout Animation presets for `<Animated.View entering / exiting / layout>`: `layout.enter` (8 px rise + fade), `layout.enterDown`, `layout.enterAt(i)` (staggered), `layout.exit` (160 ms fade), `layout.exitLeft` (removed rows), `layout.list` (LinearTransition spring, so neighbours slide). Custom worklets are native-only, so each preset has a **web-safe fallback** (Reanimated web only runs the predefined presets). All of them honour the OS reduced-motion setting.

**Rules**
1. **Interactive motion is a spring.** Anything the user can interrupt (press, toggle, drag, sheet) uses `withSpring`.
2. **Animate only `transform` and `opacity`**, plus colour through `interpolateColor`, on the **UI thread**. (Single exception: the FloatingDock active pill animates its width so it can hug the label.)
3. Never start from `scale(0)`. Enter from 0.9 or higher with opacity.
4. Exits are faster than entrances (toast: spring in, 220 ms out).
5. Don't animate things people see 100 times a session. Keep delight for rare moments: order placed, first add, free delivery unlocked.
6. Stagger only the first paint of a screen. Never block taps while it plays.
7. **Reduced motion:** every primitive calls `useReducedMotion()` and drops translate and scale, keeping opacity and colour.
8. Never use the RN `Animated` API in new code. Use Reanimated.
9. **No endless loops** (DESIGN.md "Motion"): no idle bob, float, pulse, blink, sheen, looping scooter or glowing dots.
   Motion is trigger-based only (tap, scroll, navigation, data change). Allowed repeats: the skeleton shimmer while
   loading, a spinner while work runs, and RotatingPlaceholder's 3 s hint rotation.
10. Keep: screen transitions, fly-to-cart, hero image, ADD→stepper, rolling numbers, header collapse, list layout
   transitions, sheet springs.

### Motion building blocks (names match `docs/design/motion-spec.md`)

| Need | Use | Notes |
|---|---|---|
| Screen body arrives | `<AnimatedScreen>` / `useScreenEnter()` | Goes inside `<Screen>`. 220 ms fade + 8 px spring rise, once per mount. Tab screens: `<AnimatedScreen replayOnFocus>` (150 ms crossfade + rise on every return, no slide). |
| Skeleton → content, data ↔ empty ↔ error | `<ContentSwap stateKey={…}>` | The outgoing state fades out on top (150 ms, absolute, not touchable). The incoming one fades in with a 6 px rise. No pop-in, no layout jump. |
| Large title → compact bar | `useCollapsibleHeader()` + `<LargeTitle>` + `<CollapsibleHeader>` | One scroll SharedValue. The solid surface bar and hairline fade in. Content gets `paddingTop: useCollapsibleHeaderHeight()`. Works with `Animated.ScrollView`, `Animated.FlatList` and `Animated.createAnimatedComponent(FlashList)`. |
| Tappable with a shape (button, chip, card, tile) | `PressableScale` (the default for every tappable) | 0.96, or 0.98 for big cards. |
| Full-width list row | `PressableHighlight` | The `pressOverlay` tint fades in over 90 ms and out over 220 ms. No scale. |
| Insert / remove in a list | `<Animated.View layout={layout.list} exiting={layout.exit}>` | Neighbours slide instead of jumping. |
| Swipe to delete (cart, addresses, recents) | `<SwipeableRow onAction>` | Reveal, then snap open. A full swipe or a flick commits (haptic at the threshold, then a slide-out). The child must paint an opaque background. Includes a screen-reader action. |
| Footer / form riding the keyboard | `<KeyboardLift offset={insets.bottom}>` / `useKeyboardSpring()` | UI-thread and frame-synced (native `useAnimatedKeyboard`, web `visualViewport`). BottomSheet already does this. |
| Prices, totals, counts, ETA | `<RollingNumber currency value={total} />` (alias `AnimatedNumber`) | `currency` = ₹ + Indian grouping + 0–2 decimals. Pass `decimals={2}` to fix the decimals. |

```jsx
// A converted stack screen with every block in place
const collapse = useCollapsibleHeader();
const top = useCollapsibleHeaderHeight();
<Screen edges={[]}>
  <AnimatedScreen>
    <Animated.ScrollView onScroll={collapse.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top }}>
      <LargeTitle collapse={collapse} title="Saved addresses" />
      <ContentSwap stateKey={loading ? 'loading' : list.length ? 'data' : 'empty'}>
        {loading ? <SkeletonGroup><SkeletonListRow /><SkeletonListRow /></SkeletonGroup>
          : list.length ? list.map((a) => (
              <Animated.View key={a.id} layout={layout.list} exiting={layout.exit}>
                <SwipeableRow onAction={() => remove(a.id)}>
                  <PressableHighlight onPress={() => edit(a)} style={styles.row}>…</PressableHighlight>
                </SwipeableRow>
              </Animated.View>))
          : <EmptyState title="No saved addresses" />}
      </ContentSwap>
    </Animated.ScrollView>
  </AnimatedScreen>
  <CollapsibleHeader collapse={collapse} title="Saved addresses" onBack={navigation.goBack} />
  <KeyboardLift offset={insets.bottom} style={styles.footer}><Button label="Add address" fullWidth /></KeyboardLift>
</Screen>
```
Live demos: DesignSystem → "Theme" and "Motion building blocks".

### Signature motion

Three authored moments. Everything else stays quiet. Their tokens live in `signature` in `theme/motion.js`: `flight`, `hero`, `heroFade` and `parallax`.

**Fly-to-cart** (`FlyToCart.js`, Shop / Blinkit pattern). Tapping ADD lifts a copy of the pack shot to 1.06×. The copy then arcs along a quadratic bezier: the control point sits 96 px above both ends and 30% of the way across. It shrinks into the cart target and rounds off into a circle, then fades over the last 12%. On landing, the target bumps (90 ms rise, then `springs.bouncy`), the count and ₹ total roll, and `haptic.light()` fires. One progress value (520 ms) drives translate, scale and opacity on the UI thread. The radius is the only paint-only property it animates.
```jsx
// App.js (already mounted): <HeroTransitionProvider><FlyToCartProvider>…</FlyToCartProvider></HeroTransitionProvider>
const fly = useFlyToCart();
fly({ fromRef: wellRef, uri: product.image });   // fire-and-forget, then dispatch(addToCart(…)) as usual
// optional: inset (fraction of the source rect that is padding around the art, default 0.08); uri may be a require()d asset

const ref = useRef(null);
const bump = useCartTarget(ref, { priority: 3, enabled: hasItems });   // returns the landing-bump style
<Animated.View ref={ref} collapsable={false} style={bump}>…</Animated.View>

const shown = useFlightDeferred(count);   // shows the old value until the flight lands (or right away if nothing is flying)
```
- **Targets.** In priority order: `FloatingCartBar` thumbnail stack (3), dock cart icon (2, in `BottomTabsIcons`), PDP "Add to cart" CTA (1). A target only counts when its screen is focused and it is on screen. Pick a higher priority for a screen-local target, as the DesignSystem demo does with 4.
- **Never blocks the cart.** `fly()` returns at once. Measuring is async, at most 3 flights run at a time, and extra taps just bump the target. The flight is skipped when the source has scrolled away. Held values are always released within 1.2 s.
- **Reduced motion:** no flight. The target does a 1.05 bump and the count updates immediately.
- `ProductCard` and the PDP already call it, and `FloatingCartBar` / `FloatingDock` defer their counts. Any new ADD surface needs only the two lines above.

**Card → PDP shared element** (`HeroTransition.js`). Reanimated 4.5.1 keeps `sharedTransitionTag` behind the static flag `ENABLE_SHARED_ELEMENT_TRANSITIONS`, which is off by default. It is native-only and experimental with native-stack, so this is a manual hero overlay that works on all three platforms:
1. On tap, `ProductCard` calls `hero.start({ fromRef, uri, matchKey: productId, sourceKey })` and navigates in the same tick, so navigation is never delayed. The overlay copy parks exactly over the card image, which is hidden through `useHeroSourceStyle`. Web measures synchronously because it hides the card screen on push.
2. The PDP claims the flight on its first render with `useHeroTarget(productId)`, so its hero image is hidden from frame one and never flashes. It reports the hero rect from `onLayout`.
3. One progress value springs 0 → 1 (`d28 s240`, ~420 ms). Translate and uniform scale interpolate between the two rects. The overlay box is hero-sized and only ever scales down, so the bitmap is never upscaled.
4. Once the overlay has landed and the PDP image has decoded (it waits at most 450 ms), the real image is revealed underneath and the overlay fades out over 120 ms.
5. On pop (`beforeRemove` / `transitionStart{closing}`), the progress springs back to 0 and lands on the card. A pop mid-flight reverses from wherever the image is. If the hero has scrolled away or the card has gone, nothing animates and the screen just fades.

`ProductDetail` uses `animation: 'fade'` (260 ms) in `AppNavigator`, so the image is the only thing that travels. If an unclaimed tap opens something other than a PDP, the overlay aborts after 400 ms. Under reduced motion there is no overlay and only the fade remains.

**Banner parallax** (`BannerCarousel`). Pass the screen's scroll offset as `scrollY` (a SharedValue). The art moves at 0.15× scroll and the copy at 0.05×. While you pan, each slide's art leads the track by 10% of its offset from centre and the copy trails it by 4%. The art is over-scaled 1.12× and clamped, so no edge ever shows. Auto-advance and pause are unchanged. Reduced motion turns parallax off.

**Micro-polish.** The `FloatingCartBar` count and ₹ total are `RollingNumber`s that change on impact. The dock cart icon bumps when an item lands. The PDP CTA morph brings the new slot in with a 160 ms fade and a snappy spring rise, and the old slot leaves in 90 ms: exits are faster than entrances, nothing runs over 300 ms, and nothing eases in.

**Haptics** (`haptic` from `components/ui`; no-op on web): `light` (ADD / + / − / button), `selection` (chips, dock,
slider threshold), `medium` (sheet snap), `success` (order placed, slide-to-pay), `warning` (limit), `error`.

---

## 4. Primitives

All primitives are JS function components, and every file opens with a JSDoc block listing its full props.

### Screen
SafeArea, flat canvas background and status bar in one wrapper.
```jsx
<Screen edges={['top']} statusBar={headerThemes.default.statusBar} topInsetColor={headerThemes.default.bg}>…</Screen>
```
Props: `edges` (default `['top']`), `background` (`canvas`|`surface`|colour), `statusBar` (default follows the theme), `topInsetColor`, `style`. `wash` is deprecated and ignored.

### Text / Headline / Em
```jsx
<Text variant="h2">Fresh fruits</Text>
<Text variant="caption" color="muted" numberOfLines={1}>500 g</Text>
<Headline variant="display" lead="Arriving in" emphasis="8 mins" emphasisColor="brand" />   // max ONE per screen
```
Text props: `variant`, `color` (`ink`|`strong` (heading / price ink)|`secondary`|`muted`|`disabled`|`inverse`|`onBrand`|`onNight`|`onNightSecondary`|`brand`|`accent`|`success`/`savings`|`error`|`warning`|`info`|`offer`, or any colour; `gold`/`goldInk` are deprecated → savings green), `weight`, `align`, `tabular`. `uppercase` is ignored. Font scaling is capped at 1.4×.
Tokens resolve against the **active** theme. `brand` and `accent` resolve to `colors.brandText`, the text-safe violet in both modes. A raw colour string is used as-is, so pass tokens, not hex. For custom text use `resolveTextColor(token, useTheme().colors)`.

### PressableScale
The base of everything tappable that has its own shape. List rows use `PressableHighlight`. Springs to `scaleTo` on press-in, optional haptic.
Props: `onPress`, `onLongPress`, `scaleTo` (0.96), `haptic`, `disabled`, `disabledOpacity`, `style`, `hitSlop`,
**`container`** — set it on any pressable that *contains* other buttons (product cards, cards with an ADD / heart):
on web it renders `role="group"` so RN-web never nests `<button>` in `<button>`; keyboard Enter still activates.

### Button
```jsx
<Button label="Proceed to pay" size="lg" fullWidth loading={paying} onPress={pay} />
<Button label="Change" size="sm" variant="soft" align="start" onPress={edit} />
```
- `variant`: `primary` (solid violet), `secondary` / `dark` (solid ink), `soft` (brand tint + violet text), `outline` (violet border), `ghost` (violet text), `light` (white with violet text — only on a violet / ink block), `danger`
- `size`: `sm` 36, `md` 48, `lg` 56. **Radius 10, flat — no gradient, no glow, no pill.** `glow` is ignored.
- `loading` swaps the label for a small spinner (no pulsing dot).
- **Layout:** no forced `alignSelf`. It stretches in a default column and hugs in a row. Use `fullWidth` or `align="start|center|end|stretch"` to be explicit.
- `loading` keeps the width; `disabled`, `leftIcon`, `rightIcon`, `haptic` (default `light`).

### IconButton
`variant`: `surface` (surface disc + hairline, flat), `tinted`, `ghost`, `scrim` (over photos), `brand`/`accent` (violet),
`soft` (brand tint), `night` (ink), **`glass`** / `floating` (solid white/surface circle + hairline + the floating shadow —
the round button over photos and maps). Add **`allowBlur`** to frost it — PDP-over-photo and map controls only (blur cap: 2).
`size` `sm` 32 / `md` 40 / `lg` 48 (hit area ≥44). Circles are allowed for icon buttons. `accessibilityLabel` is required.

### Card
```jsx
<Card padding="md" onPress={…} accessibilityLabel="Fruits">…</Card>
```
- **Flat + hairline, radius 12, no shadow.** `variant`: `surface` (default), `night` (ink — sparingly). `glass` → solid surface.
- `elevation` defaults to `none`; pass `floating` only for something that floats above content. `tint` keys all resolve to the neutral well.
- `radius` (default `card` 12), `padding`.
- `onPress` makes it a PressableScale (0.98) with `container` set — inner Buttons are safe on web.

**Never nest cards.** Inside a card, separate content with Divider and whitespace.

### Chip / Pill
```jsx
<Chip label="Pure veg" selected={veg} onPress={…} />                      // brand tint + violet border when selected
<Chip tone="brand" label="₹30" caption="Most tipped" selected onPress={…} />  // solid violet (one primary choice)
```
- **Radius 8, never a pill.** `tone`: `soft` (default — selected = `#F1ECFE` + violet border + violet ink; unselected = surface + border), `brand` (solid violet). Legacy `night`/`green`/`ink` → soft, `yellow` → brand.
- `size` `sm` 32 / `md` 40, `leftIcon`, `rightIcon`, `caption`, `disabled`, `haptic` (`selection`).

### Badge / CountBadge
- Badge: **sentence case, radius 6, never a pill.** `tone`: `neutral` (default), **`discount`** (savings green, white — alias `offer`/`gold`), `success` (green tint), `brand`/`accent` (violet — only for a state the user acted on), `soft` (brand tint), `night`/`ink`, `error`. `size` `sm` 11 | `md` 12. ETA badges use a clock or scooter glyph — **never a lightning bolt**. `shape` is ignored.
- CountBadge `tone`: `error`, `ink` (ink bubble, inverts in dark — the dock cart count), `accent`/`brand`, `gold` (→ green). Rolls and bounces on change.

### AddToCartButton (the key interaction — Part C #4)
```jsx
<AddToCartButton size="sm" quantity={qty} productName={item.name} max={item.maxQty}
  onAdd={…} onIncrement={…} onDecrement={…} />
```
- At 0: surface **ADD** with a plain **1px violet border**, radius 8, 13/800 violet, "+" in the corner. No offset edge, no shadow.
- Tap: a **solid violet** fill grows from the centre in the same footprint, white − / + slide out, the white count rolls.
- **Fixed sizes:** `sm` 64×32 (grid cards), `md` 80×36 (lists), `lg` 112×44 (PDP / sticky bars). No layout jump.
- `max` → shake + warning haptic + `onMaxReached`. `disabled`, `outOfStock` ("Sold out"), `label` (i18n). Controlled.

### PriceTag
```jsx
<PriceTag price={48} mrp={60} />                                  // ₹48 ₹60
<PriceTag price={248} mrp={300} size="lg" showSave="amount" />     // ₹248 ₹300 [Save ₹52] (savings green)
```
Props: `price`, `mrp`, `size` (`sm` 16/800 + MRP 12/500 struck · `md` 20 · `lg` 28/800), `showSave` (`true`/`'percent'`/`'amount'`), `layout` (`row`|`stack`), `color` (default ink), `rolling`. Tabular numerals; one accessible label.

### RollingNumber
`<RollingNumber value={total} currency variant="priceLarge" />`. Only the changed digits roll. `currency` adds ₹ and Indian grouping (0–2 decimals; set `decimals` to fix them). Alias: `AnimatedNumber`.

### SegmentedControl / ThemeModeControl (new)
```jsx
<ThemeModeControl labels={{ system: t('system'), light: t('light'), dark: t('dark'), title: t('theme') }} />   // Profile → Appearance
<SegmentedControl options={[{ key: 'all', label: 'All' }, { key: 'veg', label: 'Veg', icon: 'leaf' }]} value={v} onChange={setV} />
```
A sunken track (radius 10) with a flat raised thumb (radius 8, hairline) that springs (`snappy`) between equal-width segments. Radiogroup semantics. `size` is `md` 44 or `sm` 36.
`ThemeModeControl` reads and writes `useTheme().mode`, which is persisted.

### WellLight (deprecated)
Renders nothing in both themes (no decorative glow). Kept so existing call sites don't break — remove it from screens during the screen pass.

### Skeleton
Neutral bones (`hairline`) with a shared shimmer clock — the only repeating motion, and only while loading. `Skeleton`, `SkeletonText`, `SkeletonProductTile`, `SkeletonListRow`, wrapped in `SkeletonGroup`.

### BottomSheet
`visible`, `onClose`, `title`, `subtitle`, `floating`, `scrollable`, `dismissible`, `footer`, `maxHeight`, `contentStyle`. Radius 16 (`radii.sheet`), 40×5 handle, flat dim scrim (`blurScrim` is ignored). Springs open, exits in 220 ms, drag/flick to dismiss.

### SectionHeader / SheetHeader · Divider / Spacer · AnimatedListItem
Unchanged API. SectionHeader's action link is violet.

### SlideToConfirm
Solid violet track (radius 12), white knob (radius 8) with violet chevrons, static label + chevron hint. No gradient, no sheen loop, no glow.
`tone`: `accent` (violet, default) | `dark` (ink). Web keeps `accessibilityRole="adjustable"` so the drag works.
Props: `label`, `confirmedLabel`, `onConfirm` (rejected promise resets), `loading`, `disabled`; `ref.reset()`.

### SuccessCheck + ConfettiBurst
- SuccessCheck: violet spinner that resolves into a **violet** disc + white check (DESIGN.md: "violet check"). `color` (disc), `spinnerColor`, `size`, `onDone`, `haptic`.
- ConfettiBurst: **one** burst of violet + savings green + neutral grey particles. `ref.fire()`; no-op under reduced motion.

### Mascot
Flat paper bag: neutral body + hairline, brand-violet rim, handle and leaf, ink face. No gradients, gold or glints.
**Static** — one entrance (fade + settle), no bob / blink / floating z's. `mood`: `happy` · `sad`/`unavailable` · `sleepy`/`empty` · `loading` (face only).
**Only** on empty / error / unserviceable states — not login, onboarding or loading spinners.

### EmptyState · Toast · ProgressBar · RotatingPlaceholder
- EmptyState: mascot + title + subtitle + actions. `sticker` is ignored (no floating sticker clusters).
- Toast: **solid** dark surface (ink `#151515`; dark: raised `#232323` + hairline), sentence-case violet action. No blur.
- ProgressBar: `value`, `height`, `color` (violet; pass `colors.success` for savings / free delivery), `trackColor` (hairline), `completeColor`. **Flat fill**; `gradient` is deprecated (an array collapses to its last stop).
- RotatingPlaceholder: 3 s interval (`durations.rotate`).

### GradientHeader (name kept — renders a SOLID header)
A solid header band + safe-area top padding + hairline. Fill = `color`, else the first stop of `gradient` (all theme gradients are flat), else `colors.surface`.
```jsx
<GradientHeader>…</GradientHeader>   // plain surface header (white / #1A1A1A) with a hairline
```
Props: `gradient`, `color`, `safeTop`, `rounded` (default false), `hairline` (default true on the surface), `style`, `children`. `glow` is ignored.

### GlassSurface (name kept — SOLID by default)
A solid surface + hairline. Pass **`allowBlur`** for a frosted fill — only for chrome floating over photos or maps (blur cap: 2 uses).
Props: `tone` (`light`|`night`), `allowBlur` (false), `intensity` (40), `radius` (default `card`), `bordered`, `style`.
With blur on web, children sit in a positioned layer above it, so inputs and text are never blurred.

### FloatingDock
Floating tab bar: 64pt, 16pt inset, **solid surface + hairline, radius 18, the one floating shadow, no blur, no glow**.
Active item = **filled violet icon + label** on a brand-tint indicator (radius 12); inactive = muted outline icon only.
Cart count badge is an ink bubble.
```jsx
<FloatingDock items={[{ key: 'Home', label: 'Home', icon: ({ color, size, focused }) => <Icon name={focused ? 'home' : 'home-outline'} color={color} size={size} /> }, …]}
  activeKey={route.name} onSelect={(k) => navigation.navigate(k)} bottomInset={insets.bottom} />
```
Props: `items` (`{ key, label, icon, badge?, accessibilityLabel? }`), `activeKey`, `onSelect`, `activeTone` (`tint`; legacy keys alias to it), `showLabels` (`active`|`all`|`none`), `bottomInset`, `style`. Exports `DOCK_HEIGHT`.
The pill's x is derived from measured item widths (not onLayout x, which web doesn't report when siblings move), so it tracks correctly on every platform. The app's tab bar uses it directly (`navigation/AppNavigator.js`).

### FlyToCartProvider / useFlyToCart / useCartTarget / useFlightDeferred · HeroTransitionProvider / useHeroTransition / useHeroSourceStyle / useHeroTarget
Signature-motion hooks. See section 3, "Signature motion", for the API and rules. Live demo: DesignSystem → "Fly to cart".

### haptic
`haptic.light()`, `haptic.selection()`, `haptic.medium()`, `haptic.success()`, `haptic.warning()`, `haptic.error()`, or `haptic('light')`.

---

## 5. Accessibility rules
- **Touch targets of at least 44×44pt.**
- **Icon-only controls need an `accessibilityLabel`** that names the action.
- **Contrast:** body text ≥4.5:1, large ≥3:1. `inkMuted` is the floor. Violet as text is always `brandText` (the dark-mode fill fails as text). On violet use white; on ink use `onNight*`; on savings green use `onSuccess`.
- **Nested controls on web:** any pressable that contains buttons uses `container` (Card does it for you).
- **Font scaling** capped at 1.3–1.4×; never fix heights on text containers.
- **Reduced motion, states, headers, gesture alternatives:** as before — the primitives handle them.

## 6. Do / don't (DESIGN.md)

**Do**
- Let the products carry the colour: packshots on the neutral `imageWell`, filling ~85% of the well; real photography on banners.
- Let violet mean "act": one primary CTA per view; selected states use the brand tint; everything else is neutral.
- Use green for every saving / FREE / veg / success, and red only for errors.
- Keep cards flat with a hairline (radius 12); give the one floating shadow only to things that float (dock, cart pill, sheets, toasts, map controls).
- Use Bricolage for the 2–3 largest headings and Plus Jakarta for everything else; sentence-case small labels.
- Use clock / scooter glyphs for ETA. Keep motion trigger-based.

**Don't**
- Don't use gradients (except `gradients.scrim` under text on a photo), glow, lavender washes, indigo, gold, blue, or pastel category tints.
- Don't use blur/glass except the ≤2 round buttons over photos or maps.
- Don't use pill shapes for buttons, chips, badges or inputs (circles for avatars / icon buttons only).
- Don't use uppercase wide-tracked labels, lightning bolts, sparkles, stars-as-decoration, or emoji in UI copy.
- Don't put the mascot on login / onboarding / loading, and don't scatter 3D sticker clusters.
- Don't add idle loops (bob, float, pulse, blink, sheen, glowing dots).
- Don't use raw hex, `fontWeight`, or font sizes off the scale; don't use `TouchableOpacity` or RN `Animated` in new code.
- Don't use coloured `border-left` stripes on cards, nested cards, or gradient text.

## 7. Platform notes
- **Web:** haptics are no-ops; Reanimated, Gesture Handler, BottomSheet and expo-blur (backdrop-filter) work. Shadows use `boxShadow`. The sheet's keyboard lift is native-only.
- **Web testing:** RN-web Pressables ignore synthetic mouse clicks under mobile *touch emulation*, so test taps at a non-touch viewport.
- **Android:** shadows use `elevation` (needs an opaque `backgroundColor`); `allowBlur` falls back to the solid fill. `Screen` doesn't paint the `canvas` background; the native-stack `contentStyle` does that, and tab scenes are transparent. That avoids two extra full-screen overdraw layers. A `Screen` used outside the navigator, such as in a `Modal`, needs `background` set explicitly.
- **Android / Reanimated 4.5.1 (found in emulator QA):**
  - `package.json → reanimated.staticFeatureFlags.FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS: false`. With the default (`true`) the settled-props sync dropped values, and a later re-render put animated views back to their *initial* style: blank Home body (`opacity: 0`), invisible banner, the category underline snapping back. It is a native flag, so rebuild the dev client after changing it.
  - `package.json → reanimated.staticFeatureFlags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS: true` (native flag, rebuild). Transform / opacity / colour / radius updates go straight to the view instead of committing the whole shadow tree every animation frame. Release-build profiling (see `mocks/README.md`) found those per-frame commits were the main UI-thread cost: Home scroll, fly-to-cart and checkout scroll all got smoother. Layout props (`width`, `height`, `top`, margins…) still commit every frame, so animate `transform`, not size.
  - `patches/react-native-reanimated+4.5.1.patch` skips synchronous updates for views that are not mounted (yet, or any more) before calling RN. Without it every miss built two exceptions with stack traces; skeleton shimmers and recycled cells made that the top UI-thread cost while scrolling. It also silences the per-frame `synchronouslyUpdateUIProps failed` log for those views.
  - Keep idle UI-thread work at zero: anything that loops (banner clock, skeleton shimmer) must stop when its screen loses focus or unmounts. Tab screens and screens under a pushed one stay mounted.
  - Never put `StyleSheet.absoluteFillObject` in styles. RN 0.86 removed it, so it is `undefined` on native (web still has it) and the view gets no size. Use `StyleSheet.absoluteFill`.
  - Never call `scheduleOnRN(haptic.selection)` (or another property of `haptic`) from a worklet. `haptic` is a function object, and inside a worklet its properties are `undefined`, which aborts the app. Wrap it in a local function instead: `const tick = () => haptic.selection()`.
  - Values measured in `onLayout` that a worklet reads (e.g. a width) belong in a shared value. Do not capture React state in the closure.
  - Google Maps needs `GOOGLE_MAPS_API_KEY` in the build. Without it, `mapTheme.NATIVE_MAPS_AVAILABLE` is false and the map components show a plain surface rather than crash.
- **Fonts** gate the first render in `App.js`. **Babel:** `babel-preset-expo` auto-adds the worklets plugin.

---

## 8. Brand layer

| Piece | Where | Use |
|---|---|---|
| `Logo` / `LogoMark` | `Logo.js` (+ generated `logoPaths.js`) | `variant` full · mark · wordmark, `tone` light · brand · dark, `size` = mark height. **Flat** brand violet mark: a rounded, slightly tapered bag with one die-cut arch handle and no letter (no gradient, no gold leaf). Outlined wordmark (Bricolage 800/600). |
| `Icon3D`, `icon3dFor` | `Icon3D.js`, `assets/icons3d/` | Fluent Emoji 3D icons (MIT, see `assets/icons3d/README.md`). **Only to identify a category** (category tabs, category tiles without photos). Static — `float` is ignored. |
| App icon / adaptive / splash / favicon | `assets/brand/` | Rendered from the Logo geometry; wired in `app.json`. |

---

## 9. Migration guide — static colours → runtime theme

**Why:** `StyleSheet.create({ x: { color: colors.ink } })` at module scope bakes in the LIGHT value at import time, and it can
never change after that. Every converted file reads colours at render time through `makeStyles` / `useTheme`.

### Convention (codemod-friendly)
- `import { useTheme, makeStyles } from '../theme';` (path relative to the file).
- Tokens that don't depend on the mode stay static imports: `type, fontFamily, space, s, radii, z, HIT` from `constants/theme`.
- **Every converted file defines its styles at the bottom as `const useStyles = makeStyles((t) => ({ … }));`.** Every
  component in the file that uses styles calls `const styles = useStyles();` as its first hook. Keep the name `styles`
  so the JSX doesn't change.
- Inline colour (`color={colors.inkMuted}`, gradient arrays, icon colours) → `const { colors, gradients } = useTheme();` in the component.
- Module-level lookup tables that contain colours (variant maps, tone maps) → `const useTones = makeThemed((t) => ({ … }))`.
- After conversion, the file must not import `colors`, `gradients`, `shadows`, `hardEdge`, `HEADER_THEMES`, `tileTint`,
  `highlightTop*`, `COLORS` or `SHADOWS` from `constants/theme` (see the grep check below).

### Before → after: a screen
```jsx
// BEFORE
import { StyleSheet, View } from 'react-native';
import { colors, gradients, shadows, space, radii, HEADER_THEMES } from '../constants/theme';

export default function OrdersScreen() {
  return (
    <Screen statusBar="dark" topInsetColor={HEADER_THEMES.default.bg}>
      <LinearGradient colors={gradients.header} style={styles.header} />
      <View style={styles.card}>
        <MaterialCommunityIcons name="receipt" size={20} color={colors.brand} />
        <Text style={styles.title}>Orders</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.hairline, padding: space.lg, ...shadows.sm },
  title: { color: colors.ink },
  header: { height: 120, borderRadius: radii.xl },
});
```
```jsx
// AFTER
import { View } from 'react-native';
import { space, radii } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';

export default function OrdersScreen() {
  const styles = useStyles();
  const { colors, gradients, headerThemes } = useTheme();
  const header = headerThemes.default;
  return (
    <Screen statusBar={header.statusBar} topInsetColor={header.bg}>
      <LinearGradient colors={gradients.header} style={styles.header} />
      <View style={styles.card}>
        {/* violet ICON / TEXT → brandText */}
        <MaterialCommunityIcons name="receipt" size={20} color={colors.brandText} />
        <Text style={styles.title}>Orders</Text>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  card: { backgroundColor: t.colors.surface, borderColor: t.colors.hairline, padding: space.lg, ...t.shadows.sm },
  title: { color: t.colors.ink },
  header: { height: 120, borderRadius: radii.xl },
}));
```

### Rules
1. **No colour inside a module-scope `StyleSheet.create`.** StyleSheets that only hold layout can stay static.
2. **Violet as text, icon or link → `colors.brandText`** (or `<Text color="brand">`). `colors.brand` is the *fill* (white text on it). The two are equal in light and differ in dark: the `#7754F5` fill fails as text on dark surfaces.
3. **Heading or price ink that used `colors.night[900]` or `surfaceNight` as a TEXT colour → `colors.inkStrong`** (`<Text color="strong">`). `surfaceNight` is a fill.
4. **Text on a fill:** `onBrand` (brand), `onNight` (night), `onError` (error), `onSuccess` (success; this is dark ink in dark mode!), `onGold` (gold). Don't use `inkInverse` to mean "white": it's the ink on `surfaceInverse`, and it flips in dark.
5. **Selected state** = `brandTint` background + `brand` border + `brandStrong` ink (Chip default, dock indicator). Not an inverse pill.
6. **No gradients.** Every `gradients.*` key is flat; replace `<LinearGradient colors={gradients.x}>` with a plain `View` of the matching solid during the screen pass. Only `gradients.scrim` remains (text over photos).
7. **Raw scales** (`colors.violet[700]`, `colors.night[900]`, `lavender[100]`…) don't change with the theme, and `night` / `lavender` / `gold` are now neutral / green remaps. Use semantic roles on canvas and cards (`brandTint`, `surfaceSunken`, `imageWell`, `success`).
8. **Hex / rgba literals** in a screen are a bug. If you need a new colour, add the key to BOTH `colors` and `darkColors` (the dev check warns otherwise) and document its contrast.
9. **Shadows** come from `t.shadows` — `floating` only, for things that float. Cards get a hairline instead. A view with a shadow still needs an opaque `backgroundColor`.
10. **Header themes:** use `useTheme().headerThemes.<key>`. The dark variants have light ink and `statusBar: 'light'`. Pass `header.statusBar` to `<Screen>`; on plain canvas screens omit `statusBar` and Screen follows the theme.
11. **Animated colours** (`interpolateColor`) must take their stops from `useTheme()` values inside the component, never from static imports. The worklet captures them, so they update when the theme switches.
12. **Images / illustrations:** packshots go through `ProductImage` (neutral well, no web multiply in dark). For hand-built wells, use `backgroundColor: colors.imageWell` (radius 10); `WellLight` is a no-op. On web, apply `mixBlendMode: 'multiply'` only when `colors.imageBlend === 'multiply'`. Mascot, Logo (`tone` defaults to the scheme) and Icon3D stickers already adapt. Photos with a baked-in white background show as white tiles on dark; they need real cut-outs.
13. **Maps:** `react-native-maps` and the web map need a dark map style when `isDark` (a custom JSON style on Android and web, `userInterfaceStyle="dark"` for Apple Maps on iOS). Take route and marker colours from `colors.brand` / `colors.success`. Keep the style JSON next to `MapComponent.*` and choose it with `useTheme().isDark`.
14. **Text inputs:** `color: t.colors.ink`, `placeholderTextColor={colors.inkMuted}`, `selectionColor={colors.brand}`, and `keyboardAppearance={isDark ? 'dark' : 'light'}` (iOS).
15. **Code outside React** (a notification colour, a map style factory) reads `themes.light` / `themes.dark` from `constants/theme`.

### Checklist per file
- [ ] `grep -nE "\b(colors|gradients|shadows|hardEdge|HEADER_THEMES|tileTint|COLORS|SHADOWS|highlightTop)\b" <file>`: every hit comes from `useTheme()` / `t.` (no static import left).
- [ ] `grep -nE "#[0-9A-Fa-f]{3,8}\b|rgba?\(" <file>`: no colour literals (except `'transparent'`).
- [ ] `const useStyles = makeStyles((t) => ({…}))` is at the bottom, and each component calls `useStyles()`.
- [ ] Violet text and icons use `brandText`; text on fills uses the matching `on*`.
- [ ] Status bar and header colours come from `headerThemes` (or Screen's default).
- [ ] Open the screen in light **and** dark (DesignSystem → Theme, or `?ds` + "Force dark"). Check it against DESIGN.md dose caps.
- [ ] Colours mid-animation (chip select, progress complete) look right in both.
- [ ] Motion: the screen body is in `<AnimatedScreen>`, loading goes through `<ContentSwap>`, list rows use `PressableHighlight`, insert/remove uses `layout.list` (see §3).
