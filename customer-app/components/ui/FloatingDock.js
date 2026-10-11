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
 * Width: the dock fills the screen minus the 16pt insets, capped at DOCK_MAX_WIDTH and centred on
 * tablets / desktop web. Tabs share that width: the active tab takes what its icon + label need
 * (label measured off-screen, so font scale and Hindi labels are accounted for) and the rest split
 * the remainder evenly (never below 44). When the label can't fit, the active tab first tightens its
 * padding, then truncates the label, and on very narrow screens goes icon-only. Nothing overflows.
 *
 * Example
 *   <FloatingDock
 *     items={[{ key: 'Home', label: 'Home', icon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }, …]}
 *     activeKey={route.name}
 *     onSelect={(k) => navigation.navigate(k)}
 *     bottomInset={insets.bottom}
 *   />
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
/** Widest the dock gets (tablet / desktop web); it centres beyond this. */
export const DOCK_MAX_WIDTH = 480;
const PAD = 6;
const ICON = 24;
const MIN_TAB = 44; // inactive tab floor = the touch target
const LABEL_FONT_SCALE = 1.2;
// Active-tab padding tiers: roomy first, then tight; below that the label truncates, then drops.
const ROOMY = { pad: space.lg, gap: space.sm };
const TIGHT = { pad: space.sm, gap: 6 };
const SNUG = { pad: 6, gap: space.xs };
// Truncate only when nearly all of the word stays readable; otherwise the active tab goes icon-only
// (the tint pill + filled glyph still mark it, and the a11y label keeps the name).
const MIN_VISIBLE = 0.9;
const MIN_LABEL = 36;

const DOCK_RADIUS = radii.dock;
const INDICATOR_RADIUS = 12;
const useTones = makeThemed(({ colors: c }) => {
    const TINT = { pill: c.brandTint, fg: c.brandText };
    return { tint: TINT, lavender: TINT, night: TINT, brand: TINT };
});

/**
 * Tab widths for a row `rowW` wide. Pure arithmetic, so the pill's x is exact on every platform
 * (on web onLayout only fires on size changes, so a neighbour's reported x goes stale after a reflow).
 * Returns { widths: number[], mode: 'roomy' | 'tight' | 'snug' | 'truncate' | 'icon' }.
 */
export function layoutDock({ rowW, count, activeIndex, labelW, withLabel }) {
    const even = rowW / count;
    if (!withLabel || activeIndex < 0 || count < 2 || labelW == null) {
        return { widths: Array(count).fill(even), mode: 'icon' };
    }
    const room = rowW - (count - 1) * MIN_TAB; // the most the active tab may take
    // +2: onLayout widths are rounded (web reports whole pixels), so leave room for the sub-pixel rest
    const need = (tier) => tier.pad * 2 + ICON + tier.gap + labelW + 2;
    let mode;
    let activeW;
    if (need(ROOMY) <= room) {
        mode = 'roomy';
        activeW = need(ROOMY);
    } else if (need(TIGHT) <= room) {
        mode = 'tight';
        activeW = need(TIGHT);
    } else if (need(SNUG) <= room) {
        mode = 'snug';
        activeW = need(SNUG);
    } else if (room - (SNUG.pad * 2 + ICON + SNUG.gap) >= Math.max(MIN_LABEL, labelW * MIN_VISIBLE)) {
        mode = 'truncate';
        activeW = room;
    } else {
        return { widths: Array(count).fill(even), mode: 'icon' };
    }
    activeW = Math.max(activeW, even);
    const rest = (rowW - activeW) / (count - 1);
    return { widths: Array.from({ length: count }, (_, i) => (i === activeIndex ? activeW : rest)), mode };
}

