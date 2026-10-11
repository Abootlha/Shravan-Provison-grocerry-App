/**
 * FlyToCart — the "item flies into the cart" moment (Shop / Blinkit pattern).
 *
 * When ADD is tapped, a copy of the pack shot lifts off its card, shrinks and arcs along a
 * quadratic bezier into the cart target (the FloatingCartBar thumbnail stack when it's on
 * screen, otherwise the cart icon in the floating dock, otherwise the PDP's cart CTA). On
 * landing the target does a springy bump, the count rolls and a light haptic ticks.
 *
 *   <FlyToCartProvider>…app…</FlyToCartProvider>              // App.js, once, inside the navigator container
 *
 *   const fly = useFlyToCart();
 *   fly({ fromRef: wellRef, uri: product.image });             // fire-and-forget; dispatch right after
 *                                                               // (uri: URL string or a require()d asset;
 *                                                               //  inset: image inset in the source, 0.08)
 *
 *   const bump = useCartTarget(ref, { priority: 2, enabled });  // on the target view:
 *   <Animated.View ref={ref} style={bump}>…</Animated.View>
 *
 *   const shown = useFlightDeferred(value);                     // hold a displayed value (cart count,
 *                                                               // thumbnails) until the flight lands
 *
 * Rules it follows (README §3):
 *   - One shared progress value per flight drives translate / scale / opacity on the UI thread.
 *   - Never blocks the cart update: fly() returns immediately; measuring happens async.
 *   - At most 3 flights at once; extra taps skip the flight and just bump the target.
 *   - Reduced motion: no flight, only a small bump on the target.
 *   - Targets only count when their screen is focused and they are on screen; priority wins
 *     (cart bar 3 > dock 2 > PDP CTA 1), so a covered dock never steals a flight.
 *   - Works on web (measureInWindow → getBoundingClientRect) and native.
 *
 * Path: P0 = source centre, P2 = target centre, control point lifted above both (min y − 96)
 * and 30% of the way across, so the item hops up first and drops into the target. Travel uses
 * a soft-start, strong-finish curve (no ease-in), 520 ms; scale lifts to 1.06 in the first
 * 15% (the "pick up"), then shrinks to the target's size; corners round off into a circle;
 * opacity fades over the final 12% as the target bumps.
 */
