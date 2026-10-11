/**
 * Home body sections: plain section headers (sentence case, Jakarta h2), product rails, the
 * "Shop by category" grid and the loading skeleton. Rows are memoized; rails are horizontal
 * FlashLists so long rails recycle. Rails show ~2.5 cards so the next one peeks.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { icon3dFor, PressableScale, Skeleton, SkeletonGroup, SkeletonProductTile, Text } from '../../components/ui';
import ProductCard, { PRODUCT_CARD_SIZES } from '../../components/ProductCard';
import CategoryCard from '../../components/CategoryCard';
import { space } from '../../constants/theme';
import { useTheme } from '../../theme';
import { glyphOf, idOf, imageOf, nameOf, toCardProduct } from './catalog';

const GRID_COLUMNS = 4;
const GRID_GAP = space.md;
const RAIL_GAP = space.md;

/** The ProductCard variant whose width is closest to "2.5 cards visible" on this screen. */
export function useRailVariant() {
    const { width } = useWindowDimensions();
    return useMemo(() => {
        const ideal = (width - space.gutter - RAIL_GAP * 2) / 2.5;
        const sizes = PRODUCT_CARD_SIZES || {};
        const keys = ['compact', 'regular', 'large'].filter((k) => sizes[k]);
        if (!keys.length) return { variant: undefined, width: 156 };
        const best = keys.reduce((a, k) => (Math.abs(sizes[k].width - ideal) < Math.abs(sizes[a].width - ideal) ? k : a), keys[0]);
        return { variant: best, width: sizes[best].width };
    }, [width]);
}

// ---------------------------------------------------------------------------
// Section header — a plain title ("Buy again", "Shop by category"). The mixed-weight Headline is
// reserved for the Home hero line (DESIGN.md), so lead/emphasis/trail are joined into one string.
// ---------------------------------------------------------------------------

