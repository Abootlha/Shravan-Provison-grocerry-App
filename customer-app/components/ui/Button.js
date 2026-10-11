/**
 * Button — text CTA with spring press, optional icons and a fixed-width loading state.
 *
 * Props
 *   label        string (required)
 *   onPress      () => void
 *   variant      'primary'   solid brand violet, white text — THE main CTA (one per screen area)
 *                'secondary' solid ink surface, white text — strong secondary
 *                'soft'      brand tint (#F1ECFE), violet text — quiet secondary ("Change", "Add more")
 *                'outline'   surface fill, 1.5px violet border + violet text
 *                'ghost'     no fill, violet text (tertiary / inline)
 *                'dark'      alias of secondary
 *                'light'     white fill, violet text — only for CTAs sitting ON a violet / ink block
 *                'danger'    red solid, white text (destructive confirm)
 *                default 'primary'
 *   size         'sm' (36) | 'md' (48) | 'lg' (56) — default 'md'
 *   loading      boolean — label fades out, a small spinner takes its place; width never changes
 *   disabled     boolean
 *   leftIcon / rightIcon   element, or ({ color, size }) => element
 *   fullWidth    boolean — alignSelf: 'stretch'
 *   align        'start' | 'center' | 'end' | 'stretch' — optional alignSelf. Omit it and the button
 *                follows its parent (stretches in a default column, hugs in a row / alignItems parent).
 *   glow         @deprecated — ignored (DESIGN.md: no glow)
 *   haptic       haptic kind fired on press (default 'light'; false to disable)
 *   style        container style
 *   accessibilityLabel  defaults to label
 *
 * Shape: radius 10 (radii.button) — never a pill. Flat fill, no gradient, no shadow, no inner highlight.
 *
 * Example
 *   <Button label="Proceed to pay" size="lg" fullWidth loading={placing} onPress={pay}
 *           rightIcon={({ color }) => <Ionicons name="arrow-forward" size={18} color={color} />} />
 *   <Button label="Change" size="sm" variant="soft" align="start" onPress={edit} />
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { radii, type, space } from '../../constants/theme';
import { durations, easings } from '../../theme/motion';
import { makeStyles, makeThemed } from '../../theme';
import { PressableScale } from './PressableScale';

const useVariants = makeThemed(({ colors: c }) => {
    const night = { bg: c.surfaceNight, fg: c.onNight, border: c.surfaceNight };
    return {
        primary: { bg: c.brand, fg: c.onBrand, border: c.brand },
        secondary: night,
        dark: night,
        soft: { bg: c.brandTint, fg: c.brandStrong, border: c.brandTint },
        outline: { bg: c.surface, fg: c.brandText, border: c.brand },
        ghost: { bg: 'transparent', fg: c.brandText, border: 'transparent' },
        // sits ON a violet / ink block, which doesn't change with the theme → fixed white + violet ink
        light: { bg: c.neutral[0], fg: c.violet[700], border: c.neutral[0] },
        danger: { bg: c.error, fg: c.onError, border: c.error },
    };
});

const SIZES = {
    sm: { height: 36, px: space.md + 2, text: { ...type.label, fontFamily: type.button.fontFamily }, icon: 16 },
    md: { height: 48, px: space.xl, text: type.button, icon: 18 },
    lg: { height: 56, px: space['2xl'], text: { ...type.button, fontSize: 16, lineHeight: 22 }, icon: 20 },
};

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };

const renderIcon = (icon, color, size) => (typeof icon === 'function' ? icon({ color, size }) : icon);

export function Button({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    align,
    glow, // eslint-disable-line no-unused-vars -- deprecated, ignored
    haptic = 'light',
    style,
    accessibilityLabel,
    ...rest
}) {
    const VARIANTS = useVariants();
    const styles = useStyles();
    const v = VARIANTS[variant] || VARIANTS.primary;
    const sz = SIZES[size] || SIZES.md;
    const reduce = useReducedMotion();
    const busy = useSharedValue(loading ? 1 : 0);

    useEffect(() => {
        busy.value = withTiming(loading ? 1 : 0, { duration: durations.base, easing: easings.out });
    }, [loading]);

    const contentStyle = useAnimatedStyle(() => ({
        opacity: 1 - busy.value,
        transform: reduce ? [] : [{ scale: 1 - busy.value * 0.04 }],
    }));
    const spinnerStyle = useAnimatedStyle(() => ({ opacity: busy.value }));

    const isDisabled = disabled || loading;
    const outlined = variant === 'outline';
    const alignSelf = fullWidth ? 'stretch' : align ? ALIGN[align] : undefined;

    return (
        <PressableScale
            onPress={onPress}
            disabled={isDisabled}
            disabledOpacity={loading ? 1 : 0.45}
            haptic={haptic}
            accessibilityLabel={accessibilityLabel || label}
            accessibilityState={{ busy: loading }}
            hitSlop={size === 'sm' ? { top: 4, bottom: 4 } : undefined}
            style={[
                styles.base,
                {
                    height: sz.height,
                    paddingHorizontal: sz.px,
                    backgroundColor: v.bg,
                    borderColor: v.border,
                    borderWidth: outlined ? 1.5 : 0,
                },
                alignSelf && { alignSelf },
                style,
            ]}
            {...rest}
        >
            <Animated.View style={[styles.row, contentStyle]}>
                {leftIcon ? <View style={styles.iconLeft}>{renderIcon(leftIcon, v.fg, sz.icon)}</View> : null}
                <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[sz.text, { color: v.fg }]}>
                    {label}
                </Animated.Text>
                {rightIcon ? <View style={styles.iconRight}>{renderIcon(rightIcon, v.fg, sz.icon)}</View> : null}
            </Animated.View>
            {loading ? (
                <Animated.View style={[styles.spinner, spinnerStyle, { pointerEvents: 'none' }]}>
                    <ActivityIndicator size="small" color={v.fg} />
                </Animated.View>
            ) : null}
        </PressableScale>
    );
}

const useStyles = makeStyles(() => ({
    base: {
        borderRadius: radii.button,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    iconLeft: { marginRight: space.sm },
    iconRight: { marginLeft: space.sm },
    spinner: { position: 'absolute', alignSelf: 'center' },
}));

export default Button;
