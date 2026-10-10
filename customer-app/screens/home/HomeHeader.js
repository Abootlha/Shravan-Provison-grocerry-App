/**
 * HomeHeader — the solid surface header at the top of Home (DESIGN.md "Home header").
 *
 *   ┌ GradientHeader (solid surface, hairline) ────────────────┐
 *   │ Delivery in 10 minutes                           (avatar) │  ← collapsible block (the one
 *   │ Home · 12 MG Road, Indiranagar ▾                         │    mixed-weight headline)
 *   │ [Free delivery above ₹200]  ● Open till 11 PM            │
 *   │ [ Search for 'milk'                             |  mic ] │  ← sticks
 *   │  All   Fruits   Dairy   Atta   Masala ...                │  ← sticks, violet underline
 *   └──────────────────────────────────────────────────────────┘
 *
 * Collapse is driven by the list's scroll offset (`scrollY`) on the UI thread: the header
 * translates up by the collapsible block's height while the block fades, so only search + tabs
 * stay pinned (with the floating shadow once pinned). No per-category re-tint: the selected tab's
 * violet underline is the only state colour.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { GradientHeader, Headline, PressableScale, Text } from '../../components/ui';
import SearchBar from '../../components/SearchBar';
import CategoryTabBar from '../../components/CategoryTabBar';
import { radii, space, z } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';

const HomeHeader = ({
    theme,
    scrollY,
    etaMinutes,
    storeBadge,
    offerLabel,
    addressType,
    addressLine,
    labels,
    avatarInitial,
    tabs,
    activeTabId,
    onTabSelect,
    onSearchPress,
    onAddressPress,
    onProfilePress,
    onMeasure,
}) => {
    const styles = useStyles();
    const { colors, gradients } = useTheme();
    const insets = useSafeAreaInsets();
    const [collapseH, setCollapseH] = useState(0);
    const collapse = useSharedValue(0);

    const onTopLayout = useCallback(
        (e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            collapse.value = h;
            setCollapseH(h);
        },
        [collapse],
    );
    const [rootH, setRootH] = useState(0);
    const onRootLayout = useCallback((e) => setRootH(Math.round(e.nativeEvent.layout.height)), []);
    useEffect(() => {
        if (rootH && onMeasure) onMeasure(rootH, collapseH);
    }, [rootH, collapseH, onMeasure]);

    const slide = useAnimatedStyle(() => {
        const y = Math.min(Math.max(scrollY.value, 0), collapse.value);
        return { transform: [{ translateY: -y }] };
    });
    const topBlock = useAnimatedStyle(() => {
        const h = collapse.value || 1;
        return {
            opacity: interpolate(scrollY.value, [0, h * 0.6], [1, 0], Extrapolation.CLAMP),
            transform: [{ translateY: interpolate(scrollY.value, [0, h], [0, h * 0.25], Extrapolation.CLAMP) }],
        };
    });
    const pinned = useAnimatedStyle(() => {
        const h = collapse.value || 1;
        return { opacity: interpolate(scrollY.value, [h - 24, h], [0, 1], Extrapolation.CLAMP) };
    });
    // the status-bar strip follows what's under it: header top colour → white once pinned
    const statusFill = useAnimatedStyle(() => {
        const h = collapse.value || 1;
        return { opacity: interpolate(scrollY.value, [0, h * 0.5], [0, 1], Extrapolation.CLAMP) };
    });

    return (
        <View style={[styles.root, { pointerEvents: 'box-none' }]}>
            <Animated.View style={slide} onLayout={onRootLayout}>
                {/* the floating shadow appears only once the bar is pinned */}
                <Animated.View style={[StyleSheet.absoluteFill, styles.shadowLayer, pinned, { pointerEvents: 'none' }]} />
                <GradientHeader gradient={gradients.header} rounded={false} style={styles.surface}>
                    <Animated.View style={[styles.top, topBlock]} onLayout={onTopLayout}>
                        <View style={styles.etaRow}>
                            <View style={styles.etaCopy}>
                                {/* the Home hero line — the screen's one mixed-weight headline */}
                                <Headline
                                    variant="h1"
                                    color={theme.ink}
                                    lead={labels.deliveryIn}
                                    emphasis={`${etaMinutes} ${labels.minutes}`}
                                    numberOfLines={1}
                                    accessibilityRole="header"
                                    accessibilityLabel={`${labels.deliveryIn} ${etaMinutes} ${labels.minutes}`}
                                />
                                <PressableScale
                                    onPress={onAddressPress}
                                    haptic="selection"
                                    scaleTo={press.subtle}
                                    accessibilityLabel={`${labels.deliverTo} ${addressType}, ${addressLine}`}
                                    style={styles.address}
                                    hitSlop={{ top: 8, bottom: 8 }}
                                >
                                    <Text variant="label" weight="medium" color={theme.ink} numberOfLines={1} style={styles.addressText}>
                                        <Text variant="label" weight="bold" color={theme.ink}>
                                            {addressType}
                                        </Text>
                                        {'  ·  '}
                                        {addressLine}
                                    </Text>
                                    <MaterialCommunityIcons name="chevron-down" size={18} color={theme.ink} />
                                </PressableScale>
                            </View>
                            <PressableScale
                                onPress={onProfilePress}
                                haptic="selection"
                                scaleTo={press.scale}
                                accessibilityRole="button"
                                accessibilityLabel={labels.profile}
                                style={styles.avatar}
                            >
                                {avatarInitial ? (
                                    <Text variant="title" weight="extrabold" color="brand">
                                        {avatarInitial}
                                    </Text>
                                ) : (
                                    <MaterialCommunityIcons name="account" size={22} color={colors.brandText} />
                                )}
                            </PressableScale>
                        </View>

                        {offerLabel || storeBadge ? (
                            <View style={styles.metaRow}>
                                {offerLabel ? (
                                    <View style={styles.offer}>
                                        <MaterialCommunityIcons name="truck-outline" size={14} color={colors.successInk} />
                                        <Text variant="caption" weight="bold" color="successInk" numberOfLines={1}>
                                            {offerLabel}
                                        </Text>
                                    </View>
                                ) : null}
                                {storeBadge ? (
                                    <View style={styles.store}>
                                        <View style={[styles.storeDot, !storeBadge.open && styles.storeDotClosed]} />
                                        <Text variant="caption" color={theme.inkSecondary} numberOfLines={1}>
                                            {storeBadge.label}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </Animated.View>

                    <SearchBar onPress={onSearchPress} style={styles.search} />
                    <CategoryTabBar tabs={tabs} activeTabId={activeTabId} onTabSelect={onTabSelect} ink={theme.ink} style={styles.tabs} />
                    <View style={styles.hairline} />
                </GradientHeader>
            </Animated.View>
            {/* keeps the status bar painted while the header slides underneath it */}
            <Animated.View style={[styles.statusFill, { height: insets.top }, statusFill, { pointerEvents: 'none' }]} />
        </View>
    );
};

const AVATAR = 44;

const useStyles = makeStyles((t) => ({
    root: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: z.header },
    surface: { paddingHorizontal: 0, paddingBottom: 0 },
    shadowLayer: { backgroundColor: t.colors.surface, ...t.shadows.md },
    statusFill: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: t.colors.surface },
    top: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.lg },
    etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    etaCopy: { flex: 1, paddingRight: space.md },
    address: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', marginTop: space.xxs },
    addressText: { flexShrink: 1 },
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.colors.surfaceRaised,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.colors.border,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
    offer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        height: 28,
        paddingHorizontal: space.sm,
        borderRadius: radii.chip,
        backgroundColor: t.colors.successTint,
    },
    store: { flexDirection: 'row', alignItems: 'center', gap: space.xs + space.xxs },
    storeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.success },
    storeDotClosed: { backgroundColor: t.colors.inkMuted },
    search: { marginHorizontal: space.gutter },
    tabs: { marginTop: space.sm },
    hairline: { height: StyleSheet.hairlineWidth * 2, backgroundColor: t.colors.hairline },
}));

export default memo(HomeHeader);
