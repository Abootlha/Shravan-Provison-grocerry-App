/**
 * Chip (alias Pill) — selectable chip (radius 8, never a pill) for filters, tip amounts, sort
 * options, category switches. Colours cross-fade on the UI thread; selecting gives a small spring pop.
 *
 * Props
 *   label        string
 *   selected     boolean
 *   onPress      () => void   (toggle state lives in the parent)
 *   tone         'soft'   (default) selected = brand tint #F1ECFE + violet border + violet text;
 *                         unselected = surface + border. THE selected state for filters, sort, category.
 *                'brand'  selected = solid violet + white text (a single primary choice, e.g. tip amount)
 *                Legacy aliases: 'night' / 'green' / 'ink' → soft, 'yellow' → brand
 *   size         'sm' (32) | 'md' (40)  — default 'md'
 *   leftIcon / rightIcon   element or ({ color, size }) => element (e.g. chevron-down on filter chips)
 *   caption      small secondary text under the label (e.g. "Most tipped")
 *   disabled
 *   haptic       default 'selection'
 *
 * Example
 *   {[20, 30, 50].map((amt) => (
 *     <Chip key={amt} tone="brand" label={`₹${amt}`} selected={tip === amt} onPress={() => setTip(amt)} />
 *   ))}
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { radii, space, type } from '../../constants/theme';
import { makeThemed } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';
import { PressableScale } from './PressableScale';

// [unselected, selected] pairs, interpolated on the UI thread. DESIGN.md: the brand tint is THE
// selected-state background; the old inverse "night" pill is gone (its keys alias to soft).
const useTones = makeThemed(({ colors: c }) => {
    const SOFT = {
        bg: [c.surface, c.brandTint],
        border: [c.border, c.brand],
        fg: [c.ink, c.brandStrong],
    };
    const BRAND = {
        bg: [c.surface, c.brand],
        border: [c.border, c.brand],
        fg: [c.ink, c.onBrand],
    };
    return {
        soft: SOFT,
        brand: BRAND,
        night: SOFT,
        green: SOFT,
        ink: SOFT,
        yellow: BRAND,
    };
});

const SIZES = { sm: { h: 32, px: space.md, icon: 14 }, md: { h: 40, px: space.lg, icon: 16 } };

export function Chip({
    label,
    selected = false,
    onPress,
    tone = 'soft',
    size = 'md',
    leftIcon,
    rightIcon,
    caption,
    disabled,
    haptic = 'selection',
    style,
    ...rest
}) {
    const TONES = useTones();
    const t = TONES[tone] || TONES.soft;
    const sz = SIZES[size] || SIZES.md;
    const reduce = useReducedMotion();
    const p = useSharedValue(selected ? 1 : 0);
    const pop = useSharedValue(1);

    useEffect(() => {
        p.value = withTiming(selected ? 1 : 0, { duration: durations.fast, easing: easings.out });
        if (selected && !reduce) {
            pop.value = withSequence(withSpring(1.04, springs.snappy), withSpring(1, springs.snappy));
        }
    }, [selected, reduce]);

    const boxStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(p.value, [0, 1], t.bg),
        borderColor: interpolateColor(p.value, [0, 1], t.border),
        transform: [{ scale: pop.value }],
    }));
    const textStyle = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], t.fg) }));
    const fg = selected ? t.fg[1] : t.fg[0];
    const icon = (i) => (typeof i === 'function' ? i({ color: fg, size: sz.icon }) : i);
    const slop = Math.max(0, (44 - sz.h) / 2);

    return (
        <PressableScale
            onPress={onPress}
            haptic={haptic}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={rest.accessibilityLabel || label}
            hitSlop={slop ? { top: slop, bottom: slop } : undefined}
            style={[styles.wrap, style]}
            {...rest}
        >
            <Animated.View
                style={[
                    styles.box,
                    { minHeight: sz.h, paddingHorizontal: sz.px, paddingVertical: caption ? space.xs + 2 : 0 },
                    boxStyle,
                ]}
            >
                {leftIcon ? <View style={styles.iconL}>{icon(leftIcon)}</View> : null}
                <View style={styles.texts}>
                    <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[type.label, textStyle]}>
                        {label}
                    </Animated.Text>
                    {caption ? (
                        <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[type.micro, styles.caption, textStyle]}>
                            {caption}
                        </Animated.Text>
                    ) : null}
                </View>
                {rightIcon ? <View style={styles.iconR}>{icon(rightIcon)}</View> : null}
            </Animated.View>
        </PressableScale>
    );
}

export const Pill = Chip;

const styles = StyleSheet.create({
    wrap: { alignSelf: 'flex-start' },
    box: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.chip,
        borderWidth: 1,
    },
    texts: { alignItems: 'center' },
    caption: { fontFamily: type.caption.fontFamily, fontSize: 11, lineHeight: 14, opacity: 0.85, marginTop: 1 },
    iconL: { marginRight: space.xs + 2 },
    iconR: { marginLeft: space.xs + 2 },
});

export default Chip;
