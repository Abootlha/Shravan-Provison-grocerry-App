/**
 * ProgressBar — springy fill (translateX on the UI thread, never width). Used for the
 * free-delivery meter, order status, onboarding steps.
 *
 * Props
 *   value        0..1 (clamped)
 *   height       number (default 6)
 *   color        fill colour (default brand violet; pass colors.success for savings / free delivery)
 *   gradient     @deprecated — gradients are removed. `true` → flat brand fill; an array → its LAST stop, flat
 *   trackColor   track colour (default the neutral hairline)
 *   completeColor colour once value reaches 1 (optional, cross-fades)
 *   style
 *   accessibilityLabel  e.g. "Free delivery progress"
 *
 * Example
 *   <ProgressBar value={subtotal / FREE_DELIVERY_AT} accessibilityLabel="Free delivery progress" />
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { radii } from '../../constants/theme';
import { useTheme } from '../../theme';
import { springs, durations } from '../../theme/motion';

export function ProgressBar({
    value = 0,
    height = 6,
    color: colorProp,
    gradient,
    trackColor: trackProp,
    completeColor,
    style,
    accessibilityLabel,
}) {
    const { colors } = useTheme();
    // flat fill only (DESIGN.md: no gradients). A legacy gradient array collapses to its last stop.
    const color = colorProp || (Array.isArray(gradient) ? gradient[gradient.length - 1] : colors.brand);
    const trackColor = trackProp || colors.hairline;
    const v = Math.min(Math.max(value || 0, 0), 1);
    const reduce = useReducedMotion();
    const [w, setW] = useState(0);
    const p = useSharedValue(v);
    const done = useSharedValue(v >= 1 ? 1 : 0);
    // The measured width lives in a shared value too: the fill worklet reads it directly, so it is
    // right on the first measured frame (a closure-captured `w` stayed 0 on Android until the next
    // re-render, painting a full bar for a moment).
    const wv = useSharedValue(0);

    useEffect(() => {
        p.value = reduce ? withTiming(v, { duration: durations.base }) : withSpring(v, springs.gentle);
        done.value = withTiming(v >= 1 ? 1 : 0, { duration: durations.slow });
    }, [v, reduce]);

    const fill = useAnimatedStyle(() => ({
        transform: [{ translateX: -(1 - p.value) * wv.value }],
        backgroundColor: completeColor ? interpolateColor(done.value, [0, 1], [color, completeColor]) : color,
    }), [color, completeColor]);

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
            onLayout={(e) => {
                wv.value = e.nativeEvent.layout.width;
                setW(e.nativeEvent.layout.width);
            }}
            style={[{ height, borderRadius: radii.pill, backgroundColor: trackColor, overflow: 'hidden' }, style]}
        >
            {w > 0 ? (
                <Animated.View style={[{ width: w, height, borderRadius: radii.pill, overflow: 'hidden' }, fill]} />
            ) : null}
        </View>
    );
}

export default ProgressBar;
