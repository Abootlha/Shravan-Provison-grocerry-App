/**
 * IconButton — round icon-only button (back, close, heart, share, filter).
 *
 * Props
 *   icon            element, or ({ color, size }) => element. Or use `name` instead.
 *   name            MaterialCommunityIcons glyph name (shortcut when you have no custom icon)
 *   accessibilityLabel  REQUIRED — icon-only controls must say what they do ("Go back")
 *   onPress
 *   variant         'surface'  surface disc + hairline, flat (default)
 *                   'tinted'   sunken fill, no line (inside cards/headers)
 *                   'ghost'    transparent
 *                   'scrim'    translucent black with white icon (over photos)
 *                   'brand'    violet fill, white icon (alias 'accent') — only for a primary action
 *                   'soft'     brand tint fill, violet icon (selected state)
 *                   'night'    ink fill, white icon
 *                   'glass'    solid surface disc + hairline + the one floating shadow — the round
 *                              button over photos / maps. Frosted only with `allowBlur`.
 *                   'floating' alias of glass
 *   allowBlur       boolean — frost the 'glass' / 'floating' disc (expo-blur). PDP-over-photo and map
 *                   controls ONLY (DESIGN.md: max 2 blur uses). Default false.
 *   size            'sm' 32 | 'md' 40 | 'lg' 48 (visual size; hit area always ≥ 44)
 *   color           override icon colour
 *   active / activeColor   toggled state (e.g. wishlisted heart) — bounces when it becomes active
 *   haptic          default 'light'
 *   badge           optional number shown as a CountBadge on the corner
 *
 * Example
 *   <IconButton name="arrow-left" accessibilityLabel="Go back" onPress={navigation.goBack} />
 *   <IconButton name={liked ? 'heart' : 'heart-outline'} active={liked} activeColor={colors.error}
 *               variant="surface" accessibilityLabel="Add to wishlist" onPress={toggle} />
 */
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, HIT } from '../../constants/theme';
import { makeThemed } from '../../theme';
import { springs } from '../../theme/motion';
import { PressableScale } from './PressableScale';
import { CountBadge } from './Badge';

const canBlur = Platform.OS === 'ios' || Platform.OS === 'web';

const useVariants = makeThemed(({ colors: c, shadows: sh, isDark }) => ({
    surface: { bg: c.surfaceRaised, fg: c.ink, border: c.hairline },
    tinted: { bg: c.surfaceSunken, fg: c.ink },
    ghost: { bg: 'transparent', fg: c.ink },
    scrim: { bg: c.onImageScrim, fg: c.onNight },
    brand: { bg: c.brand, fg: c.onBrand },
    accent: { bg: c.brand, fg: c.onBrand },
    soft: { bg: c.brandTint, fg: c.brandStrong },
    night: { bg: c.surfaceNight, fg: c.onNight },
    // solid white / surface disc over photos & maps: hairline + the one floating shadow
    glass: { bg: c.surfaceRaised, fg: c.ink, shadow: sh.floating, border: c.hairline, blurFill: isDark ? 'rgba(35,35,35,0.72)' : 'rgba(255,255,255,0.78)' },
    floating: { bg: c.surfaceRaised, fg: c.ink, shadow: sh.floating, border: c.hairline, blurFill: isDark ? 'rgba(35,35,35,0.72)' : 'rgba(255,255,255,0.78)' },
}));
const SIZES = { sm: { box: 32, icon: 18 }, md: { box: 40, icon: 22 }, lg: { box: 48, icon: 24 } };

export function IconButton({
    icon,
    name,
    onPress,
    variant = 'surface',
    size = 'md',
    color,
    active = false,
    activeColor,
    haptic = 'light',
    badge,
    allowBlur = false,
    disabled,
    style,
    accessibilityLabel,
    ...rest
}) {
    if (__DEV__ && !accessibilityLabel) {
        console.warn('[IconButton] accessibilityLabel is required for icon-only buttons.');
    }
    const VARIANTS = useVariants();
    const v = VARIANTS[variant] || VARIANTS.surface;
    const sz = SIZES[size] || SIZES.md;
    const fg = active && activeColor ? activeColor : color || v.fg;
    const reduce = useReducedMotion();
    const pop = useSharedValue(1);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (active && !reduce) {
            pop.value = withSequence(withSpring(1.28, springs.snappy), withSpring(1, springs.bouncy));
        }
    }, [active]);

    const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
    const slop = Math.max(0, (HIT - sz.box) / 2);
    const blur = allowBlur && canBlur && !!v.blurFill;

    return (
        <PressableScale
            onPress={onPress}
            haptic={haptic}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active }}
            hitSlop={slop ? { top: slop, bottom: slop, left: slop, right: slop } : undefined}
            style={[
                styles.base,
                { width: sz.box, height: sz.box, backgroundColor: blur ? v.blurFill : v.bg },
                v.shadow,
                v.border && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: v.border },
                style,
            ]}
            {...rest}
        >
            {blur ? <BlurView intensity={40} tint="default" style={[StyleSheet.absoluteFill, styles.blur, { pointerEvents: 'none' }]} /> : null}
            <Animated.View style={iconStyle}>
                {icon ? (
                    typeof icon === 'function' ? icon({ color: fg, size: sz.icon }) : icon
                ) : (
                    <MaterialCommunityIcons name={name} size={sz.icon} color={fg} />
                )}
            </Animated.View>
            {badge ? (
                <View style={[styles.badge, { pointerEvents: 'none' }]}>
                    <CountBadge count={badge} />
                </View>
            ) : null}
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    base: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' }, // circle (allowed: icon buttons)
    blur: { borderRadius: radii.pill, overflow: 'hidden', zIndex: -1 },
    badge: { position: 'absolute', top: -4, right: -4 },
});

export default IconButton;