export const HomeSectionHeader = memo(({ title, lead, emphasis, trail, subtitle, actionLabel, onSeeAll, style }) => {
    const { colors } = useTheme();
    const label = [lead, emphasis, trail].filter(Boolean).join(' ') || title;
    return (
        <View style={[styles.header, style]}>
            <View style={styles.headerTitles}>
                <Text variant="h2" accessibilityRole="header" numberOfLines={1}>
                    {label}
                </Text>
                {subtitle ? (
                    <Text variant="caption" color="muted" numberOfLines={1} style={styles.headerSub}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {onSeeAll ? (
                <PressableScale
                    onPress={onSeeAll}
                    haptic="selection"
                    accessibilityRole="link"
                    accessibilityLabel={`${actionLabel || 'See all'} ${label}`}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                    style={styles.action}
                >
                    <Text variant="label" color="brand">
                        {actionLabel || 'See all'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brandText} />
                </PressableScale>
            ) : null}
        </View>
    );
});

// ---------------------------------------------------------------------------
// Product rail
// ---------------------------------------------------------------------------

const RailItem = memo(({ item, language, variant, onProductPress }) => {
    const product = useMemo(() => toCardProduct(item, language), [item, language]);
    const onPress = useCallback(() => onProductPress(item), [onProductPress, item]);
    return <ProductCard product={product} variant={variant} onPress={onPress} />;
});

const RailSeparator = () => <View style={styles.railGap} />;

/** Horizontal product list (recycled). `contentStyle` overrides the gutter padding (e.g. inside a card). */
export const RailList = memo(({ products, language, onProductPress, contentStyle }) => {
    const { variant } = useRailVariant();
    const renderItem = useCallback(
        ({ item }) => <RailItem item={item} language={language} variant={variant} onProductPress={onProductPress} />,
        [language, variant, onProductPress],
    );
    return (
        <FlashList
            horizontal
            data={products}
            renderItem={renderItem}
            keyExtractor={keyOf}
            extraData={`${language}-${variant}`}
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={RailSeparator}
            contentContainerStyle={contentStyle || styles.railContent}
        />
    );
});

export const ProductRail = memo(({ title, lead, emphasis, trail, subtitle, products, language, onProductPress, onSeeAll, actionLabel }) => (
    <View style={styles.section}>
        <HomeSectionHeader
            title={title}
            lead={lead}
            emphasis={emphasis}
            trail={trail}
            subtitle={subtitle}
            actionLabel={actionLabel}
            onSeeAll={onSeeAll}
        />
        <RailList products={products} language={language} onProductPress={onProductPress} />
    </View>
));

const keyOf = (item) => String(item._id || item.id);

// ---------------------------------------------------------------------------
// Shop by category grid
// ---------------------------------------------------------------------------

const gridTile = (width) => Math.floor((width - space.gutter * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

export const CategoryGrid = memo(({ lead, emphasis, title, actionLabel, categories, language, onCategoryPress, onSeeAll }) => {
    const { width } = useWindowDimensions();
    const tile = gridTile(width);
    return (
        <View style={styles.gridSection}>
            <HomeSectionHeader title={title} lead={lead} emphasis={emphasis} actionLabel={actionLabel} onSeeAll={onSeeAll} />
            <View style={styles.grid}>
                {categories.map((cat, i) => (
                    <GridTile key={idOf(cat) || i} cat={cat} index={i} width={tile} language={language} onCategoryPress={onCategoryPress} />
                ))}
            </View>
        </View>
    );
});

const GridTile = memo(({ cat, index, width, language, onCategoryPress }) => {
    const category = useMemo(
        () => ({ id: idOf(cat), name: nameOf(cat, language), icon: glyphOf(cat, 'basket-outline'), image: imageOf(cat), icon3d: icon3dFor(cat) }),
        [cat, language],
    );
    const onPress = useCallback(() => onCategoryPress(cat), [onCategoryPress, cat]);
    return <CategoryCard category={category} index={index} width={width} onPress={onPress} />;
});

// ---------------------------------------------------------------------------
// Skeletons (mirror the real geometry)
// ---------------------------------------------------------------------------

export const RailSkeleton = memo(() => {
    const { width: cardW } = useRailVariant();
    return (
        <SkeletonGroup style={styles.section}>
            <View style={styles.header}>
                <Skeleton width={180} height={22} radius="xs" />
            </View>
            <View style={styles.skeletonRail}>
                {[0, 1, 2].map((i) => (
                    <SkeletonProductTile key={i} width={cardW} />
                ))}
            </View>
        </SkeletonGroup>
    );
});

export const HomeSkeleton = memo(({ showBanner = true }) => {
    const { width } = useWindowDimensions();
    const bannerW = width - space.gutter * 2;
    const tile = gridTile(width);
    return (
        <View>
            {showBanner ? (
                <SkeletonGroup style={styles.bannerBone}>
                    <Skeleton width={bannerW} height={Math.round(bannerW / 2)} radius="md" />
                </SkeletonGroup>
            ) : null}
            <SkeletonGroup style={styles.section}>
                <View style={styles.header}>
                    <Skeleton width={200} height={22} />
                </View>
                <View style={styles.grid}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <View key={i} style={{ width: tile }}>
                            <Skeleton width={tile} height={tile} radius="md" />
                            <Skeleton width={tile * 0.8} height={10} style={styles.boneLabel} />
                        </View>
                    ))}
                </View>
            </SkeletonGroup>
            <RailSkeleton />
        </View>
    );
});

// Rhythm: rails sit 32 apart; the category grid tucks in closer (it reads as navigation, not a
// shelf); editorial blocks (EditorialSections) open wider at 40 to mark a change of pace.
const styles = StyleSheet.create({
    section: { marginTop: space['3xl'] },
    gridSection: { marginTop: space['2xl'] },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: space.gutter,
        marginBottom: space.lg,
    },
    headerTitles: { flex: 1, paddingRight: space.md },
    headerSub: { marginTop: space.xxs },
    action: { flexDirection: 'row', alignItems: 'center', minHeight: 24, marginBottom: space.xxs },
    railContent: { paddingHorizontal: space.gutter, paddingBottom: space.xs },
    railGap: { width: RAIL_GAP },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: space.gutter,
        columnGap: GRID_GAP,
        rowGap: space.xl,
    },
    skeletonRail: { flexDirection: 'row', gap: RAIL_GAP, paddingHorizontal: space.gutter },
    bannerBone: { alignItems: 'center', marginTop: space.lg },
    boneLabel: { marginTop: space.sm, alignSelf: 'center' },
});
