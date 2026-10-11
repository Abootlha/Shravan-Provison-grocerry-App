/**
 * useTabEnter() — the tab-screen entrance (motion-spec "Global": tabs crossfade, no slide).
 *
 *   · First mount: 220ms fade + 8px spring rise (same beat as useScreenEnter).
 *   · Every switch BACK to this tab from another tab: 150ms crossfade from 0.35 + 8px rise.
 *   · Returning from a pushed stack screen (PDP, Category…) does NOT replay — the stack pop and the
 *     card ← PDP hero flight already carry that moment, and a dim-in would fight them.
 *     (ui/AnimatedScreen `replayOnFocus` follows the same rule for screens that wrap one body.)
 *
 * Returns { fade, rise, offset }: put `fade` (opacity only) on a wrapper that holds absolutely-positioned
 * chrome (headers, pills) and `rise` (translate only) on the scrolling body, so pinned headers never
 * shift and the status-bar strip never shows a gap. `offset` is the rise SharedValue, for screens that
 * already own a transform on their body and need to add it in. Reduced motion: opacity only. Never blocks touches.
 */
import { useEffect, useRef } from 'react';
import { useNavigationState, useRoute } from '@react-navigation/native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { durations, easings, springs } from '../../theme/motion';

const RISE = 8;

export function useTabEnter() {
    const reduce = useReducedMotion();
    const o = useSharedValue(0);
    const y = useSharedValue(reduce ? 0 : RISE);

    // the focused tab, and our own index, in the tab navigator that owns this screen
    const route = useRoute();
    const tabIndex = useNavigationState((s) => s?.index ?? 0);
    const myIndex = useNavigationState((s) => s?.routes?.findIndex((r) => r.key === route.key) ?? -1);
    const prev = useRef(tabIndex);

    useEffect(() => {
        o.value = withTiming(1, { duration: durations.base, easing: easings.out });
        if (!reduce) y.value = withSpring(0, springs.gentle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const was = prev.current;
        prev.current = tabIndex;
        if (tabIndex !== myIndex || was === tabIndex) return;
        o.value = 0.35;
        o.value = withTiming(1, { duration: durations.fast - 10, easing: easings.out });
        if (!reduce) {
            y.value = RISE;
            y.value = withSpring(0, springs.gentle);
        }
    }, [tabIndex, myIndex, reduce]);

    const fade = useAnimatedStyle(() => ({ opacity: o.value }));
    const rise = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
    return { fade, rise, offset: y };
}

export default useTabEnter;
