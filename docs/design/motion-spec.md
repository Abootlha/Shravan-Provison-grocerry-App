# Motion & transition spec — customer app

Goal: the app should feel **fluid everywhere** — every state change is continuous, nothing pops, nothing blocks. 60fps on mid-range Android. Primitives live in `customer-app/components/ui` and `theme/motion.js` (see README).

## Principles
1. **Continuity over decoration.** Motion explains where things came from and went (spatial origin), never just "looks cool".
2. **Springs for anything interactive or interruptible**; timing curves only for opacity fades ≤200ms. Every animation must be interruptible (re-tap, back gesture, scroll mid-animation).
3. **UI thread only**: reanimated worklets, `transform` + `opacity` (+ colour via interpolateColor). Never animate width/height/top/left on the JS thread. Use reanimated Layout Animations for size/position changes.
4. **Fast**: taps respond < 100ms; press feedback 80–120ms; enter 200–350ms; screen push 300–350ms; exits faster than enters (~70%).
5. **Small distances**: entrances move 8–16px, not whole screens. Scale presses 0.96–0.98.
6. **Reduced motion**: every animation has a fade/instant fallback (`useReducedMotion`).
7. **Haptics** sparingly: selection (tabs, chips), light (add/stepper), success (order placed), warning (error/shake).
8. **Never block input or navigation** on an animation.

## Global
- **Screen transitions** (AppNavigator): native-stack `animation: 'slide_from_right'` (iOS-style) on both platforms with full-width back gesture; `ProductDetail` uses the hero shared-element + 260ms fade (already built); modals/sheets (address, payment, filters) use bottom sheets, not pushed screens; auth flow screens use a horizontal slide with shared logo position; tab switches: content crossfade 150ms + 8px rise (no slide).
- **Screen enter**: `useScreenEnter`/`AnimatedScreen` — first-mount content opacity 0→1 + 8px rise; lists stagger first 8 items (35ms) then render instantly.
- **Loading → content**: `ContentSwap` crossfade from skeleton (never spinner → pop). Same for empty/error states.
- **Headers**: every stack screen with scrolling content uses `useCollapsibleHeader` (large title collapses into compact bar; hairline + blur fade in).
- **Press**: `PressableScale` for cards/buttons/chips; `PressableHighlight` (tint fade) for list rows.
- **Lists**: insert/remove use Layout Animations (FadeIn/FadeOut + LinearTransition spring) so neighbours slide instead of jumping.
- **Keyboard**: footers, sheets and forms ride the keyboard with `useKeyboardSpring`.
- **Numbers**: prices, totals, counts, ETA always roll (RollingNumber) when they change.
- **Toasts/snackbars**: spring in from bottom above the dock/cart pill, swipe to dismiss.

## Per screen
- **Splash → Onboarding/Home**: logo scales from splash position into the onboarding/login header (shared position), gradient crossfades.
- **Onboarding**: story slides — art parallax (art 1.0x, text 0.6x) on swipe; story bar fills; CTA fill progress.
- **Login → OTP**: sheet content slides left, hero stays; OTP boxes pop in staggered; focus ring springs; error shake + haptic; success → boxes turn green then screen transitions.
- **Home**: header collapse (done); category tab underline spring (done); category switch = header tint crossfade + content crossfade/rise (done — verify); rails lazy-enter on first scroll (done); banner parallax (done); fly-to-cart (done); pull-to-refresh mascot (native).
- **Categories / listing**: rail indicator spring (done); switching subcategory crossfades grid with 6px rise, grid items stagger; sort chip change reorders with LinearTransition.
- **Product card**: press scale; heart pop + particle burst on wishlist; ADD→stepper morph (done); out-of-stock desaturate.
- **PDP**: hero shared element (done); gallery swipe with spring + dots morph; header solidifies on scroll via `useCollapsibleHeader`; accordions spring height via Layout Animation; sticky footer slides up on enter; add → stepper morph + fly to button target (done).
- **Search**: input focus — search bar expands from Home's bar position (shared position), suggestions stagger in, results crossfade; recent chip delete with layout transition.
- **Cart/Checkout**: row add/remove with layout transitions (neighbours slide); swipe-to-delete rows (`SwipeableRow`); bill numbers roll; free-delivery bar fills with spring + green morph at unlock + confetti (done); sheets spring; slide-to-pay (done); payment overlay: gradient fades in, check draws, confetti, ETA chip rises (done — verify sequencing).
- **Tracking**: map card expand spring (done); rider marker interpolation (done); ETA rolls; progress line fills between steps with spring; status change → header copy crossfade + haptic; OTP card digits flip-in.
- **Orders**: filter change crossfade + LinearTransition; cards stagger; order details sections enter staggered.
- **Profile**: header parallax/collapse; rows PressableHighlight; theme toggle segmented control with sliding thumb; language change crossfades text.
- **Address/Location**: pin lift/drop (done); suggestions stagger; saved address swipe actions; form fields focus spring; save button loading→check.
- **Empty states**: mascot idle bob (done) + content rise.

## QA checklist (each screen)
- [ ] No element appears/disappears without a transition.
- [ ] Back gesture works mid-animation; re-tap mid-animation doesn't break state.
- [ ] Reduced motion: fades only.
- [ ] Dark & light both correct during animations (interpolateColor uses theme values).
- [ ] Profile on device: no dropped frames on scroll (Perf monitor), no JS-thread animation.
