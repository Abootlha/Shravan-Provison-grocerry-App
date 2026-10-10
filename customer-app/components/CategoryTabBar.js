/**
 * CategoryTabBar — the icon + label category row at the bottom of the Home header (Part C #2,
 * Zepto pattern). Each tab shows its category's 3D icon (Icon3D, identification only): inactive ones sit a little smaller and
 * quieter, the active one comes up to full size, its label goes night and a 3pt violet underline slides to it on a spring (transform only:
 * translateX + scaleX of a fixed bar). The row auto-scrolls to keep the selection in view.
 *
 * Props
 *   tabs          [{ id, label, icon3d? (Icon3D name), icon? (MCI glyph fallback) }]
 *   activeTabId
 *   onTabSelect   (id) => void
 *   ink           label / icon colour for the active tab on the current header surface
 *   inkMuted      label / icon colour for inactive tabs (default: the theme's inkSecondary)
 *   style
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Icon3D, PressableScale, Text } from './ui';
import { fontFamily, radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings, press } from '../theme/motion';

const BAR_BASE = 100; // underline drawn at this width, then scaled to the tab's label width
const BAR_H = 3;
const STICKER = 30;

const Tab = memo(({ tab, selected, ink, inkMuted, onSelect, onLayoutTab }) => {
    const styles = useStyles();
    const color = selected ? ink : inkMuted;
    const handlePress = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);
    const handleLayout = useCallback((e) => onLayoutTab(tab.id, e.nativeEvent.layout), [onLayoutTab, tab.id]);

    return (
        <PressableScale
            onPress={handlePress}
            haptic="selection"
            scaleTo={press.scale}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onLayout={handleLayout}
            style={styles.tab}
        >
            {tab.icon3d ? (
                <View style={[styles.sticker, !selected && styles.stickerIdle]}>
                    <Icon3D name={tab.icon3d} size={STICKER} />
                </View>
            ) : (
                <MaterialCommunityIcons name={tab.icon || 'shape-outline'} size={24} color={color} />
            )}
            <Text variant="caption" color={color} numberOfLines={1} style={styles.label}>
                {tab.label}
            </Text>
        </PressableScale>
    );
});

const CategoryTabBar = ({ tabs = [], activeTabId, onTabSelect, ink: inkProp, inkMuted: inkMutedProp, style }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const ink = inkProp || colors.ink;
    const inkMuted = inkMutedProp || colors.inkSecondary;
    const reduce = useReducedMotion();
    const scrollRef = useRef(null);
    const viewport = useRef(0);
    const [layouts, setLayouts] = useState({});
    const x = useSharedValue(0);
    const w = useSharedValue(0);
    const placed = useRef(false);

    const onLayoutTab = useCallback((id, layout) => {
        setLayouts((prev) => (prev[id]?.x === layout.x && prev[id]?.width === layout.width ? prev : { ...prev, [id]: layout }));
    }, []);

    const active = layouts[activeTabId];

    useEffect(() => {
        if (!active) return;
        // underline hugs the tab's content, inset from the tab's padding
        const inset = space.md;
        const tx = active.x + inset;
        const tw = Math.max(active.width - inset * 2, 20);
        if (!placed.current || reduce) {
            placed.current = true;
            x.value = reduce ? withTiming(tx, { duration: durations.fast, easing: easings.out }) : tx;
            w.value = reduce ? withTiming(tw, { duration: durations.fast, easing: easings.out }) : tw;
        } else {
            x.value = withSpring(tx, springs.snappy);
            w.value = withSpring(tw, springs.snappy);
        }
        if (scrollRef.current && viewport.current) {
            const target = Math.max(0, active.x + active.width / 2 - viewport.current / 2);
            scrollRef.current.scrollTo({ x: target, animated: true });
        }
    }, [active?.x, active?.width, reduce]);

    const underline = useAnimatedStyle(() => ({
        opacity: w.value > 0 ? 1 : 0,
        transform: [{ translateX: x.value }, { scaleX: w.value / BAR_BASE }],
    }));

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            onLayout={(e) => {
                viewport.current = e.nativeEvent.layout.width;
            }}
            style={style}
            accessibilityRole="tablist"
        >
            {tabs.map((tab) => (
                <Tab
                    key={tab.id}
                    tab={tab}
                    selected={tab.id === activeTabId}
                    ink={ink}
                    inkMuted={inkMuted}
                    onSelect={onTabSelect}
                    onLayoutTab={onLayoutTab}
                />
            ))}
            <View style={styles.tail} />
            <Animated.View style={[styles.underline, underline, { pointerEvents: 'none' }]} />
        </ScrollView>
    );
};

const useStyles = makeStyles((t) => ({
    row: { paddingHorizontal: space.xs, alignItems: 'flex-end' },
    tab: {
        minWidth: 64,
        minHeight: 56,
        paddingHorizontal: space.md,
        paddingTop: space.xs,
        paddingBottom: space.sm + BAR_H,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    sticker: { width: STICKER, height: STICKER },
    stickerIdle: { opacity: 0.8, transform: [{ scale: 0.86 }] },
    label: { marginTop: space.xs, maxWidth: 96, fontFamily: fontFamily.semibold }, // one weight for all tabs so selection never reflows the row
    tail: { width: space.xs },
    underline: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: BAR_BASE,
        height: BAR_H,
        borderTopLeftRadius: radii.xs,
        borderTopRightRadius: radii.xs,
        backgroundColor: t.colors.brandText, // a 3pt line reads as an indicator, so it takes the text-safe violet
        transformOrigin: 'left center',
    },
}));

export default memo(CategoryTabBar);
