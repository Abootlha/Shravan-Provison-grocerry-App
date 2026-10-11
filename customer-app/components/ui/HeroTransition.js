/**
 * HeroTransition — the product image travels from its card into the PDP hero (and back on pop).
 *
 * Why not Reanimated's sharedTransitionTag: in the installed reanimated 4.5.1 shared element
 * transitions sit behind the static feature flag ENABLE_SHARED_ELEMENT_TRANSITIONS (default
 * false), are native-only and still flagged experimental with native-stack. So this is a manual
 * "hero" overlay that behaves the same on web, iOS and Android:
 *
 *   1. tap: the card calls hero.start({ fromRef, uri, matchKey, sourceKey }) and navigates in
 *      the same tick (navigation is never delayed). The source rect is measured async and an
 *      overlay copy of the pack shot is placed exactly over the card image, which is hidden.
 *   2. the PDP (ProductDetail uses a fade transition) claims the flight synchronously on its first
 *      render with useHeroTarget(matchKey) — so its hero image is hidden from frame one, no flash —
 *      and reports the hero rect from onLayout.
 *   3. one progress value springs 0 → 1 (springs.sheet); translate + scale interpolate between
 *      the two rects on the UI thread. Uniform scale only ever goes DOWN from the hero size, so
 *      the bitmap is never upscaled (no blur).
 *   4. crossfade: once landed AND the PDP image has decoded (max 450 ms wait), the real image is
 *      revealed under the overlay and the overlay fades out in 120 ms. Identical pixels, no pop.
 *   5. pop (back button, hardware back, swipe): the PDP calls reverse(); the progress springs
 *      back to 0 from wherever it is (interruptible mid-flight), landing on the card's current rect.
 *      If the hero was scrolled off screen or the card is gone, it gracefully does nothing and the
 *      screen just fades.
 *
 * Reduced motion: no overlay at all; the screen cross-fade carries the change.
 *
 *   <HeroTransitionProvider>…</HeroTransitionProvider>               // App.js, once
 *
 *   // source (ProductCard)
 *   const hero = useHeroTransition();
 *   const hideStyle = useHeroSourceStyle(sourceKey);                 // on the card image wrapper
 *   hero.start({ fromRef: wellRef, uri, matchKey: productId, sourceKey });
 *
 *   // destination (PDP)
 *   const target = useHeroTarget(productId);
 *   <Animated.View ref={target.ref} onLayout={target.onLayout} style={target.style}>
 *     <ProductImage … onLoad={target.onLoad} />
 *   </Animated.View>
 *   navigation.addListener('beforeRemove', target.reverse);
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { z } from '../../constants/theme';
import { useTheme } from '../../theme';
import { durations, easings, signature } from '../../theme/motion';
import { measureRect, measureRectSync, insetRect, onScreen } from './motionUtils';

const WEB = Platform.OS === 'web';
const CLAIM_WINDOW = 1200; // a PDP must mount within this long after the tap to claim the hero
const CLAIM_TIMEOUT = 400; // no PDP claimed the flight → abort
const LOAD_GRACE = 450; // max wait for the PDP image to decode before crossfading anyway
// ~420 ms, imperceptible overshoot; settles (and hands over) once within ~0.5% of the target
const HERO_SPRING = signature.hero;
const CARD_INSET = 0.08; // ProductImage card inset
const HERO_INSET = 0.1; // ProductImage hero inset

const HeroContext = createContext(null);

const nextFrames = (n) =>
    new Promise((resolve) => {
        const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
        step(n);
    });

export function HeroTransitionProvider({ children }) {
    const reduce = useReducedMotion();
    // multiply melts white packshot backgrounds into the light well; on the dark well it would black them out
    const { colors: themeColors } = useTheme();
    const blend = WEB && themeColors.imageBlend === 'multiply';
    const win = useWindowDimensions();
    const winRef = useRef(win);
    winRef.current = win;

    const [uri, setUri] = useState(null);
    const flight = useRef(null); // { id, matchKey, sourceKey, fromRef, uri, at, status, from, to, loaded, landed }
    const seq = useRef(0);
    const origin = useRef({ x: 0, y: 0 });
    const overlayRef = useRef(null);
    const timers = useRef([]);

    // UI-thread state
    const p = useSharedValue(0);
    const o = useSharedValue(0);
    const box = useSharedValue(1); // overlay box size = the hero image size (we only scale down)
    const fx = useSharedValue(0);
    const fy = useSharedValue(0);
    const fs = useSharedValue(0);
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const ts = useSharedValue(0);
    const srcKey = useSharedValue('');
    const dstKey = useSharedValue('');

    const later = (fn, ms) => {
        const t = setTimeout(fn, ms);
        timers.current.push(t);
    };
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const finish = useCallback(() => {
        const f = flight.current;
        if (!f) return;
        f.status = 'done';
        // reveal both real images under the overlay, then fade the overlay
        srcKey.value = '';
        dstKey.value = '';
        o.value = withTiming(0, { duration: signature.heroFade, easing: easings.out });
    }, []);

    const abort = useCallback(() => {
        const f = flight.current;
        if (f) f.status = 'done';
        cancelAnimation(p);
        srcKey.value = '';
        dstKey.value = '';
        o.value = withTiming(0, { duration: durations.instant, easing: easings.out });
    }, []);

    const maybeReveal = useCallback(() => {
        const f = flight.current;
        if (f && f.status === 'flying' && f.landed && f.loaded) finish();
    }, [finish]);

    const onForwardDone = useCallback(
        (id) => {
            const f = flight.current;
            if (!f || f.id !== id || f.status !== 'flying') return;
            f.landed = true;
            maybeReveal();
            later(() => {
                if (flight.current === f && f.status === 'flying') finish();
            }, LOAD_GRACE);
        },
        [maybeReveal, finish],
    );

    const onReverseDone = useCallback(
        (id) => {
            const f = flight.current;
            if (!f || f.id !== id || f.status !== 'reversing') return;
            finish();
        },
        [finish],
    );

    const setRects = (from, to) => {
        const o0 = origin.current;
        const size = Math.max(1, to.width, from.width);
        box.value = size;
        fx.value = from.x - o0.x + from.width / 2;
        fy.value = from.y - o0.y + from.height / 2;
        fs.value = from.width / size;
        tx.value = to.x - o0.x + to.width / 2;
        ty.value = to.y - o0.y + to.height / 2;
        ts.value = to.width / size;
    };

    const launch = useCallback(() => {
        const f = flight.current;
        if (!f || f.status !== 'claimed' || !f.from || !f.to) return;
        f.status = 'flying';
        setRects(f.from, f.to);
        const id = f.id;
        p.value = 0;
        o.value = 1;
        p.value = withSpring(1, HERO_SPRING, (done) => {
            if (done) scheduleOnRN(onForwardDone, id);
        });
    }, [onForwardDone]);

    const start = useCallback(
        ({ fromRef, uri: u, matchKey, sourceKey }) => {
            if (reduce || !u || matchKey == null) return;
            const id = ++seq.current;
            const f = { id, matchKey: String(matchKey), sourceKey: String(sourceKey || ''), fromRef, uri: u, at: Date.now(), status: 'pending' };
            flight.current = f;
            cancelAnimation(p);
            o.value = 0;
            setUri(u);
            // Web hides the card screen as soon as the PDP mounts: measure synchronously there.
            const syncRect = measureRectSync(fromRef);
            (syncRect ? Promise.resolve(syncRect) : measureRect(fromRef)).then((rect) => {
                if (flight.current !== f) return;
                const from = insetRect(rect, CARD_INSET);
                if (!from || !onScreen(from, winRef.current)) {
                    abort();
                    return;
                }
                f.from = from;
                f.fromRaw = rect;
                // park the overlay on the card until the PDP reports its rect
                if (f.status === 'pending' || f.status === 'claimed') {
                    srcKey.value = f.sourceKey;
                    if (!f.to) {
                        // box ≈ the hero size, so the overlay only ever scales down
                        const size = Math.max(from.width, winRef.current.width * 0.86);
                        setRects(from, { x: from.x + from.width / 2 - size / 2, y: from.y + from.height / 2 - size / 2, width: size, height: size });
                        tx.value = fx.value;
                        ty.value = fy.value;
                        ts.value = fs.value;
                        p.value = 0;
                        o.value = 1;
                    }
                }
                launch();
            });
            // The PDP renders in the same commit as navigate(), so an unclaimed flight means the tap
            // went somewhere else: give the card its image back fast.
            later(() => {
                if (flight.current === f && f.status === 'pending') abort();
            }, CLAIM_TIMEOUT);
            later(() => {
                if (flight.current === f && f.status === 'claimed' && !f.to) abort();
            }, CLAIM_WINDOW);
        },
        [reduce, launch, abort],
    );

    /** Called synchronously by the PDP's first render. Returns the flight id or null. */
    const claim = useCallback((matchKey) => {
        const f = flight.current;
        if (!f || f.status !== 'pending' || f.matchKey !== String(matchKey) || Date.now() - f.at > CLAIM_WINDOW) return null;
        f.status = 'claimed';
        return String(f.id);
    }, []);

    const reportTarget = useCallback(
        (id, rect) => {
            const f = flight.current;
            if (!f || String(f.id) !== id || f.status !== 'claimed') return;
            const to = insetRect(rect, HERO_INSET);
            if (!to) return;
            f.to = to;
            launch();
        },
        [launch],
    );

    const reportLoaded = useCallback(
        (id) => {
            const f = flight.current;
            if (!f || String(f.id) !== id) return;
            f.loaded = true;
            maybeReveal();
        },
        [maybeReveal],
    );

    /** PDP is leaving: fly the image back to its card (or do nothing gracefully). */
    const reverse = useCallback(
        async (id, targetRef) => {
            const f = flight.current;
            if (reduce || !f || String(f.id) !== id || f.status === 'reversing') return;
            if (f.status === 'flying') {
                // interrupted mid-flight: spring back from where it is
                f.status = 'reversing';
                srcKey.value = f.sourceKey;
                dstKey.value = id;
                const fid = f.id; // capture the number only: `f` holds a host ref that can't cross to the UI runtime
                p.value = withSpring(0, HERO_SPRING, (done) => {
                    if (done) scheduleOnRN(onReverseDone, fid);
                });
                return;
            }
            if (f.status !== 'done') {
                abort();
                return;
            }
            const to = insetRect(await measureRect(targetRef), HERO_INSET);
            if (flight.current !== f || !to || !onScreen(to, winRef.current)) return;
            // Take over the hero pixels now, while the PDP is still on screen.
            f.status = 'reversing';
            setRects(to, to);
            cancelAnimation(o);
            p.value = 1;
            o.value = 1;
            dstKey.value = id;
            // Native keeps the card's screen laid out under the PDP: measure it live. Web hides it
            // (display:none) and only restores its scroll offsets ~100 ms after the pop, so use the
            // rect captured on the way in — nothing can have scrolled it while the PDP was up.
            let cardRect = null;
            if (WEB) {
                await nextFrames(1);
                cardRect = f.fromRef.current && f.fromRef.current.isConnected ? f.fromRaw : null;
            } else {
                cardRect = await measureRect(f.fromRef);
            }
            const from = insetRect(cardRect, CARD_INSET);
            if (flight.current !== f) return;
            if (!from || !onScreen(from, winRef.current)) {
                finish(); // card scrolled away or unmounted: just fade out
                return;
            }
            setRects(from, to);
            srcKey.value = f.sourceKey;
            const fid = f.id; // number only — never close over `f` (it holds a host ref) in a worklet
            p.value = withSpring(0, HERO_SPRING, (done) => {
                if (done) scheduleOnRN(onReverseDone, fid);
            });
        },
        [reduce, abort, finish, onReverseDone],
    );

    const onOverlayLayout = useCallback(() => {
        measureRect(overlayRef).then((r) => {
            if (r) origin.current = { x: r.x, y: r.y };
        });
    }, []);

    const overlayStyle = useAnimatedStyle(() => {
        if (o.value <= 0.001) return { opacity: 0, transform: [{ translateX: -9999 }] };
        const t = p.value;
        const x = interpolate(t, [0, 1], [fx.value, tx.value]);
        const y = interpolate(t, [0, 1], [fy.value, ty.value]);
        const s = interpolate(t, [0, 1], [fs.value, ts.value]);
        const half = box.value / 2;
        return {
            opacity: o.value,
            width: box.value,
            height: box.value,
            transform: [{ translateX: x - half }, { translateY: y - half }, { scale: s }],
        };
    });

    const value = useMemo(
        () => ({ start, claim, reportTarget, reportLoaded, reverse, srcKey, dstKey }),
        [start, claim, reportTarget, reportLoaded, reverse],
    );

    return (
        <HeroContext.Provider value={value}>
            {children}
            <View ref={overlayRef} onLayout={onOverlayLayout} style={[styles.overlay, { pointerEvents: 'none' }]} collapsable={false}>
                <Animated.View testID="hero-transition-overlay" style={[styles.hero, overlayStyle]}>
                    {uri ? (
                        <Image source={{ uri }} style={[StyleSheet.absoluteFill, blend && styles.webBlend]} contentFit="contain" cachePolicy="memory-disk" transition={0} priority="high" accessible={false} />
                    ) : null}
                </Animated.View>
            </View>
        </HeroContext.Provider>
    );
}

