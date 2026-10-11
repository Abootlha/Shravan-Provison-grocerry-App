/**
 * PressableHighlight — press feedback for LIST ROWS (settings rows, addresses, orders, search
 * suggestions): a tint fades in under the content instead of scaling the row. Scaling a
 * full-width row looks like the whole list is breathing; a tint reads as "this row".
 *
 * Which pressable?
 *   PressableScale      buttons, chips, cards, tiles, icons — anything with its own visible shape
 *   PressableHighlight  full-bleed / full-width rows inside a list or a card
 *
 * Props
 *   onPress, onLongPress, disabled, haptic (default false), hitSlop, accessibilityRole ('button')
 *   highlightColor   tint while pressed (default colors.pressOverlay — black 5% in light, white 6% in dark)
 *   radius           corner radius of the tint (default 0; match the row/card corners)
 *   style            row style (layout lives here)
 *   ...rest          any Pressable prop
 *
 * Timing: fades in over 90ms on press-in (instant enough to confirm the touch), out over 220ms.
 * Reduced motion: unchanged (it is already an opacity change).
 *
 * Example
 *   <PressableHighlight onPress={openOrders} style={styles.row} accessibilityLabel="Your orders">
 *     <Icon … /><Text variant="bodyStrong">Your orders</Text><Chevron />
 *   </PressableHighlight>
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { durations, easings } from '../../theme/motion';
import { useTheme } from '../../theme';
import haptics from './haptics';

export function PressableHighlight({
    onPress,
    onPressIn,
    onPressOut,
    haptic = false,
    highlightColor,
    radius = 0,
    disabled = false,
    style,
    children,
    accessibilityRole = 'button',
    accessibilityState,
    ...rest
}) {
    const { colors } = useTheme();
    const on = useSharedValue(0);
    const tint = useAnimatedStyle(() => ({ opacity: on.value }));

    const handleIn = useCallback(
        (e) => {
            on.value = withTiming(1, { duration: durations.instant, easing: easings.out });
            onPressIn && onPressIn(e);
        },
        [onPressIn],
    );
    const handleOut = useCallback(
        (e) => {
            on.value = withTiming(0, { duration: durations.base, easing: easings.out });
            onPressOut && onPressOut(e);
        },
        [onPressOut],
    );
    const handlePress = useCallback(
        (e) => {
            if (haptic) haptics(haptic);
            onPress && onPress(e);
        },
        [onPress, haptic],
    );

    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityState={{ disabled, ...accessibilityState }}
            disabled={disabled}
            onPress={onPress ? handlePress : undefined}
            onPressIn={handleIn}
            onPressOut={handleOut}
            style={[style, disabled && styles.disabled]}
            {...rest}
        >
            <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: highlightColor || colors.pressOverlay, borderRadius: radius }, tint, { pointerEvents: 'none' }]}
            />
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({ disabled: { opacity: 0.5 } });

export default PressableHighlight;
