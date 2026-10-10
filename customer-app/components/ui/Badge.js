/**
 * Badge — small label tags, and CountBadge — a numeric bubble that bounces when it changes.
 *
 * <Badge> props
 *   label     string, SENTENCE CASE ("12 mins", "20% off", "Bestseller") — never uppercase, no tracking
 *   tone      'neutral' sunken fill, secondary ink (default — most labels: "Default", "New", ETA)
 *             'discount' savings green fill, white text ("20% off", "₹24 off") — aliases 'offer' / 'gold'
 *             'success' green tint, green ink ("Delivered", "Verified", "Veg")
 *             'brand'   violet fill, white text — only for a state the user acted on ("Selected")
 *             'accent'  alias of brand
 *             'soft'    brand tint, violet ink (selected / default address)
 *             'night'   ink fill, white text (a label over a photo) — alias 'ink'
 *             'error'   red tint, red ink ("Only 2 left")
 *   size      'sm' (11/14) | 'md' (12/16)   default 'sm'
 *   icon      element or ({ color, size }) => element — ETA uses a clock / scooter glyph, never a bolt
 *   shape     @deprecated — ignored; badges are always radius 6 (no pills)
 *
 * <CountBadge> props
 *   count     number; hidden when 0 (scales out); shows "99+" above `max`
 *   max       default 99
 *   tone      'error' (default red) | 'ink' (ink bubble; inverts in dark) | 'brand' / 'accent' (violet) | 'gold' (→ savings green)
 *   outline   white ring to separate from the icon underneath (default true)
 *
 * Example
 *   <Badge label="12 mins" icon={({ color, size }) => <MaterialCommunityIcons name="clock-outline" color={color} size={size} />} />
 *   <Badge tone="discount" label="20% off" />
 *   <CountBadge count={cartCount} />
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { radii, space, type } from '../../constants/theme';
import { makeStyles, makeThemed } from '../../theme';
import { springs, durations } from '../../theme/motion';
import { RollingNumber } from './RollingNumber';

const useTones = makeThemed(({ colors: c }) => {
    const NIGHT = { bg: c.surfaceNight, fg: c.onNight };
    const SAVINGS = { bg: c.offer, fg: c.onGold }; // savings green fill (gold is removed)
    return {
        brand: { bg: c.brand, fg: c.onBrand },
        accent: { bg: c.brand, fg: c.onBrand },
        offer: SAVINGS,
        gold: SAVINGS,
        ink: NIGHT,
        night: NIGHT,
        soft: { bg: c.brandTint, fg: c.brandStrong },
        success: { bg: c.successTint, fg: c.successInk },
        discount: SAVINGS,
        neutral: { bg: c.surfaceSunken, fg: c.inkSecondary },
        error: { bg: c.errorTint, fg: c.errorInk },
    };
});

// `shape` is accepted for old call sites and ignored (no pill badges).
// eslint-disable-next-line no-unused-vars
export function Badge({ label, tone = 'neutral', size = 'sm', icon, shape, style, ...rest }) {
    const TONES = useTones();
    const styles = useStyles();
    const t = TONES[tone] || TONES.neutral;
    const md = size === 'md';
    const iconSize = md ? 12 : 10;
    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: t.bg,
                    borderRadius: radii.xs,
                    paddingHorizontal: md ? space.sm : space.xs + 2,
                    paddingVertical: md ? space.xs : 3,
                },
                style,
            ]}
            {...rest}
        >
            {icon ? <View style={styles.icon}>{typeof icon === 'function' ? icon({ color: t.fg, size: iconSize }) : icon}</View> : null}
            <RNText
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={[type.micro, md ? styles.mdText : styles.smText, { color: t.fg }]}
            >
                {label}
            </RNText>
        </View>
    );
}

const useCountTones = makeThemed(({ colors: c }) => ({
    error: { bg: c.error, fg: c.onError },
    accent: { bg: c.accent, fg: c.onAccent },
    ink: { bg: c.ink, fg: c.inkInverse }, // ink bubble in light, light bubble in dark
    brand: { bg: c.brand, fg: c.onBrand },
    gold: { bg: c.gold, fg: c.onGold }, // → savings green
}));

export function CountBadge({ count = 0, max = 99, tone = 'error', outline = true, style }) {
    const COUNT_TONES = useCountTones();
    const styles = useStyles();
    const t = COUNT_TONES[tone] || COUNT_TONES.error;
    const reduce = useReducedMotion();
    const visible = count > 0;
    const scale = useSharedValue(visible ? 1 : 0.5);
    const opacity = useSharedValue(visible ? 1 : 0);
    const prev = useRef(count);

    useEffect(() => {
        const was = prev.current;
        prev.current = count;
        opacity.value = withTiming(visible ? 1 : 0, { duration: durations.fast });
        if (reduce) {
            scale.value = 1;
            return;
        }
        if (!visible) {
            scale.value = withSpring(0.5, springs.snappy);
        } else if (was !== count) {
            scale.value = withSequence(withSpring(1.3, springs.snappy), withSpring(1, springs.bouncy));
        }
    }, [count, visible, reduce]);

    const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
    const display = count > max ? `${max}+` : count;

    return (
        <Animated.View
            accessibilityElementsHidden={!visible}
            style={[
                styles.count,
                { backgroundColor: t.bg },
                outline && styles.countOutline,
                anim,
                style, { pointerEvents: 'none' }]}
        >
            {typeof display === 'number' ? (
                <RollingNumber value={display} variant="micro" color={t.fg} style={styles.countText} />
            ) : (
                <RNText style={[type.micro, styles.countText, { color: t.fg }]}>{display}</RNText>
            )}
        </Animated.View>
    );
}

const useStyles = makeStyles((th) => ({
    badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
    smText: { fontSize: 11, lineHeight: 14 },
    mdText: { fontSize: 12, lineHeight: 16 },
    icon: { marginRight: 3 },
    count: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countOutline: { borderWidth: 1.5, borderColor: th.colors.surface, minWidth: 21, height: 21, borderRadius: 10.5 },
    countText: { fontSize: 10, lineHeight: 12, letterSpacing: 0 },
}));

export default Badge;