export function FloatingDock({ items = [], activeKey, onSelect, activeTone = 'tint', showLabels = 'active', bottomInset = 0, style }) {
    const reduce = useReducedMotion();
    const TONES = useTones();
    const styles = useStyles();
    const { colors, shadows } = useTheme();
    const t = TONES[activeTone] || TONES.tint;
    const [rowW, setRowW] = useState(0);
    const [labelWs, setLabelWs] = useState({});

    const onRowLayout = useCallback((e) => setRowW(e.nativeEvent.layout.width), []);
    const measureLabel = useCallback(
        (key) => (e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            setLabelWs((prev) => (prev[key] === w ? prev : { ...prev, [key]: w }));
        },
        [],
    );

    const activeIndex = items.findIndex((it) => it.key === activeKey);
    const activeItem = items[activeIndex];
    const wantsLabel = showLabels === 'active';
    const { widths, mode } = rowW
        ? layoutDock({
              rowW,
              count: items.length,
              activeIndex,
              labelW: activeItem ? labelWs[activeItem.key] : null,
              withLabel: wantsLabel,
          })
        : { widths: null, mode: 'icon' };
    const tier = mode === 'roomy' ? ROOMY : mode === 'tight' ? TIGHT : SNUG;

    let pillX = 0;
    let pillW = 0;
    if (widths && activeIndex >= 0) {
        for (let i = 0; i < activeIndex; i += 1) pillX += widths[i];
        pillW = widths[activeIndex];
    }

    // Spring only when the active tab changes; a resize, rotation or font change snaps into place.
    const x = useSharedValue(0);
    const w = useSharedValue(0);
    const lastKey = useRef(null);
    useEffect(() => {
        if (!pillW) return;
        const switched = lastKey.current != null && lastKey.current !== activeKey;
        lastKey.current = activeKey;
        if (!switched) {
            x.value = pillX;
            w.value = pillW;
            return;
        }
        const go = (v) => (reduce ? withTiming(v, { duration: durations.fast, easing: easings.out }) : withSpring(v, springs.snappy));
        x.value = go(pillX);
        // the one sanctioned width animation (README section 3, rule 2): the pill hugs the active label
        w.value = go(pillW);
    }, [activeKey, pillX, pillW, reduce]);

    const pillStyle = useAnimatedStyle(() => (w.value ? { opacity: 1, width: w.value, transform: [{ translateX: x.value }] } : { opacity: 0 }));

    return (
        <View style={[styles.wrap, { bottom: bottomInset + space.md }, style, { pointerEvents: 'box-none' }]}>
            {/* the shadow lives on the shell so the dock itself can clip without losing it on iOS */}
            <View style={[styles.shell, shadows.floating]}>
                <GlassSurface radius={DOCK_RADIUS} style={styles.dock} accessibilityRole="tablist">
                    {/* off-screen label measurement: natural widths at the current font scale and language */}
                    <View
                        style={[styles.measure, { pointerEvents: 'none' }]}
                        aria-hidden
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                    >
                        {items.map((it) => (
                            <Animated.Text
                                key={it.key}
                                onLayout={measureLabel(it.key)}
                                maxFontSizeMultiplier={LABEL_FONT_SCALE}
                                numberOfLines={1}
                                style={[styles.label, styles.measureText]}
                            >
                                {it.label}
                            </Animated.Text>
                        ))}
                    </View>
                    <View style={styles.row} onLayout={onRowLayout}>
                        <Animated.View style={[styles.pill, { backgroundColor: t.pill }, pillStyle, { pointerEvents: 'none' }]} />
                        {items.map((it, i) => {
                            const focused = it.key === activeKey;
                            const fg = focused ? t.fg : colors.inkMuted;
                            const label = showLabels === 'all' || (focused && wantsLabel && mode !== 'icon');
                            return (
                                <PressableScale
                                    key={it.key}
                                    onPress={() => onSelect && onSelect(it.key)}
                                    haptic={focused ? false : 'selection'}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: focused }}
                                    accessibilityLabel={it.accessibilityLabel || it.label}
                                    style={[styles.item, widths ? { width: widths[i] } : styles.itemFlex, label && focused && { paddingHorizontal: tier.pad }]}
                                >
                                    <View>
                                        {it.icon({ color: fg, size: ICON, focused })}
                                        <DockBadge count={it.badge} />
                                    </View>
                                    {label ? (
                                        <Animated.Text
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            maxFontSizeMultiplier={LABEL_FONT_SCALE}
                                            style={[styles.label, styles.labelShrink, { color: fg, marginLeft: tier.gap }]}
                                        >
                                            {it.label}
                                        </Animated.Text>
                                    ) : null}
                                </PressableScale>
                            );
                        })}
                    </View>
                </GlassSurface>
            </View>
        </View>
    );
}

const useStyles = makeStyles((th) => ({
    wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: z.tabBar, alignItems: 'center' },
    shell: { width: '100%', maxWidth: DOCK_MAX_WIDTH, borderRadius: DOCK_RADIUS, backgroundColor: th.colors.surface },
    dock: {
        height: DOCK_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: PAD,
        backgroundColor: th.colors.surface, // solid: white / dark surface #1A1A1A
        overflow: 'hidden',
    },
    row: { flex: 1, minWidth: 0, height: DOCK_HEIGHT - PAD * 2, flexDirection: 'row', alignItems: 'center' },
    pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: INDICATOR_RADIUS },
    item: {
        height: DOCK_HEIGHT - PAD * 2,
        paddingHorizontal: space.xs,
        borderRadius: INDICATOR_RADIUS,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemFlex: { flex: 1 },
    label: { ...type.label, fontFamily: type.button.fontFamily },
    labelShrink: { flexShrink: 1, minWidth: 0 },
    measure: { position: 'absolute', top: 0, left: 0, width: 2000, opacity: 0, alignItems: 'flex-start' },
    measureText: { alignSelf: 'flex-start' },
    badge: { position: 'absolute', top: -6, right: -10 },
}));

export default FloatingDock;
