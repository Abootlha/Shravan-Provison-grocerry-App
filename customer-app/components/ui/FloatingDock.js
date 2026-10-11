/**
 * FloatingDock — floating tab bar: 64pt tall, inset 16pt from the screen edges, SOLID surface
 * + hairline, radius 18, the one floating shadow, no blur, no glow. The active item is a FILLED
 * violet icon + label on a brand-tint indicator (radius 12) that slides between items on a spring;
 * inactive items are icon-only OUTLINE glyphs in muted ink. Cart count badge is an ink bubble.
 *
 * Use it as the `tabBar` of a bottom-tab navigator (wire `items` / `activeKey` / `onSelect` from
 * the navigator's state), or for any small segmented destination switcher.
 *
 * Props
 *   items       [{ key, label, icon: ({ color, size, focused }) => element (render the filled glyph when focused),
 *                  badge?: number,
 *                  accessibilityLabel? }]
 *   activeKey   key of the active item
 *   onSelect    (key) => void
 *   activeTone  'tint' (default: brand-tint indicator, violet icon + label). Legacy 'lavender' / 'night' /
 *               'brand' all resolve to 'tint'.
 *   showLabels  'active' (default: label only on the active pill) | 'all' | 'none'
 *   bottomInset number — extra lift (pass the bottom safe-area inset); default 0
 *   style       outer style (e.g. translateY for hide-on-scroll)
 *
 * Tokens: height 64, side inset space.lg (16), radius radii.dock (18), colors.surface + hairline, shadows.floating.
 * Accessibility: role tablist / tab with selected state; every item gets a ≥44pt target.
 *
 * Example
 *   <FloatingDock
 *     items={[{ key: 'Home', label: 'Home', icon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }, …]}
 *     activeKey={route.name}
 *     onSelect={(k) => navigation.navigate(k)}
 *     bottomInset={insets.bottom}
 *   />
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';
import { radii, space, type, z } from '../../constants/theme';
import { makeStyles, makeThemed, useTheme } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';
import { GlassSurface } from './GlassSurface';
import { PressableScale } from './PressableScale';
import { CountBadge } from './Badge';
import { useFlightDeferred } from './FlyToCart';

/** Badge count that changes when a fly-to-cart flight lands, not on tap. */
function DockBadge({ count }) {
    const styles = useStyles();
    const shown = useFlightDeferred(count || 0);
    if (!shown) return null;
    return (
        <View style={[styles.badge, { pointerEvents: 'none' }]}>
            <CountBadge count={shown} tone="ink" />
        </View>
    );
}

export const DOCK_HEIGHT = 64;
const PAD = 6;
const ICON = 24;

const DOCK_RADIUS = radii.dock;
const INDICATOR_RADIUS = 12;
const useTones = makeThemed(({ colors: c }) => {
    const TINT = { pill: c.brandTint, fg: c.brandText };
    return { tint: TINT, lavender: TINT, night: TINT, brand: TINT };
});

/**
 * The pill's x is DERIVED, not read from each item's onLayout `x`: on web onLayout only fires on
 * size changes (ResizeObserver), so when the active item widens its neighbours move without
 * reporting and the pill would land on the wrong tab. Only the row width and item widths are
 * measured; x follows from the space-between arithmetic, exact on every platform.
 */
export function FloatingDock({ items = [], activeKey, onSelect, activeTone = 'tint', showLabels = 'active', bottomInset = 0, style }) {
    const reduce = useReducedMotion();
    const TONES = useTones();
    const styles = useStyles();
    const { colors, shadows } = useTheme();
    const t = TONES[activeTone] || TONES.tint;
    const [rowW, setRowW] = useState(0);
    const [widths, setWidths] = useState({});

    const onRowLayout = useCallback((e) => setRowW(e.nativeEvent.layout.width), []);
    const measure = useCallback(
        (key) => (e) => {
            const w = e.nativeEvent.layout.width;
            setWidths((prev) => (prev[key] === w ? prev : { ...prev, [key]: w }));
        },
        [],
    );

    // x of the active item in the space-between row: sum(width + gap) of the items before it
    let pillX = 0;
    let pillW = 0;
    if (rowW && items.length && items.every((it) => widths[it.key] != null)) {
        const total = items.reduce((sum, it) => sum + widths[it.key], 0);
        const gap = items.length > 1 ? Math.max(0, (rowW - total) / (items.length - 1)) : 0;
        let x = items.length > 1 ? 0 : Math.max(0, (rowW - total) / 2);
        for (const it of items) {
            if (it.key === activeKey) {
                pillX = x;
                pillW = widths[it.key];
                break;
            }
            x += widths[it.key] + gap;
        }
    }

    const pillStyle = useAnimatedStyle(() => {
        if (!pillW) return { opacity: 0 };
        const go = (v) => (reduce ? withTiming(v, { duration: durations.fast, easing: easings.out }) : withSpring(v, springs.snappy));
        // the one sanctioned width animation (README section 3, rule 2): the pill hugs the active label
        return { opacity: 1, width: go(pillW), transform: [{ translateX: go(pillX) }] };
    }, [pillX, pillW, reduce]);

    return (
        <View style={[styles.wrap, { bottom: bottomInset + space.md }, style, { pointerEvents: 'box-none' }]}>
            <GlassSurface radius={DOCK_RADIUS} style={[styles.dock, shadows.floating]} accessibilityRole="tablist">
                <View style={styles.row} onLayout={onRowLayout}>
                    <Animated.View style={[styles.pill, { backgroundColor: t.pill }, pillStyle, { pointerEvents: 'none' }]} />
                    {items.map((it) => {
                        const focused = it.key === activeKey;
                        const fg = focused ? t.fg : colors.inkMuted;
                        const label = showLabels === 'all' || (showLabels === 'active' && focused);
                        return (
                            <PressableScale
                                key={it.key}
                                onPress={() => onSelect && onSelect(it.key)}
                                haptic={focused ? false : 'selection'}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: focused }}
                                accessibilityLabel={it.accessibilityLabel || it.label}
                                onLayout={measure(it.key)}
                                style={[styles.item, focused && label && styles.itemWide]}
                            >
                                <View>
                                    {it.icon({ color: fg, size: ICON, focused })}
                                    <DockBadge count={it.badge} />
                                </View>
                                {label ? (
                                    <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color: fg }]}>
                                        {it.label}
                                    </Animated.Text>
                                ) : null}
                            </PressableScale>
                        );
                    })}
                </View>
            </GlassSurface>
        </View>
    );
}

const useStyles = makeStyles((th) => ({
    wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: z.tabBar },
    dock: {
        height: DOCK_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: PAD,
        backgroundColor: th.colors.surface, // solid: white / dark surface #1A1A1A
        overflow: 'visible',
    },
    row: { flex: 1, height: DOCK_HEIGHT - PAD * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: INDICATOR_RADIUS },
    item: {
        height: DOCK_HEIGHT - PAD * 2,
        minWidth: 52,
        paddingHorizontal: space.md,
        borderRadius: INDICATOR_RADIUS,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemWide: { paddingHorizontal: space.lg },
    label: { ...type.label, fontFamily: type.button.fontFamily, marginLeft: space.sm },
    badge: { position: 'absolute', top: -6, right: -10 },
}));

export default FloatingDock;
