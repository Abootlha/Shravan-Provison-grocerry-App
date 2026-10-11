/**
 * FloatingInput — text field whose label sits inside the box and floats up (scale +
 * translate on the UI thread) when focused or filled. On focus the border cross-fades to violet
 * and a brand-tint focus ring springs out from the box (scale 0.97 → 1); a new error nudges the field
 * sideways once (warning haptic). Colours come from the active theme.
 *
 * Props: label, value, onChangeText, error (string shown under the field), hint,
 * plus any TextInput prop (keyboardType, maxLength, autoCapitalize, returnKeyType…).
 */
import React, { forwardRef, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Text, haptic } from '../../components/ui';
import { radii, space, type } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';

const HEIGHT = 56;
const LABEL_SCALE = 0.78;
const RING = 3;

export const FloatingInput = forwardRef(function FloatingInput(
    { label, value, onChangeText, error, hint, style, onFocus, onBlur, ...rest },
    ref,
) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const reduce = useReducedMotion();
    const [focused, setFocused] = useState(false);
    const lifted = focused || !!value;
    const lift = useSharedValue(lifted ? 1 : 0);
    const focus = useSharedValue(0);
    const err = useSharedValue(error ? 1 : 0);
    const ringScale = useSharedValue(1);
    const shake = useSharedValue(0);

    useEffect(() => {
        lift.value = reduce
            ? withTiming(lifted ? 1 : 0, { duration: durations.fast })
            : withSpring(lifted ? 1 : 0, springs.snappy);
    }, [lifted, reduce]);
    useEffect(() => {
        focus.value = withTiming(focused ? 1 : 0, { duration: durations.fast, easing: easings.out });
        if (focused && !reduce) {
            ringScale.value = 0.97;
            ringScale.value = withSpring(1, springs.snappy);
        }
    }, [focused, reduce]);
    useEffect(() => {
        err.value = withTiming(error ? 1 : 0, { duration: durations.fast, easing: easings.out });
        if (error) {
            haptic.warning();
            if (!reduce) {
                shake.value = withSequence(
                    withTiming(-6, { duration: 50, easing: easings.out }),
                    withTiming(6, { duration: 60, easing: easings.out }),
                    withSpring(0, springs.snappy),
                );
            }
        }
    }, [error, reduce]);

    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

    const boxStyle = useAnimatedStyle(() => ({
        borderColor: err.value > 0.5
            ? colors.error
            : interpolateColor(focus.value, [0, 1], [colors.border, colors.brand]),
    }));
    const labelStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(lift.value, [0, 1], [0, -11]) },
            { scale: interpolate(lift.value, [0, 1], [1, LABEL_SCALE]) },
        ],
    }));
    // Violet focus ring: a brand-tint halo that fades in around the box.
    const ringStyle = useAnimatedStyle(() => ({
        opacity: err.value > 0.5 ? 0 : focus.value,
        transform: [{ scale: ringScale.value }],
    }));
    const labelColor = useAnimatedStyle(() => ({
        color: interpolateColor(focus.value, [0, 1], [colors.inkMuted, colors.accentStrong]),
    }));

    return (
        <View style={style}>
            <Animated.View style={shakeStyle}>
            <Animated.View style={[styles.ring, ringStyle, { pointerEvents: 'none' }]} />
            <Animated.View style={[styles.box, boxStyle]}>
                <Animated.View style={[styles.labelWrap, labelStyle, { pointerEvents: 'none' }]}>
                    <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[type.body, labelColor]}>
                        {label}
                    </Animated.Text>
                </Animated.View>
                <TextInput
                    ref={ref}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                    accessibilityLabel={label}
                    accessibilityHint={error || hint}
                    placeholderTextColor={colors.inkMuted}
                    selectionColor={colors.accent}
                    cursorColor={colors.brandText}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    maxFontSizeMultiplier={1.3}
                    style={styles.input}
                    {...rest}
                />
            </Animated.View>
            </Animated.View>
            {error ? (
                <Text variant="caption" color="error" style={styles.helper} accessibilityLiveRegion="polite">{error}</Text>
            ) : hint ? (
                <Text variant="caption" color="muted" style={styles.helper}>{hint}</Text>
            ) : null}
        </View>
    );
});

const useStyles = makeStyles((t) => ({
    ring: {
        position: 'absolute',
        top: -RING,
        left: -RING,
        right: -RING,
        bottom: -RING,
        borderRadius: radii.md + RING - space.xxs,
        borderWidth: RING,
        borderColor: t.colors.brandTint,
    },
    box: {
        minHeight: HEIGHT,
        borderWidth: 1.5,
        borderRadius: radii.md - space.xxs,
        backgroundColor: t.colors.surface,
        justifyContent: 'center',
        paddingHorizontal: space.md,
    },
    labelWrap: {
        position: 'absolute',
        left: space.md,
        right: space.md,
        top: (HEIGHT - 20) / 2 - 1.5,
        transformOrigin: 'left center',
    },
    input: {
        ...type.bodyStrong,
        color: t.colors.ink,
        paddingTop: space.lg + space.xxs,
        paddingBottom: space.xs + space.xxs,
        minHeight: HEIGHT - 3,
        outlineStyle: 'none',
    },
    helper: { marginTop: space.xs, marginLeft: space.xs },
}));

export default FloatingInput;
