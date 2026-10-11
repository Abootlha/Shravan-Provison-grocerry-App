# Customer app redesign — research & style spec (violet premium)

Brand palette (owner's original): violet `#6C3CF4`, violet `#7C3AED`, lavender `#F3E8FF` / `#E9D5FF`, deep indigo `#1E1B4B`.
Direction: premium, modern quick-commerce (Zepto/Getir/Shop/CRED level), 60fps spring motion.

## Part A — Design galleries (Dribbble, Behance, Refero, Figma Community)

### Key references
1. Crunch Bold Snack Delivery — https://dribbble.com/shots/27324469 — mixed-weight headline ("Best of" light + **Snacks** bold), dark selected chip, stacked card carousel, big centred price (~32px bold), round qty stepper, lavender gradient bg.
2. Energy Drink E-commerce — https://dribbble.com/shots/27148871 — lavender→white gradient, light-italic + bold headline, full-width deep-violet gradient CTA, pill stepper with filled violet "+", nutrition stat chips.
3. Getir Homepage — https://dribbble.com/shots/17247535 — real purple quick-commerce brand: purple banners with gold/yellow keyword, small violet "+" on white square at tile corner.
4. Getir Online Basket — https://dribbble.com/shots/14111787 — selected product gets violet border + qty badge + violet corner check.
5. Purrweb Grocery Delivery — https://dribbble.com/shots/25611056 — purple + lime accent, illustrated categories on pastel tiles.
6. Pecko — https://dribbble.com/shots/27565189 — full-bleed photo onboarding, bold white two-line headline, swipe-to-start pill.
7. Kites Onboarding — https://dribbble.com/shots/26240870 — pastel gradient, tilted chip collage, elongated pill page indicator.
8. Instamart Referral — https://dribbble.com/shots/23415638 — mixed-weight "Earn coupons worth **₹600!**", notched dashed coupon cards.
9. Zepto Redesign (Behance) — https://www.behance.net/gallery/255705711 — lavender gradient header, tilted seasonal chips, "₹0 Fees" value strip.
10. Musemind Grocery — https://dribbble.com/shots/22644706 — superscript paise prices, floating dock with tinted active icon, split stepper.
11. SM Rubel Grocery — https://dribbble.com/shots/27680436 — floating pill dock, discount tag top-left, heart top-right.
12. Munchies — https://dribbble.com/shots/27670559 — dock active tab expands into dark pill with icon+label.
13. Nixtio Supplements — https://dribbble.com/shots/27229420 — huge light title, text tabs with bold active, restraint = premium.
14. Ronas IT Beauty Quiz — https://dribbble.com/shots/27727660 — serif headline w/ violet second line, frosted cards, near-black CTA.
15. Interactive Grocery (Figma) — https://www.figma.com/community/file/1541837713049692391 — serif breadcrumb headline, sort chips, round add buttons.

### Recurring modern patterns (by frequency)
1. Floating pill bottom dock (inset 16–20px, soft shadow; active = filled circle or expanding pill with icon+label).
2. Big cut-out pack shots / real produce on tinted rounded image wells (not boxed white cards); items may break the frame.
3. Mixed-weight headlines (light+bold, or ₹ amount heavier).
4. Pastel gradient canvas (lavender → white) with a saturated hero.
5. Pill chips with high-contrast selected state (night/brand fill); unselected white + hairline.
6. Stepper: round "+" → pill stepper (– qty +) with filled brand.
7. Price as hero: large bold, superscript paise, muted struck MRP.
8. Offer stickers: scalloped/circular badges, notched coupons.
9. Full-width pill CTAs 52–56px, deep brand or near-black.
10. Fewer elements per screen (30–40% less than clone layouts).

### Style spec (synthesis)
- Colour roles: brand `#6C3CF4` (CTAs, active chip/dock, +, links); pressed `#5A2BE0`; brand tint `#EDE5FF`; ink/night `#1E1B4B` (headlines, dark chips, price); canvas `#F3E8FF`→`#FFFFFF` gradient; surface `#FFFFFF`; muted text `#6B6893`; hairline `#E9E3F7`; gold `#F5B524` / deep `#C98A00` / light `#FFF4D6` (offers/savings only, max one gold element per viewport, never CTAs); success `#16A34A`; MRP strike `#9C98B8`. Hero gradient `#6C3CF4→#8B5CF6` 135° with top-left radial highlight; night variant `#1E1B4B→#3B1F8F`.
- Type (Plus Jakarta Sans): display 32/38 800; h1 24/30 700; h2 18/24 700; body 14/20 500; caption 12/16 500; micro 10–11 700 uppercase +4% tracking; price 18/22 800 (PDP 28–32) with paise superscript at 60%; MRP 12 500 struck.
- Radii: chips 999; buttons 16 or pill; product card 20; image well 16; banners 24; sheets 28 top; dock 28.
- Shadows violet-tinted: cards `0 4 16 rgba(108,60,244,0.08)`; dock/FAB `0 12 32 rgba(30,27,75,0.18)`; prefer tint+border on dense grids.
- Imagery: cut-out packs on `#F7F3FF` image well with soft ellipse shadow, consistent scale.
- Chips: category tabs 36px pills (unselected white+hairline, selected night fill white text); sub-filters text tabs with 2px brand underline; category grid 72–80px rounded tiles on pastel tint.
- Nav dock: floating, 64px, 16px inset, white 92% + blur 20, radius 28; active expands to brand pill with icon+label; cart icon gold count badge.
- Product card: 1:1 image well r16; top-left badge; top-right heart; name 14/600 2 lines; weight muted 12; price row; bottom-right 32px ADD (white + brand border) → filled brand stepper; in-cart state = brand border + qty.
- Header: lavender→white gradient (night variant), bold ETA line, address + chevron, 48px white search pill with rotating placeholder.
- Illustration: soft 3D/clay style for empty states, offers, onboarding only.
- Motion: ADD→stepper 200ms spring, item flies to cart dock, dock pill slides between tabs, lavender shimmer skeletons, savings count-up, haptic stepper ticks, banner parallax.

### Avoid (dated)
Flat full-purple screens; grey drop shadows; 8px radii everywhere; boxed white cards with photo backgrounds; fixed edge-to-edge tab bar with labels under every icon; gold/yellow CTAs; rainbow category colours; dense clone layouts with 6+ badge styles; outline-icon-only categories; centred-logo headers; emoji in headings; all-caps body; default ripples; gradients beyond hero/CTA/canvas.

## Part B — Real shipped apps (App Store / Play Store screenshots, zepto.com / blinkit.com computed styles)

- **Zepto** (closest: purple brand). Lavender gradient header (~#D9C8FB→white) with bold "⚡6 minutes", address + chevron, profile; store tabs as white rounded tiles, selected tab merges into header like a folder tab; header re-themes per store. Search: white ~44px r12, rotating placeholder. Category icon tabs with 3px underline on active. Product card (measured): 140w, r10, image well 140×140 1px border r8, ADD 56×32 white + 1px brand border r8, 14/600, hard offset shadow `1px 1px 0`, sits bottom-right INSIDE image; price as filled pill + struck MRP; "₹24 OFF" in green; name 14/500 2 lines; weight 12 muted. Floating dark pill above tab bar for offers ("Unlock extra ₹50 OFF"). Tracking: map top 30%, sheet r24, "Arriving in **6 mins**" mixed weights with big purple number, "On time" tag, 3D illustration.
- **Blinkit**: themed full-bleed header, ADD 66×32 tinted fill + 1px border r6 overlapping image bottom-right; left rail of circular thumbs + 2-col grid; 3D objects on gradient tiles r16.
- **Instamart**: header re-colours per section; "+" square at image top-right; black pill "View all" CTA.
- **FirstClub** (premium benchmark): serif section headings, warm stone background, editorial photo tiles with overlaid text, freshness chips, minimal discount noise.
- **Getir** (purple + yellow/gold): purple app bar, gold "ETA 9 min" block, 4-col grey category tiles, raised purple centre basket button, 3D gold coins for rewards.
- **Weee!**: circular category icons, navy active chip, discount pill overhanging image top-left, white circular "+" bottom-right, 4-dot tracking stepper.
- **Instacart**: borderless images, filled green circular "+" overlapping image top-right, big deal price on highlight, full-width pill CTA, sheets r20, 4-icon progress line.
- **Flink**: price ABOVE name, round "+" overlapping image, ETA pill in header, Material-3 pill behind active tab icon.
- **Picnic**: warm off-white bg, sticky stepper + CTA bar. **BigBasket**: Now/Later segmented toggle, "You're saving ₹490" strip. **JioMart**: green "Your total savings" band ending the bill, "Free delivery unlocked" progress card.

## Part C — FINAL DECISIONS (where sources disagree, this wins)

1. **Palette roles**: brand violet `#6C3CF4` = actions (CTAs, ADD, active states, links). Night indigo `#1E1B4B` = headings/price ink, selected category chips, floating cart pill, dark hero variant. Lavender `#F3E8FF`/`#EDE5FF` = header gradient, image wells, selected tiles, canvas wash. Gold `#F5B524` (ink `#8A5A00` on light `#FFF4D6`) = offers/savings/membership ONLY, max one gold element per viewport. Green `#16A34A`-ish = savings amounts, "FREE", veg mark, success ONLY. No yellow anywhere.
2. **Home header**: lavender→white gradient (Zepto), bold "⚡ 10 minutes" 24–28/800 in night, address 13/500 + chevron, avatar; sticky 48px white search r14 + hairline + rotating placeholder + mic; category icon tabs with 3px violet underline; header re-tints per category with pastel tints (not saturated). Optional single gold chip (e.g. "FREE delivery above ₹200").
3. **Navigation**: floating pill dock (modern) — 64px, 16px inset, white 92% + blur, r28, violet-tinted shadow; active item = lavender pill behind filled violet icon + label (Flink/M3), inactive icon-only outline in muted; cart count badge gold.
4. **Product card**: white card r16, no shadow on dense grids (hairline instead); square image well on lavender-grey `#F6F4FB` r14 with product filling ~85% of the well; discount pill top-left (green "₹24 OFF" or gold), heart top-right; ADD 64×32 white + 1.5px violet border r10 13/700 violet with a 1px hard offset violet shadow, positioned bottom-right overlapping the image edge; morphs into filled violet stepper same footprint; below image: price 16/800 night + struck MRP 12 muted, then name 13/500 2 lines, weight + "⚡ 10 mins" 12 muted. In-cart state: violet hairline border on the card.
5. **Floating cart pill**: night indigo, r18, 56px, above dock; stacked thumbs + "3 items · ₹349" + "View cart ›" in white; gold progress line above for free delivery.
6. **Typography**: Plus Jakarta Sans; 800 for ETA/hero numbers/prices, 700 headings, 500 names, 400 meta; mixed-weight headlines on Home sections/Offers/Tracking ("Fresh picks for **you**", "Arriving in **8 mins**").
7. **Category listing**: 76px left rail of 48px circular thumbs on lavender, active = white bg + 3px violet left bar; 2-col grid, 8–10px gaps; filter/sort chips (selected = night fill).
8. **PDP**: full-bleed image on lavender well with dots, white sheet r24 overlaps; chips row; name 20/700; price 28/800 + savings tag; accordions; similar rail; sticky footer stepper + 52px violet CTA r14.
9. **Checkout**: grouped white cards r16 on canvas; "Delivering in 9 mins" + gold free-delivery progress; 56px thumbs + compact stepper; coupon card; bill ending in green "You saved ₹X" band; sticky footer address strip + total + violet slide-to-pay.
10. **Tracking**: map 40%, sheet r24, "Arriving in **8 mins**" (number 34/800 violet), "On time" green tag, 4-icon progress line, partner row, summary, help.
11. **Profile**: night hero card with name/phone + gold coins/member tile; grouped lists with 20px icons in lavender circles.
12. **Login/Onboarding**: full-bleed violet→indigo gradient with mascot/3D illustration, white bottom sheet r24 with +91 field 52px r12 and violet CTA; OTP boxes 48px with violet focus ring.
13. **Imagery/illustration**: cut-out packshots consistently scaled; soft 3D/clay mascot for empty/offers/onboarding only.
14. **Shadows**: violet-tinted only (`rgba(108,60,244,0.08)` cards, `rgba(30,27,75,0.18)` floating). Prefer hairline + tint on dense grids.
