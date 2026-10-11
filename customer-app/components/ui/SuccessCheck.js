/**
 * SuccessCheck — a violet spinner (only while the work runs) that resolves into a filled VIOLET
 * disc with a small spring, and a white check that draws itself (stroke-dashoffset). For order
 * placed / payment done (DESIGN.md: "Payment success: surface background, violet check, one
 * confetti burst"). The spinner is the only repeating motion and stops on resolve.
 *
 * Props
 *   status    'loading' | 'success'   (switch to 'success' when the work completes)
 *   size      number (default 88)
 *   color     success disc colour (default colors.brand violet)
 *   spinnerColor  loading ring colour (default colors.brand violet)
 *   onDone    () => void — fires after the check finishes drawing (navigate / fire confetti here)
 *   haptic    boolean — success haptic on resolve (default true)
 *
 * Example
 *   <SuccessCheck status={placed ? 'success' : 'loading'} onDone={() => confetti.current?.fire()} />
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
    cancelAnimation,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../../theme';
import { springs, easings, durations } from '../../theme/motion';
import haptics from './haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 38; // path length of the check below (12.4 + 25.1, viewBox 0..64)

export function SuccessCheck({ status = 'loading', size = 88, color: colorProp, spinnerColor: spinnerProp, onDone, haptic = true, style }) {
    const { colors } = useTheme();
    const color = colorProp || colors.brand;
    const spinnerColor = spinnerProp || colors.brand;
    const reduce = useReducedMotion();
    const spin = useSharedValue(0);
    const fill = useSharedValue(status === 'success' ? 1 : 0);
    const draw = useSharedValue(status === 'success' ? 1 : 0);

    useEffect(() => {
        if (status === 'loading') {
            fill.value = 0;
            draw.value = 0;
            spin.value = 0;
            spin.value = withRepeat(withTiming(1, { duration: 800, easing: easings.linear }), -1, false);
            return () => cancelAnimation(spin);
        }
        cancelAnimation(spin);
        if (haptic) haptics.success();
        fill.value = reduce ? withTiming(1, { duration: durations.base }) : withSpring(1, springs.bouncy);
        draw.value = withDelay(
            reduce ? 0 : 140,
            withTiming(1, { duration: reduce ? 1 : 360, easing: easings.out }, (finished) => {
                if (finished && onDone) scheduleOnRN(onDone);
            }),
        );
        return undefined;
    }, [status]);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(1, fill.value * 2),
        transform: [{ rotate: `${spin.value * 360}deg` }],
    }));
    const discStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, fill.value * 2),
        transform: [{ scale: 0.55 + 0.45 * fill.value }],
    }));
    const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - draw.value) }));

    const r = 28;
    const circ = 2 * Math.PI * r;

    return (
        <View
            style={[{ width: size, height: size }, style]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={status === 'success' ? 'Done' : 'Loading'}
            accessibilityLiveRegion="polite"
        >
            <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
                <Svg width={size} height={size} viewBox="0 0 64 64">
                    <Circle cx="32" cy="32" r={r} stroke={colors.brandTint} strokeWidth="4" fill="none" />
                    <Circle
                        cx="32"
                        cy="32"
                        r={r}
                        stroke={spinnerColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${circ * 0.28} ${circ}`}
                    />
                </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, discStyle]}>
                <Svg width={size} height={size} viewBox="0 0 64 64">
                    <Circle cx="32" cy="32" r="30" fill={color} />
                    <AnimatedPath
                        d="M19 33.5 L28 42 L45.5 24"
                        stroke={colors.onSuccess}
                        strokeWidth="5.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        strokeDasharray={CHECK_LEN}
                        animatedProps={checkProps}
                    />
                </Svg>
            </Animated.View>
        </View>
    );
}

export default SuccessCheck;
