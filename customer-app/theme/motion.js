/**
 * Motion tokens for react-native-reanimated (v4). All interactive motion uses springs;
 * timing curves are only for the rare non-interactive cases listed under `durations`.
 *
 *   import { springs, durations, easings, press, stagger } from '../theme/motion';
 *   scale.value = withSpring(press.scale, springs.snappy);
 *
 * Which spring?
 *   snappy  – press feedback, toggles, chips, steppers. Settles in ~180ms, no visible overshoot.
 *   gentle  – content entering/morphing (cards, list items, progress). Calm, ~350ms.
 *   bouncy  – celebratory or count changes (badge bump, success check). Visible overshoot.
 *   sheet   – sheets/toasts/drawers that travel far. Critically-damped feel, iOS-like.
 *   drag    – snap-back after a gesture release (slide-to-confirm, swipe-to-dismiss).
 *
 * Reduced motion: every primitive calls `useReducedMotion()` and drops translate/scale
 * motion (keeping opacity/colour changes). Pass `reduceMotion: ReduceMotion.System`
 * (the default) so Reanimated also honours the OS setting for raw withSpring calls.
 */
import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, withDelay, withSpring, withTiming } from 'react-native-reanimated';

const WEB = Platform.OS === 'web';

export const springs = {
    snappy: { damping: 20, stiffness: 380, mass: 0.7 },
    gentle: { damping: 22, stiffness: 170, mass: 1 },
    bouncy: { damping: 11, stiffness: 260, mass: 0.75 },
    sheet: { damping: 30, stiffness: 300, mass: 1 },
    drag: { damping: 24, stiffness: 260, mass: 0.9 },
};

/**
 * Durations (ms) for opacity fades and colour cross-fades. There are NO idle loops in this app
 * (DESIGN.md "Motion"): the only repeating motion is the skeleton shimmer while data loads and the
 * functional search-hint rotation.
 */
export const durations = {
    instant: 90,
    fast: 160,
    base: 220,
    slow: 320,
    shimmer: 1300, // skeleton bones only, and only while loading
    toast: 2800, // how long a toast stays up
    rotate: 3000, // RotatingPlaceholder interval (functional hint rotation, kept calm)
};

/** Custom curves — never use Easing.linear for UI (except constant loops) and never ease-in. */
export const easings = {
    out: Easing.bezier(0.23, 1, 0.32, 1), // strong ease-out: entering, fades
    inOut: Easing.bezier(0.77, 0, 0.175, 1), // on-screen morphs
    drawer: Easing.bezier(0.32, 0.72, 0, 1), // iOS drawer curve
    linear: Easing.linear, // shimmer / spinners only
};

/** Press-in scale targets. */
export const press = {
    scale: 0.96, // buttons, chips, icon buttons
    subtle: 0.98, // large cards and tiles (big surfaces need less)
    deep: 0.92, // tiny targets like the add stepper +/- glyphs
};

/** List entrance stagger. Items past `maxItems` enter together with the last delay. */
export const stagger = {
    delay: 35,
    maxItems: 8,
    offsetY: 12,
};

/**
 * Delay (ms) for list item `index`: items past `maxItems` share the last delay, so item 40 never
 * waits. Use with withDelay / useStaggeredEntrance / layout.enterAt(index).
 */
export const staggerDelay = (index = 0, { delay = stagger.delay, maxItems = stagger.maxItems } = {}) =>
    Math.min(Math.max(index, 0), maxItems) * delay;

/**
 * Screen transition specs for native-stack `options` / `screenOptions` (spread them in).
 * animationDuration is honoured on iOS; Android uses the platform's ~300ms curve; web fades/slides via CSS.
 *   push   — default stack push (iOS-style slide, full-width back gesture)        320ms
 *   fade   — card → PDP (the hero image is the only thing that travels)          260ms
 *   modal  — bottom-up for full-screen flows that are not sheets                  340ms
 *   auth   — horizontal slide within the auth flow (logo position is shared)     320ms
 *   none   — instant (replace after splash)
 * Tab switches don't slide: wrap the tab screen body in <AnimatedScreen replayOnFocus> (150ms crossfade + 8px rise).
 */
