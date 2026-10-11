/**
 * Card — a FLAT surface with a hairline on the neutral canvas (DESIGN.md: cards never carry a shadow).
 *
 * Props
 *   variant     'surface' (default, white / dark surface + hairline) | 'glass' (@deprecated → solid surface)
 *               | 'night' (ink surface, white content — use sparingly, e.g. a dark promo block)
 *   tint        @deprecated pastel tile key → all resolve to the neutral image well. Or any colour.
 *   elevation   default 'none'. Only pass 'floating' for something that genuinely floats above content.
 *   radius      radii key or number (default 'card' = 12 — the card ceiling)
 *   padding     space key or number (default 'lg' = 16; pass 0 for edge-to-edge images)
 *   bordered    @deprecated — every surface card has the hairline now
 *   onPress     makes it pressable (springs to 0.98) — haptic off by default
 *   haptic      haptic kind when pressable
 *   style       container style
 *
 * Web: a pressable card renders as role="group" (focusable, Enter activates) instead of a
 * <button>, so Buttons / AddToCartButtons inside it never nest <button> in <button>.
 *
 * Example
 *   <Card padding="md" onPress={() => open(cat)} accessibilityLabel={cat.name}>
 *     <Image source={cat.image} style={{ width: 64, height: 64 }} />
 *   </Card>
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { PressableScale } from './PressableScale';

const resolve = (scale, v, fallback) => (v == null ? fallback : typeof v === 'number' ? v : scale[v] ?? fallback);

export function Card({
    variant = 'surface',
    tint,
    elevation,
    radius = 'card',
    padding = 'lg',
    bordered = false,
    onPress,
    haptic = false,
    style,
    children,
    ...rest
}) {
    const { colors, shadows } = useTheme();
    const styles = useStyles();
    const r = resolve(radii, radius, radii.card);
    const pad = resolve(space, padding, space.lg);
    const isNight = variant === 'night';
    const bg = isNight ? colors.surfaceNight : tint ? colors.tint[tint] || tint : colors.surface;
    const level = elevation || 'none';
    const containerStyle = [
        { backgroundColor: bg, borderRadius: r, padding: pad },
        shadows[level] || shadows.none,
        // flat + hairline (a tinted well needs no line; `bordered` is kept for old call sites)
        (!tint || bordered) && !isNight && styles.bordered,
        style,
    ];

    const inner = children;

    if (onPress) {
        return (
            <PressableScale
                onPress={onPress}
                haptic={haptic}
                scaleTo={press.subtle}
                container
                style={containerStyle}
                {...rest}
            >
                {inner}
            </PressableScale>
        );
    }
    return (
        <View style={containerStyle} {...rest}>
            {inner}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    bordered: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.colors.hairline },
}));

export default Card;
