# DESIGN.md — Shravan Kirana customer app

This file is the source of truth for visual decisions. It supersedes the colour/decoration parts of `redesign-research.md` Part C (layout, anatomy and motion choices there still stand).

## Identity
Shravan is a neighbourhood kirana that delivers fast. The product is **groceries** — the colour on screen should come from the **products themselves** (packs, produce), not from the UI. The UI is a calm, confident, neutral frame with **one brand colour, violet**, used where the user acts.

Reference feel: Zepto/Blinkit's density and speed, Apple/FirstClub's restraint. Not: Dribbble concept shots with gradients and glow.

## Colour (light)
| Role | Value | Use |
|---|---|---|
| canvas | `#F5F5F3` | app background (warm neutral, never lavender) |
| surface | `#FFFFFF` | cards, sheets, header, dock |
| sunken / image well | `#F2F2F0` | product image wells, inputs, skeleton bones |
| ink | `#151515` | headings, prices |
| ink secondary | `#555555` | body |
| ink muted | `#6B6B6B` | meta (≥4.5:1 on canvas) |
| hairline | `#E6E6E3` | card borders, dividers |
| **brand violet** | `#6C3CF4` | primary buttons, ADD/stepper, active tab, links, selected states, focus ring. Nothing else. |
| brand pressed | `#5A2BE0` | pressed state |
| brand tint | `#F1ECFE` | the ONE tint: selected chip/row background only |
| savings green | `#0C831F` (text) / `#E8F5EA` (tint) | discount amounts, "You saved", FREE delivery, veg mark |
| error | `#C62828` | errors, destructive |

Removed: indigo/night surfaces, lavender washes, gold, pastel category tints (peach/sky/rose/mint/lilac), blue offer badges, all decorative gradients.
Dark surfaces for floating elements (cart pill, toasts) use **ink `#151515`**, not indigo.

## Colour (dark)
Neutral, not purple: canvas `#0F0F0F`, surface `#1A1A1A`, raised `#232323`, image well `#202020`, hairline `rgba(255,255,255,0.08)`, ink `#F2F2F2`, secondary `#B3B3B3`, muted `#8F8F8F`. Brand fill `#7754F5` (white text ≥4.5:1), brand text `#A68BFF`, savings `#4CC26A`. Cart pill/toasts use raised `#232323` + hairline.

## Gradients, glass, glow, shadow (dose caps)
- **Gradients: none**, except a functional legibility scrim (transparent→black ≤40%) under text on photography.
- **Glass/blur: max 2 uses** — round buttons floating over photos/maps (PDP back/share/heart, map controls). Everything else solid.
- **Glow: none.**
- **Shadow: one elevation level, only for things that float above content** (dock, cart pill, active-order bar, sheets, toasts): `0 4 16 rgba(0,0,0,0.08)` light / hairline + `rgba(0,0,0,0.4)` dark. Cards are flat with a hairline.

## Shape
Radii: cards 12, image wells 10, buttons 10, inputs 10, chips 8, sheets 16 (top), dock 18. **No pill shapes** except the ADD/stepper (keeps its compact rounded rect 8) and avatar circles.

## Typography
Plus Jakarta Sans for everything (UI, body, prices — tabular nums). Bricolage Grotesque only for the 2–3 largest headings per screen (screen titles, Home ETA), never for small text. Mixed-weight headlines only on the Home hero line and the tracking ETA — not every section title. No uppercase wide-tracked micro labels; use sentence case 12/600.

## Icons & illustration
- Icons: one consistent set, relevant glyphs only. ETA uses a clock/scooter glyph — **no lightning bolts**, sparkles, stars-as-decoration.
- Fluent 3D food icons: only where they identify a category (category tabs, category tiles without photos). No floating sticker clusters.
- Mascot: only on empty/error/unserviceable states, static, with a single entrance animation. Not on login/onboarding/loading spinners.
- No emoji in UI copy.

## Motion
Trigger-based only (tap, scroll, navigation, data change). **No endless loops** (no idle bob, float, pulse, looping scooter, glowing dots). Skeleton shimmer is allowed only while loading. Keep: screen transitions, fly-to-cart, hero image, ADD→stepper, rolling numbers, header collapse, list layout transitions, sheet springs.

## Surfaces per screen (summary)
- Home header: solid surface (white / dark surface), no gradient; per-category re-tint removed — the selected tab indicator (violet underline) is the only state colour.
- Banners: real product photography on a flat neutral or flat brand-violet block; legibility scrim only if text sits on the photo.
- Auth/onboarding: white (dark: canvas) screens with the logo, a clear headline, real product photography; no gradient backgrounds.
- Payment success: surface background, violet check, one confetti burst.
- Tracking: map + surface sheet; status header is surface with ink text and a violet ETA number.
