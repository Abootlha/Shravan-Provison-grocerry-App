/**
 * PressableScale — the DEFAULT for every tappable surface with its own shape (buttons, chips, cards,
 * tiles, icons). Never use TouchableOpacity / bare Pressable for these. Full-width list rows use
 * PressableHighlight (tint fade) instead — see PressableHighlight.js.
 * Springs down to `scaleTo` on
 * press-in and back on release (UI thread). Optional haptic fires on a completed press.
 *
 * Props
 *   onPress, onLongPress, onPressIn, onPressOut   passthrough
 *   scaleTo        number, default 0.96 (use press.subtle 0.98 for big cards)
 *   haptic         false | 'light' | 'medium' | 'selection' | 'success' ... (default false)
 *   disabled       boolean — no feedback, 0.5 opacity unless `disabledOpacity` given
 *   disabledOpacity number (default 0.5)
 *   style          style of the animated container (layout lives here)
 *   hitSlop        passthrough; add it when the visual is smaller than 44pt
 *   accessibilityRole defaults to 'button'
 *   container      boolean — this pressable CONTAINS other buttons (cards with an ADD / heart inside).
 *                  On web it renders role="group" (still focusable, Enter activates) so RN-web never
 *                  nests <button> inside <button>; native keeps role "button".
 *   ...rest        any Pressable prop (accessibilityLabel, testID, ...)
 *
 * Reduced motion: scale is replaced by a quick opacity dip.
 *
 * Example
 *   <PressableScale haptic="light" onPress={open} style={styles.tile}>
 *     <Image ... />
 *   </PressableScale>
 */
import React, { useCallback } from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { springs, press, durations } from '../../theme/motion';
import haptics from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
    onPress,
    onPressIn,
    onPressOut,
    scaleTo = press.scale,
    haptic = false,
    disabled = false,
    disabledOpacity = 0.5,
    style,
    children,
    container = false,
    accessibilityRole: roleProp,
    accessibilityState,
    ...rest
}) {
    const accessibilityRole = roleProp || (container && Platform.OS === 'web' ? 'group' : 'button');
    const reduce = useReducedMotion();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        if (reduce) return { opacity: 1 - pressed.value * 0.25 };
        return { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] };
    });

    const handleIn = useCallback(
        (e) => {
            pressed.value = reduce ? withTiming(1, { duration: durations.instant }) : withSpring(1, springs.snappy);
            onPressIn && onPressIn(e);
        },
        [onPressIn, reduce],
    );
    const handleOut = useCallback(
        (e) => {
            pressed.value = reduce ? withTiming(0, { duration: durations.fast }) : withSpring(0, springs.snappy);
            onPressOut && onPressOut(e);
        },
        [onPressOut, reduce],
    );
    const handlePress = useCallback(
        (e) => {
            if (haptic) haptics(haptic);
            onPress && onPress(e);
        },
        [onPress, haptic],
    );

    return (
        <AnimatedPressable
            accessibilityRole={accessibilityRole}
            accessibilityState={{ disabled, ...accessibilityState }}
            disabled={disabled}
            onPress={onPress ? handlePress : undefined}
            onPressIn={handleIn}
            onPressOut={handleOut}
            style={[style, animatedStyle, disabled && { opacity: disabledOpacity }]}
            {...rest}
        >
            {children}
        </AnimatedPressable>
    );
}

export default PressableScale;
