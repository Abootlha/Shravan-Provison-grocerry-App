/**
 * Collapsible large-title header — iOS-style: a large title at the top of the scroll content
 * shrinks and slides away while a compact bar title fades in; the bar's frosted background and
 * bottom hairline fade in once content scrolls under it. Everything is driven by ONE scroll
 * SharedValue on the UI thread.
 *
 * useCollapsibleHeader({ scrollY?, range? }) → collapse
 *   scrollY     optional SharedValue you already own (e.g. shared with a FloatingCartBar);
 *               created for you when omitted
 *   range       px of scroll over which the title collapses (default 56)
 *   returns { scrollY, onScroll, largeTitleStyle, compactTitleStyle, barStyle, hairlineStyle, range }
 *     onScroll  an animated scroll handler — pass to Animated.ScrollView / Animated.FlatList /
 *               an Animated FlashList (Animated.createAnimatedComponent(FlashList)) with
 *               scrollEventThrottle={16}
 *
 * <CollapsibleHeader collapse title onBack right style />   the compact bar (absolute, top, safe-area aware)
 *   onBack      shows a back IconButton (accessibilityLabel 'Go back')
 *   right       element on the right (e.g. an IconButton)
 *   backLabel   i18n label for the back button
 * <LargeTitle collapse title subtitle style />                the big title — FIRST child of the scroll content
 *
 * The scroll content needs paddingTop = useCollapsibleHeaderHeight() so it starts below the bar.
 * Theme-aware: bar fill = colors.glassSolid (solid surface, no blur), hairline = colors.hairline.
 * Reduced motion: unchanged — it is scroll-linked, not time-based.
 *
 * Example
 *   const collapse = useCollapsibleHeader();
 *   const top = useCollapsibleHeaderHeight();
 *   <Screen edges={[]}>
 *     <Animated.ScrollView onScroll={collapse.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top }}>
 *       <LargeTitle collapse={collapse} title="Your orders" subtitle="12 orders" />
 *       …
 *     </Animated.ScrollView>
 *     <CollapsibleHeader collapse={collapse} title="Your orders" onBack={navigation.goBack} />
 *   </Screen>
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { space, z } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { Text } from './Text';
import { IconButton } from './IconButton';

const BAR = 52;

export function useCollapsibleHeader({ scrollY: external, range = 56 } = {}) {
    const own = useSharedValue(0);
    const scrollY = external || own;
    const onScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });
    const largeTitleStyle = useAnimatedStyle(() => {
        const y = scrollY.value;
        return {
            opacity: interpolate(y, [0, range * 0.7], [1, 0], 'clamp'),
            transform: [
                { translateY: interpolate(y, [-100, 0, range], [24, 0, -8], 'clamp') },
                { scale: interpolate(y, [-100, 0, range], [1.08, 1, 0.92], 'clamp') },
            ],
        };
    });
    const compactTitleStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [range * 0.6, range], [0, 1], 'clamp'),
        transform: [{ translateY: interpolate(scrollY.value, [range * 0.6, range], [6, 0], 'clamp') }],
    }));
    const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, range * 0.5], [0, 1], 'clamp') }));
    const hairlineStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [range * 0.6, range], [0, 1], 'clamp') }));
    return { scrollY, onScroll, largeTitleStyle, compactTitleStyle, barStyle, hairlineStyle, range };
}

/** Height of the compact bar including the top safe-area inset — use as the scroll content's paddingTop. */
export function useCollapsibleHeaderHeight() {
    return useSafeAreaInsets().top + BAR;
}

export function CollapsibleHeader({ collapse, title, onBack, backLabel = 'Go back', right, style }) {
    const insets = useSafeAreaInsets();
    const styles = useStyles();
    return (
        <View style={[styles.wrap, { paddingTop: insets.top, height: insets.top + BAR }, style, { pointerEvents: 'box-none' }]}>
            <Animated.View style={[StyleSheet.absoluteFill, collapse.barStyle, { pointerEvents: 'none' }]}>
                <View style={[StyleSheet.absoluteFill, styles.fill]} />
            </Animated.View>
            <Animated.View style={[styles.hairline, collapse.hairlineStyle, { pointerEvents: 'none' }]} />
            <View style={[styles.row, { pointerEvents: 'box-none' }]}>
                <View style={styles.side}>
                    {onBack ? <IconButton name="arrow-left" variant="ghost" accessibilityLabel={backLabel} onPress={onBack} /> : null}
                </View>
                <Animated.View style={[styles.titleWrap, collapse.compactTitleStyle, { pointerEvents: 'none' }]}>
                    <Text variant="title" numberOfLines={1} accessibilityRole="header">
                        {title}
                    </Text>
                </Animated.View>
                <View style={[styles.side, styles.sideRight]}>{right}</View>
            </View>
        </View>
    );
}

export function LargeTitle({ collapse, title, subtitle, style }) {
    const styles = useStyles();
    return (
        <Animated.View style={[styles.large, collapse.largeTitleStyle, style]}>
            <Text variant="h1" accessibilityRole="header" numberOfLines={2}>
                {title}
            </Text>
            {subtitle ? (
                <Text variant="body" color="muted" style={styles.sub}>
                    {subtitle}
                </Text>
            ) : null}
        </Animated.View>
    );
}

const useStyles = makeStyles((t) => ({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: z.header },
    fill: { backgroundColor: t.colors.glassSolid }, // solid surface (DESIGN.md: blur only over photos / maps)
    hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: t.colors.hairline },
    row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
    side: { width: 56, alignItems: 'flex-start', justifyContent: 'center' },
    sideRight: { alignItems: 'flex-end' },
    titleWrap: { flex: 1, alignItems: 'center' },
    large: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.md, transformOrigin: 'left center' },
    sub: { marginTop: space.xxs },
}));

export default CollapsibleHeader;
