/**
 * OtpBoxes — N digit boxes driven by ONE transparent TextInput laid over them, so typing,
 * SMS autofill (oneTimeCode / sms-otp) and paste all work. Boxes are 48pt wide, and shrink (down
 * to 36pt, with a tighter gap) when `length` boxes would not fit the row, e.g. 6 digits on a small phone.
 *
 * Motion
 *   · mount: the boxes pop in staggered (0.9 → 1 + fade, 45 ms apart)
 *   · focus: the active box lifts on a spring and its brand-tint focus ring springs out from the border
 *   · digit: a small pop as it lands
 *   · error: the row shakes (the screen fires the error haptic) and the borders turn red
 *   · success: the boxes turn green one after another, then the screen moves on
 * Reduced motion: colour / opacity only.
 *
 * Props
 *   value        string of digits
 *   onChange     (digits) => void
 *   length       default 4 (4-6; the server's otpLength)
 *   error        boolean — red borders
 *   success      boolean — green borders + tint (verified)
 *   shakeKey     number — increment to trigger a shake
 *   inputRef     ref forwarded to the TextInput (focus())
 *   disabled
 *   accessibilityLabel
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';
import { Text } from '../../components/ui';

const STAGGER = 45;
const BOX_W = 48;
const BOX_H = 56;
const MIN_BOX_W = 36;

// Largest box (<= 48) and gap that fit `length` boxes into `width`.
function fitBoxes(width, length) {
    if (!width) return { size: BOX_W, gap: length > 4 ? space.sm : space.md };
    for (const gap of [space.md, space.sm, space.xs]) {
        const size = Math.floor((width - gap * (length - 1)) / length);
        if (size >= BOX_W) return { size: BOX_W, gap };
        if (gap === space.xs || size >= 44) return { size: Math.max(MIN_BOX_W, size), gap };
    }
    return { size: BOX_W, gap: space.md };
}

function Box({ index, digit, active, error, success, size = BOX_W }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const a = useSharedValue(active ? 1 : 0); // focus (colour)
    const lift = useSharedValue(active ? 1 : 0); // focus (spring)
    const ok = useSharedValue(0); // success
    const pop = useSharedValue(1);
    const enter = useSharedValue(0);

    useEffect(() => {
        enter.value = withDelay(index * STAGGER, reduce ? withTiming(1, { duration: durations.base }) : withSpring(1, springs.bouncy));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        a.value = withTiming(active ? 1 : 0, { duration: durations.fast, easing: easings.out });
        lift.value = reduce ? (active ? 1 : 0) : withSpring(active ? 1 : 0, springs.snappy);
    }, [active, a, lift, reduce]);
    useEffect(() => {
        if (digit && !reduce) pop.value = withSequence(withSpring(1.08, springs.snappy), withSpring(1, springs.snappy));
    }, [digit, reduce, pop]);
    useEffect(() => {
        ok.value = success ? withDelay(index * 60, withTiming(1, { duration: durations.base, easing: easings.out })) : 0;
        if (success && !reduce) pop.value = withDelay(index * 60, withSequence(withSpring(1.1, springs.snappy), withSpring(1, springs.bouncy)));
    }, [success, index, ok, pop, reduce]);

    const border = digit ? colors.borderStrong : colors.border;
    const fill = digit ? colors.surface : colors.surfaceSunken;
    const style = useAnimatedStyle(() => {
        const base = error ? colors.error : interpolateColor(a.value, [0, 1], [border, colors.accent]);
        const bg = interpolateColor(a.value, [0, 1], [fill, colors.surface]);
        return {
            borderColor: interpolateColor(ok.value, [0, 1], [base, colors.success]),
            backgroundColor: interpolateColor(ok.value, [0, 1], [bg, colors.successTint]),
        };
    });
    const cell = useAnimatedStyle(() => ({
        opacity: Math.min(1, enter.value * 1.5),
        transform: [
            { translateY: reduce ? 0 : lift.value * -2 },
            { scale: (reduce ? 1 : 0.9 + 0.1 * enter.value) * pop.value },
        ],
    }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: error || success ? 0 : Math.min(1, Math.max(0, lift.value)),
        transform: [{ scale: reduce ? 1 : 0.92 + 0.08 * lift.value }],
    }));
    const ink = success ? colors.successInk : error ? 'error' : 'ink';
    const dims = size === BOX_W ? null : { width: size, height: Math.round((size * BOX_H) / BOX_W) };
    return (
        <Animated.View style={[styles.cell, dims, cell]}>
            <Animated.View style={[styles.ring, ringStyle, { pointerEvents: 'none' }]} />
            <Animated.View style={[styles.box, dims, style]}>
                <Text variant={size < 44 ? 'h2' : 'h1'} color={ink}>{digit || ''}</Text>
                {active && !digit ? <Animated.View style={styles.caret} /> : null}
            </Animated.View>
        </Animated.View>
    );
}

export function OtpBoxes({ value, onChange, length = 4, error, success = false, shakeKey = 0, inputRef, disabled, accessibilityLabel }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const [focused, setFocused] = useState(false);
    const [rowWidth, setRowWidth] = useState(0);
    const shake = useSharedValue(0);
    const { size, gap } = fitBoxes(rowWidth, length);
    const onLayout = useCallback((e) => setRowWidth(Math.floor(e.nativeEvent.layout.width)), []);

    useEffect(() => {
        if (!shakeKey) return;
        if (reduce) return;
        shake.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withTiming(10, { duration: 60 }),
            withTiming(-7, { duration: 60 }),
            withTiming(7, { duration: 60 }),
            withSpring(0, springs.drag)
        );
    }, [shakeKey, reduce, shake]);

    const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
    const digits = value.split('');
    const activeIndex = Math.min(digits.length, length - 1);

    return (
        <Animated.View style={[styles.row, { gap }, rowStyle]} onLayout={onLayout}>
            {Array.from({ length }).map((_, i) => (
                <Box key={`${length}-${i}`} index={i} digit={digits[i]} active={focused && i === activeIndex && !disabled} error={error} success={success} size={size} />
            ))}
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={length}
                autoFocus
                editable={!disabled}
                caretHidden
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={styles.hidden}
                accessibilityLabel={accessibilityLabel}
                selectionColor="transparent"
            />
        </Animated.View>
    );
}

const useStyles = makeStyles((t) => ({
    row: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
    cell: { width: BOX_W, height: BOX_H, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: radii.input + 4, backgroundColor: t.colors.brandTint },
    box: {
        width: BOX_W,
        height: BOX_H,
        borderRadius: radii.input,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1, backgroundColor: t.colors.accent },
    hidden: {
        ...StyleSheet.absoluteFill,
        opacity: 0.011,
        color: 'transparent',
        borderWidth: 0,
        outlineStyle: 'none',
        outlineWidth: 0,
    },
}));

export default OtpBoxes;