export const transitions = {
    push: { animation: 'slide_from_right', animationDuration: 320, gestureEnabled: true, fullScreenGestureEnabled: true },
    fade: { animation: 'fade', animationDuration: 260 },
    modal: { animation: 'slide_from_bottom', animationDuration: 340, gestureEnabled: true },
    auth: { animation: 'slide_from_right', animationDuration: 320 },
    none: { animation: 'none' },
};

const gentle = (b) => b.damping(springs.gentle.damping).stiffness(springs.gentle.stiffness).mass(springs.gentle.mass);

// Custom entering/exiting worklets are native-only (Reanimated web runs only the predefined
// presets and warns on custom worklets), so every preset below has a web-safe fallback.
const riseIn = (offsetY) => {
    const fn = () => {
        'worklet';
        return {
            initialValues: { opacity: 0, transform: [{ translateY: offsetY }] },
            animations: {
                opacity: withTiming(1, { duration: durations.base, easing: easings.out }),
                transform: [{ translateY: withSpring(0, springs.gentle) }],
            },
        };
    };
    return fn;
};
const slideOutLeft = () => {
    'worklet';
    return {
        initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
        animations: {
            opacity: withTiming(0, { duration: durations.fast, easing: easings.out }),
            transform: [{ translateX: withTiming(-24, { duration: durations.fast, easing: easings.out }) }],
        },
    };
};

/**
 * Layout Animation presets — pass to <Animated.View entering / exiting / layout>.
 *   layout.enter        8px rise + fade (native worklet; web: 220ms fade)      — content appearing
 *   layout.enterDown    FadeInDown spring (from above; banners, inline errors)  — web: preset works too
 *   layout.enterAt(i)   layout.enter delayed by staggerDelay(i) (first 8 items)
 *   layout.exit         160ms fade (exits are faster than entrances)
 *   layout.exitLeft     fade + 24px slide left (removed rows; web: fade)
 *   layout.list         LinearTransition spring — neighbours slide when an item is inserted/removed
 * All of them respect the OS reduced-motion setting (Reanimated's ReduceMotion.System default).
 */
export const layout = {
    enter: WEB ? FadeIn.duration(durations.base) : riseIn(8),
    enterDown: gentle(FadeInDown.springify()),
    enterAt: (index) => (WEB ? FadeIn.duration(durations.base).delay(staggerDelay(index)) : riseInDelayed(index)),
    exit: FadeOut.duration(durations.fast),
    exitLeft: WEB ? FadeOut.duration(durations.fast) : slideOutLeft,
    list: gentle(LinearTransition.springify()),
};

function riseInDelayed(index) {
    const d = staggerDelay(index);
    return () => {
        'worklet';
        return {
            initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
            animations: {
                opacity: withDelay(d, withTiming(1, { duration: durations.base, easing: easings.out })),
                transform: [{ translateY: withDelay(d, withSpring(0, springs.gentle)) }],
            },
        };
    };
}

/**
 * Signature moments (components/ui/FlyToCart.js, HeroTransition.js, BannerCarousel). Rare,
 * authored motion — don't reuse these for routine UI.
 */
export const signature = {
    flight: { duration: 520, lift: 96, liftScale: 1.06, maxConcurrent: 3 }, // fly-to-cart hop
    hero: { damping: 28, stiffness: 240, mass: 1, energyThreshold: 2e-5 }, // card → PDP (~420 ms)
    heroFade: 120, // overlay → real image crossfade
    parallax: { art: 0.15, copy: 0.05, artPan: 0.1, copyPan: -0.04, overscale: 1.12 },
};

export const motion = { springs, durations, easings, press, stagger, staggerDelay, signature, transitions, layout };
export default motion;
