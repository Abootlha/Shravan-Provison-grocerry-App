/**
 * useStaggeredEntrance / AnimatedListItem — fade + rise on first mount, staggered by index.
 * The stagger is capped (`stagger.maxItems`) so item 40 doesn't wait 1.6s. Entrance runs
 * once per mount; FlashList-recycled cells do not replay it (good: no animation on scroll).
 *
 * useStaggeredEntrance(index, options?) → animated style
 *   options.delay     per-item delay ms (default 40)
 *   options.maxItems  cap (default 8)
 *   options.offsetY   start offset in px (default 12)
 *   options.disabled  skip (e.g. when restoring a cached list)
 *
 * <AnimatedListItem index={i} style={...}>{children}</AnimatedListItem>
 *
 * Example
 *   renderItem={({ item, index }) => (
 *     <AnimatedListItem index={index}><OrderCard order={item} /></AnimatedListItem>
 *   )}
 *
 * Use for first paint of a screen's content only. Never block taps while it plays.
 * Reduced motion: opacity only.
 */
import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { springs, durations, easings, stagger } from '../../theme/motion';

export function useStaggeredEntrance(index = 0, options = {}) {
    const { delay = stagger.delay, maxItems = stagger.maxItems, offsetY = stagger.offsetY, disabled = false } = options;
    const reduce = useReducedMotion();
    const o = useSharedValue(disabled ? 1 : 0);
    const y = useSharedValue(disabled || reduce ? 0 : offsetY);

    useEffect(() => {
        if (disabled) return;
        const d = Math.min(Math.max(index, 0), maxItems) * delay;
        o.value = withDelay(d, withTiming(1, { duration: durations.base, easing: easings.out }));
        if (!reduce) y.value = withDelay(d, withSpring(0, springs.gentle));
    }, []);

    return useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
}

export function AnimatedListItem({ index = 0, delay, maxItems, offsetY, disabled, style, children, ...rest }) {
    const anim = useStaggeredEntrance(index, { delay, maxItems, offsetY, disabled });
    return (
        <Animated.View style={[style, anim]} {...rest}>
            {children}
        </Animated.View>
    );
}

export default AnimatedListItem;