import React, { createContext, forwardRef, memo, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { radii, z } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { springs, easings, signature } from '../../theme/motion';
import { haptic } from './haptics';
import { measureRect, insetRect, onScreen, useLatestFocus } from './motionUtils';

const WEB = Platform.OS === 'web';
const MAX_FLIGHTS = signature.flight.maxConcurrent;
const DURATION = signature.flight.duration;
const LIFT = signature.flight.lift;
/** Travel curve: half smoothstep, half ease-out-cubic. Starts moving at once (slope 1.5, never
 *  ease-in), decelerates into the target. A plain worklet so one progress value drives it all. */
function travel(t) {
    'worklet';
    const smooth = t * t * (3 - 2 * t);
    const out = 1 - (1 - t) * (1 - t) * (1 - t);
    return smooth * 0.5 + out * 0.5;
}
const RELEASE_FALLBACK = 1200; // held values are always released by then

const FlyContext = createContext(null);

/* ------------------------------------------------------------------ flight slot */

const FlightSlot = memo(
    forwardRef(function FlightSlot(_props, ref) {
        const [uri, setUri] = useState(null);
        const styles = useStyles();
        const { colors } = useTheme();
        const p = useSharedValue(0);
        // All geometry for one flight in ONE shared value, written atomically, so the UI thread
        // never renders a frame with half-updated coordinates. null = idle (hidden).
        const geo = useSharedValue(null);

        useImperativeHandle(ref, () => ({
            launch({ from, to, uri: u, onLand }) {
                const size = Math.max(1, Math.min(from.width, from.height)); // only ever scale DOWN
                const sx = from.x + from.width / 2;
                const sy = from.y + from.height / 2;
                const tx = to.x + to.width / 2;
                const ty = to.y + to.height / 2;
                setUri(u || null);
                cancelAnimation(p);
                p.value = 0;
                geo.value = {
                    size,
                    sx,
                    sy,
                    tx,
                    ty,
                    cx: sx + (tx - sx) * 0.3,
                    cy: Math.min(sy, ty) - LIFT,
                    end: Math.max(0.12, (Math.min(to.width, to.height) * 0.9) / size),
                };
                p.value = withTiming(1, { duration: DURATION, easing: easings.linear }, (finished) => {
                    geo.value = null;
                    if (onLand) scheduleOnRN(onLand, !!finished);
                });
            },
        }));

        const style = useAnimatedStyle(() => {
            const g = geo.value;
            if (!g) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }, { scale: 1 }] };
            // clamp: on web the first timing frame can report a slightly negative progress
            const raw = Math.min(1, Math.max(0, p.value));
            // travel on an eased clock; lift/shrink on the raw clock so the pick-up reads first
            const t = travel(raw);
            const u = 1 - t;
            const x = u * u * g.sx + 2 * u * t * g.cx + t * t * g.tx;
            const y = u * u * g.sy + 2 * u * t * g.cy + t * t * g.ty;
            const s = interpolate(raw, [0, 0.15, 1], [1, signature.flight.liftScale, g.end], 'clamp');
            const half = g.size / 2;
            return {
                opacity: interpolate(raw, [0, 0.05, 0.88, 1], [0.9, 1, 1, 0], 'clamp'),
                borderRadius: interpolate(raw, [0.2, 0.85], [radii.md, half], 'clamp'),
                width: g.size,
                height: g.size,
                transform: [{ translateX: x - half }, { translateY: y - half }, { scale: s }],
            };
        });

        return (
            <Animated.View testID="fly-to-cart-flight" style={[styles.flight, style, { pointerEvents: 'none' }]}>
                {uri ? (
                    <Image source={typeof uri === 'string' ? { uri } : uri} style={[styles.flightImg, WEB && colors.imageBlend === 'multiply' && styles.webBlend]} contentFit="contain" cachePolicy="memory-disk" transition={0} accessible={false} />
                ) : null}
            </Animated.View>
        );
    }),
);

/* ------------------------------------------------------------------ provider */

export function FlyToCartProvider({ children }) {
    const reduce = useReducedMotion();
    const styles = useStyles();
    const win = useWindowDimensions();
    const winRef = useRef(win);
    winRef.current = win;
    const reduceRef = useRef(reduce);
    reduceRef.current = reduce;

    const targets = useRef(new Map()); // id -> { ref, priority, enabled, isFocused, bump }
    const slots = useRef([]);
    const busy = useRef([false, false, false]);
    const pending = useRef(0); // flights requested but not landed (includes measuring)
    const listeners = useRef(new Set());
    const origin = useRef({ x: 0, y: 0 });
    const overlayRef = useRef(null);
    const fallbackTimer = useRef(null);

    const emit = useCallback(() => {
        listeners.current.forEach((fn) => fn());
    }, []);

    const settle = useCallback(() => {
        pending.current = Math.max(0, pending.current - 1);
        emit();
    }, [emit]);

    const pickTarget = useCallback(async () => {
        const list = [...targets.current.values()]
            .filter((t) => t.enabled && t.isFocused())
            .sort((a, b) => b.priority - a.priority);
        for (const t of list) {
            const rect = await measureRect(t.ref);
            if (rect && onScreen(rect, winRef.current)) return { target: t, rect };
        }
        return null;
    }, []);

    const fly = useCallback(
        ({ fromRef, uri, inset = 0.08 } = {}) => {
            pending.current += 1;
            // Safety net: whatever happens, held values are released.
            clearTimeout(fallbackTimer.current);
            fallbackTimer.current = setTimeout(() => {
                if (pending.current > 0) {
                    pending.current = 0;
                    emit();
                }
            }, RELEASE_FALLBACK);

            (async () => {
                const picked = await pickTarget();
                if (!picked) {
                    settle();
                    return;
                }
                const { target, rect: to } = picked;
                const slotIndex = busy.current.findIndex((b) => !b);
                const from = reduceRef.current || slotIndex < 0 ? null : insetRect(await measureRect(fromRef), inset);
                if (!from || !onScreen(from, winRef.current) || !slots.current[slotIndex]) {
                    // reduced motion, too many flights, or the source scrolled away: just bump
                    target.bump();
                    haptic.light();
                    settle();
                    return;
                }
                busy.current[slotIndex] = true;
                const o = origin.current;
                slots.current[slotIndex].launch({
                    from: { ...from, x: from.x - o.x, y: from.y - o.y },
                    to: { ...to, x: to.x - o.x, y: to.y - o.y },
                    uri,
                    onLand: () => {
                        busy.current[slotIndex] = false;
                        const live = targets.current.get(target.id);
                        if (live) live.bump();
                        haptic.light();
                        settle();
                    },
                });
            })().catch(() => settle());
        },
        [pickTarget, settle, emit],
    );

    const register = useCallback((entry) => {
        targets.current.set(entry.id, entry);
        return () => targets.current.delete(entry.id);
    }, []);

    const subscribe = useCallback((fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
    }, []);

    const isFlying = useCallback(() => pending.current > 0, []);

    useEffect(() => () => clearTimeout(fallbackTimer.current), []);

    const onOverlayLayout = useCallback(() => {
        measureRect(overlayRef).then((r) => {
            if (r) origin.current = { x: r.x, y: r.y };
        });
    }, []);

    const value = useMemo(() => ({ fly, register, subscribe, isFlying }), [fly, register, subscribe, isFlying]);

    return (
        <FlyContext.Provider value={value}>
            {children}
            <View ref={overlayRef} onLayout={onOverlayLayout} style={[styles.overlay, { pointerEvents: 'none' }]} collapsable={false}>
                {Array.from({ length: MAX_FLIGHTS }, (_, i) => (
                    <FlightSlot
                        key={i}
                        ref={(r) => {
                            slots.current[i] = r;
                        }}
                    />
                ))}
            </View>
        </FlyContext.Provider>
    );
}