const NOOP_HERO = { start: () => {} };

/** `{ start({ fromRef, uri, matchKey, sourceKey }) }` — no-op without a provider. */
export function useHeroTransition() {
    return useContext(HeroContext) || NOOP_HERO;
}

/** Hides the card image while its copy is in the air. Put it on a wrapper around the image only. */
export function useHeroSourceStyle(sourceKey) {
    const ctx = useContext(HeroContext);
    const src = ctx ? ctx.srcKey : null;
    const key = String(sourceKey);
    return useAnimatedStyle(() => ({ opacity: src && src.value === key ? 0 : 1 }));
}

/**
 * Destination side. Claims a pending hero for `matchKey` on the first render.
 * Returns { ref, onLayout, onLoad, style, reverse, active }.
 */
export function useHeroTarget(matchKey) {
    const ctx = useContext(HeroContext);
    const ref = useRef(null);
    const [claimId] = useState(() => (ctx ? ctx.claim(matchKey) : null));
    const dst = ctx ? ctx.dstKey : null;

    // Hide the real hero before the first paint while the overlay owns it.
    React.useLayoutEffect(() => {
        if (claimId && dst) dst.value = claimId;
    }, [claimId]);

    const onLayout = useCallback(() => {
        if (!claimId || !ctx) return;
        measureRect(ref).then((r) => r && ctx.reportTarget(claimId, r));
    }, [claimId, ctx]);

    const onLoad = useCallback(() => {
        if (claimId && ctx) ctx.reportLoaded(claimId);
    }, [claimId, ctx]);

    const reverse = useCallback(() => {
        if (claimId && ctx) ctx.reverse(claimId, ref);
    }, [claimId, ctx]);

    const id = claimId || '';
    const style = useAnimatedStyle(() => ({ opacity: dst && id && dst.value === id ? 0 : 1 }));

    return { ref, onLayout, onLoad, style, reverse, active: !!claimId };
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFill, zIndex: z.max, elevation: 31 },
    hero: { position: 'absolute', left: 0, top: 0 },
    webBlend: { mixBlendMode: 'multiply' },
});

export default HeroTransitionProvider;
