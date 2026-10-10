/**
 * Shared look + motion for the auth flow (Splash → Language → Onboarding → Login → OTP).
 *
 *   AUTH_BAR                   geometry of the shared top bar (AuthBar) — Splash flies its mark to it.
 *   useAuthGradient()          DEPRECATED: returns flat canvas stops (no gradients, DESIGN.md). Unused.
 *   useAuthSheetStyle()        DEPRECATED: returns null. Unused.
 *   useFromSplashHandoff(route, navigation)
 *                              the screen opened straight from Splash: switch its stack animation to a
 *                              short fade (the logo flew into place on the Splash, so nothing should slide),
 *                              and return an animated style for the header logo that settles from a slightly
 *                              larger, transparent copy — the second half of the shared-position move.
 *   useSheetSlide({ from })    sheet CONTENT slides in horizontally (+fade) while the hero stays put;
 *                              `leave(dir)` slides it out. Login → OTP: Login leaves left, OTP enters from the
 *                              right; back to Login it re-enters from the left. Spring, interruptible.
 * Reduced motion: opacity only.
 */
import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { makeThemed } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';

/** AuthBar: padded by the safe-area top + PAD_TOP, MIN_H tall, centred lockup with a LOGO-pt mark. */
export const AUTH_BAR = { PAD_TOP: 8, MIN_H: 48, LOGO: 26 };

/** Where the AuthBar's MARK centre sits: x offset from the screen centre, y below the safe-area top. */
export function authBarMarkCentre() {
    const size = AUTH_BAR.LOGO;
    const wordH = Math.round(size * 0.5);
    const lockupW = size + size * 0.16 + (wordH * 691) / 76; // Logo.js: mark + gap + wordmark
    return { dx: -lockupW / 2 + size / 2, dy: AUTH_BAR.PAD_TOP + AUTH_BAR.MIN_H / 2 };
}

export const useAuthGradient = makeThemed((t) => [t.colors.canvas, t.colors.canvas, t.colors.canvas]);

export const useAuthSheetStyle = () => null;

const SLIDE = 28;

export function useFromSplashHandoff(route, navigation) {
    const reduce = useReducedMotion();
    const fromSplash = Boolean(route?.params?.fromSplash);
    const v = useSharedValue(fromSplash ? 0 : 1);
    useLayoutEffect(() => {
        if (fromSplash) navigation?.setOptions?.({ animation: 'fade', animationDuration: 200 });
    }, [fromSplash, navigation]);
    useEffect(() => {
        if (fromSplash) v.value = withDelay(40, withSpring(1, springs.gentle));
    }, [fromSplash, v]);
    return useAnimatedStyle(() => ({
        opacity: Math.min(1, v.value * 1.6),
        transform: [{ scale: reduce ? 1 : 1.35 - 0.35 * v.value }],
    }));
}

export function useSheetSlide({ from = 0 } = {}) {
    const reduce = useReducedMotion();
    const x = useSharedValue(from); // -1 left · 0 in place · 1 right
    const o = useSharedValue(from ? 0 : 1);

    const enter = useCallback(
        (dir) => {
            if (dir) {
                x.value = dir;
                o.value = 0;
            }
            x.value = withSpring(0, springs.gentle);
            o.value = withTiming(1, { duration: durations.base, easing: easings.out });
        },
        [x, o],
    );

    useEffect(() => {
        if (from) enter(0);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Coming back to this screen after it slid out: come back from where it left.
    useFocusEffect(
        useCallback(() => {
            if (x.value !== 0 || o.value < 1) enter(0);
        }, [enter, x, o]),
    );

    const leave = useCallback(
        (dir = -1) => {
            x.value = withTiming(dir, { duration: durations.fast, easing: easings.out });
            o.value = withTiming(0, { duration: durations.fast - 30, easing: easings.out });
        },
        [x, o],
    );

    const style = useAnimatedStyle(() => ({
        opacity: o.value,
        transform: [{ translateX: reduce ? 0 : x.value * SLIDE }],
    }));
    return { style, leave };
}
