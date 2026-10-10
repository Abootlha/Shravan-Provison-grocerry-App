/**
 * SaveButton — the address form's primary button with a loading → check morph.
 *   idle     regular violet <Button size="lg" fullWidth>
 *   loading  Button's own pulsing dots (width never changes)
 *   done     a green pill fades + springs in over the button (0.96 → 1) and the check pops
 *            (bouncy) with "Saved" — the beat before the screen navigates away.
 * Purely visual: `done` is driven by the screen after the save resolves. Reduced motion: fade only.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';

export function SaveButton({ done = false, doneLabel = 'Saved', ...buttonProps }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const o = useSharedValue(0);
    const pill = useSharedValue(0.96);
    const check = useSharedValue(0.6);

    useEffect(() => {
        if (!done) {
            o.value = withTiming(0, { duration: durations.fast, easing: easings.out });
            return;
        }
        o.value = withTiming(1, { duration: durations.fast, easing: easings.out });
        if (!reduce) {
            pill.value = 0.96;
            pill.value = withSpring(1, springs.snappy);
            check.value = 0.6;
            check.value = withDelay(60, withSpring(1, springs.bouncy));
        }
    }, [done, reduce]);

    const overlay = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: reduce ? 1 : pill.value }] }));
    const icon = useAnimatedStyle(() => ({ transform: [{ scale: reduce ? 1 : check.value }] }));

    return (
        <View>
            <Button size="lg" fullWidth {...buttonProps} disabled={buttonProps.disabled || done} />
            <Animated.View
                style={[styles.done, overlay, { pointerEvents: 'none' }]}
                accessibilityElementsHidden={!done}
                importantForAccessibility={done ? 'yes' : 'no-hide-descendants'}
                accessibilityLiveRegion="polite"
            >
                <Animated.View style={icon}>
                    <MaterialCommunityIcons name="check-circle" size={22} color={colors.onSuccess} />
                </Animated.View>
                <Text variant="button" color={colors.onSuccess}>{doneLabel}</Text>
            </Animated.View>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    done: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radii.button,
        backgroundColor: t.colors.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
    },
}));

export default SaveButton;