/* ------------------------------------------------------------------ hooks */

const noop = () => {};

/** `fly({ fromRef, uri, inset? })` — fire-and-forget. No-op without a provider. */
export function useFlyToCart() {
    const ctx = useContext(FlyContext);
    return ctx ? ctx.fly : noop;
}

let targetSeq = 0;

/**
 * Register a view as a cart target. Returns an animated style (the landing bump) to put on that
 * same view. `priority`: 3 cart bar, 2 dock, 1 PDP CTA (higher wins when several are on screen).
 */
export function useCartTarget(ref, { priority = 1, enabled = true } = {}) {
    const ctx = useContext(FlyContext);
    const reduce = useReducedMotion();
    const isFocused = useLatestFocus();
    const scale = useSharedValue(1);
    const idRef = useRef(null);
    if (idRef.current == null) idRef.current = `t${++targetSeq}`;

    const bump = useCallback(() => {
        const peak = reduce ? 1.05 : 1.16;
        scale.value = withSequence(
            withTiming(peak, { duration: 90, easing: easings.out }),
            withSpring(1, reduce ? springs.snappy : springs.bouncy),
        );
    }, [reduce]);

    useEffect(() => {
        if (!ctx) return undefined;
        return ctx.register({ id: idRef.current, ref, priority, enabled, isFocused, bump });
    }, [ctx, ref, priority, enabled, isFocused, bump]);

    return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/**
 * Display `value` as it was before the current flight(s) and switch to the latest value when a
 * flight lands (or immediately when nothing is flying). Use for counts / thumbnails at the target
 * so they change on impact, not on tap.
 */
export function useFlightDeferred(value) {
    const ctx = useContext(FlyContext);
    const held = useRef(value);
    const latest = useRef(value);
    latest.current = value;
    const [, force] = useState(0);

    useEffect(() => {
        if (!ctx) return undefined;
        return ctx.subscribe(() => {
            if (held.current !== latest.current) {
                held.current = latest.current;
                force((n) => n + 1);
            }
        });
    }, [ctx]);

    if (!ctx || !ctx.isFlying()) {
        held.current = value;
        return value;
    }
    return held.current;
}

const useStyles = makeStyles((t) => ({
    overlay: { ...StyleSheet.absoluteFill, zIndex: z.max, elevation: 30 },
    flight: {
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'hidden',
        backgroundColor: t.colors.imageWell,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    flightImg: { position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '8%' },
    webBlend: { mixBlendMode: 'multiply' },
}));

export default FlyToCartProvider;
