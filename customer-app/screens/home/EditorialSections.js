/**
 * Editorial Home sections — the curated layouts that break up the rail rhythm.
 *
 *   MomentSection   time-of-day card: flat surface + hairline, a greeting line, a plain title and a
 *                   clean row of three pack shots on image wells (each opens its product), then
 *                   the rest of the collection as a rail below the card
 *   PriceStore      "Shop by price" chip row → client-filtered rail
 *   FreshSection    produce spotlight: big 2-up image-well tiles with freshness chips when the
 *                   record carries storage / shelf-life data (plain tiles otherwise)
 *   SeasonBlock     config-driven seasonal card: flat surface + hairline, plain title, and the
 *                   season's rail inset inside the card
 *   Reveal          first-view-only fade + rise; the first screenful staggers, later sections
 *                   enter as they scroll in, and nothing replays on recycle or revisit
 *
 * All copy arrives translated from collections.js; nothing here hard-codes a string.
 */
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { AddToCartButton, Chip, PressableScale, PriceTag, Text, useStaggeredEntrance } from '../../components/ui';
import ProductImage from '../../components/product/ProductImage';
import { normalizeProduct } from '../../components/product/productUtils';
import { addToCart, decrementQuantity, incrementQuantity } from '../../store/slices/cartSlice';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { HomeSectionHeader, RailList } from './HomeSections';
import { fmt } from './collections';

// ---------------------------------------------------------------------------
// Reveal — entrance on first view only
// ---------------------------------------------------------------------------

/**
 * `seen` is a ref'd Set owned by HomeScreen (cleared never; a refresh keeps sections still).
 * `stagger` is true only during the first paint, so sections below the fold enter with no delay.
 */
export const Reveal = ({ id, index, seen, stagger, children }) => {
    const [already] = useState(() => {
        const was = seen.current.has(id);
        seen.current.add(id);
        return was;
    });
    const style = useStaggeredEntrance(stagger ? index : 0, { disabled: already, offsetY: 16 });
    return <Animated.View style={style}>{children}</Animated.View>;
};

// ---------------------------------------------------------------------------
// Moment — editorial card + rail
// ---------------------------------------------------------------------------

const ROW_COUNT = 3;

/** One pack shot on an image well; opens its product. */
const MomentWell = memo(({ product, size, language, onProductPress }) => {
    const onPress = useCallback(() => onProductPress(product), [onProductPress, product]);
    const name = (language === 'hi' && product.translatedName) || product.name || '';
    return (
        <PressableScale onPress={onPress} scaleTo={press.subtle} accessibilityRole="button" accessibilityLabel={name}>
            <ProductImage uri={product.image || product.images?.[0]} variant="card" size={size} recyclingKey={product._id || product.id} />
        </PressableScale>
    );
});

/** Card head shared by Moment and Season: an optional greeting line, a plain title, a count line. */
const CardHead = memo(({ section }) => {
    const styles = useStyles();
    const title = [section.lead, section.emphasis, section.trail].filter(Boolean).join(' ');
    return (
        <View style={styles.cardHead}>
            {section.eyebrow ? (
                <Text variant="caption" color="muted" numberOfLines={1}>
                    {section.eyebrow}
                </Text>
            ) : null}
            <Text variant="h2" accessibilityRole="header" numberOfLines={2}>
                {title}
            </Text>
            {section.subtitle ? (
                <Text variant="caption" color="secondary" numberOfLines={2}>
                    {section.subtitle}
                </Text>
            ) : null}
        </View>
    );
});

export const MomentSection = memo(({ section, language, onProductPress }) => {
    const styles = useStyles();
    const { width } = useWindowDimensions();
    // three equal wells across the card's inner width
    const inner = width - space.gutter * 2 - space.lg * 2;
    const well = Math.floor((inner - space.sm * (ROW_COUNT - 1)) / ROW_COUNT);
    const picks = section.products.slice(0, ROW_COUNT);
    const rest = section.products.slice(ROW_COUNT);
    return (
        <View style={styles.editorialSection}>
            <View style={styles.card}>
                <CardHead section={section} />
                <View style={styles.wellRow}>
                    {picks.map((p) => (
                        <MomentWell key={p._id || p.id} product={p} size={well} language={language} onProductPress={onProductPress} />
                    ))}
                </View>
            </View>
            {rest.length ? (
                <View style={styles.railBelow}>
                    <RailList products={rest} language={language} onProductPress={onProductPress} />
                </View>
            ) : null}
        </View>
    );
});

// ---------------------------------------------------------------------------
// Price store — chips → filtered rail
// ---------------------------------------------------------------------------

export const PriceStore = memo(({ section, language, onProductPress, filterLabel }) => {
    const styles = useStyles();
    const [active, setActive] = useState(section.stores[0].max);
    const store = section.stores.find((s) => s.max === active) || section.stores[0];
    return (
        <View style={styles.section}>
            <HomeSectionHeader lead={section.lead} emphasis={section.emphasis} trail={section.trail} />
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                accessibilityRole="tablist"
                accessibilityLabel={filterLabel}
            >
                {section.stores.map((s) => (
                    <Chip
                        key={s.max}
                        label={s.label}
                        caption={s.caption}
                        selected={s.max === store.max}
                        onPress={() => setActive(s.max)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: s.max === store.max }}
                    />
                ))}
            </ScrollView>
            <RailList key={store.max} products={store.products} language={language} onProductPress={onProductPress} />
        </View>
    );
});

// ---------------------------------------------------------------------------
// Fresh — 2-up produce tiles
// ---------------------------------------------------------------------------

const FreshChip = memo(({ freshness, labels }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    if (!freshness) return null;
    const chilled = freshness.kind === 'chilled';
    const label = chilled ? labels.chilled : fmt(freshness.days === 1 ? labels.shelfOne : labels.shelf, { n: freshness.days });
    return (
        <View style={styles.freshChip}>
            <MaterialCommunityIcons name={chilled ? 'snowflake' : 'leaf'} size={12} color={colors.successInk} />
            <Text variant="caption" weight="semibold" color="successInk" numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
});

const FreshTile = memo(({ item, width, language, labels, addLabel, soldOutLabel, onProductPress }) => {
    const styles = useStyles();
    const dispatch = useDispatch();
    const raw = item.product;
    const product = useMemo(() => normalizeProduct(raw, language === 'hi' ? raw.translatedName : raw.name), [raw, language]);
    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === product.id)?.quantity || 0);
    const onPress = useCallback(() => onProductPress(raw), [onProductPress, raw]);
    // the cart keeps the source-language name (rows translate on render)
    const onAdd = useCallback(() => dispatch(addToCart({ ...product, name: raw.name || product.name })), [dispatch, product, raw]);
    const onInc = useCallback(() => dispatch(incrementQuantity(product.id)), [dispatch, product.id]);
    const onDec = useCallback(() => dispatch(decrementQuantity(product.id)), [dispatch, product.id]);
    const hasMrp = product.originalPrice > product.price;
    return (
        <PressableScale
            container
            onPress={onPress}
            scaleTo={press.subtle}
            style={[styles.freshTile, { width }]}
            accessibilityLabel={`${product.name}${product.unit ? `, ${product.unit}` : ''}, ₹${product.price}`}
        >
            <View style={[styles.freshWell, { width, height: width }]}>
                <ProductImage uri={product.image} variant="card" size={width} radius={radii.card} recyclingKey={product.id} />
                <FreshChip freshness={item.freshness} labels={labels} />
                <AddToCartButton
                    size="md"
                    quantity={quantity}
                    productName={product.name}
                    outOfStock={!product.inStock}
                    label={addLabel}
                    outOfStockLabel={soldOutLabel}
                    onAdd={onAdd}
                    onIncrement={onInc}
                    onDecrement={onDec}
                    style={styles.freshAdd}
                />
            </View>
            <PriceTag price={product.price} mrp={hasMrp ? product.originalPrice : null} size="sm" style={styles.freshPrice} />
            <Text variant="label" weight="medium" numberOfLines={2} style={styles.freshName}>
                {product.name}
            </Text>
            {product.unit ? (
                <Text variant="caption" color="muted" numberOfLines={1}>
                    {product.unit}
                </Text>
            ) : null}
        </PressableScale>
    );
});

export const FreshSection = memo(({ section, language, labels, addLabel, soldOutLabel, actionLabel, onProductPress, onSeeAll }) => {
    const styles = useStyles();
    const { width } = useWindowDimensions();
    const tileW = Math.floor((width - space.gutter * 2 - space.md) / 2);
    return (
        <View style={styles.editorialSection}>
            <HomeSectionHeader
                lead={section.lead}
                emphasis={section.emphasis}
                trail={section.trail}
                subtitle={section.subtitle}
                actionLabel={actionLabel}
                onSeeAll={onSeeAll}
            />
            <View style={styles.freshGrid}>
                {section.products.map((item) => (
                    <FreshTile
                        key={item.product._id}
                        item={item}
                        width={tileW}
                        language={language}
                        labels={labels}
                        addLabel={addLabel}
                        soldOutLabel={soldOutLabel}
                        onProductPress={onProductPress}
                    />
                ))}
            </View>
        </View>
    );
});

// ---------------------------------------------------------------------------
// Season — themed block
// ---------------------------------------------------------------------------

export const SeasonBlock = memo(({ section, language, onProductPress }) => {
    const styles = useStyles();
    return (
        <View style={styles.editorialSection}>
            <View style={[styles.card, styles.seasonCard]}>
                <View style={styles.seasonHead}>
                    <CardHead section={section} />
                </View>
                <RailList products={section.products} language={language} onProductPress={onProductPress} contentStyle={styles.seasonRail} />
            </View>
        </View>
    );
});

// Rhythm: editorial blocks open at 40 (a change of pace after the 32-apart rails); the price
// store is a rail with a filter, so it keeps the rail spacing.
const useStyles = makeStyles((t) => ({
    section: { marginTop: space['3xl'] },
    editorialSection: { marginTop: space['4xl'] },

    // shared editorial card: flat surface + hairline (DESIGN.md: cards are flat)
    card: {
        marginHorizontal: space.gutter,
        padding: space.lg,
        borderRadius: radii.card,
        backgroundColor: t.colors.surface,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.colors.hairline,
    },
    cardHead: { gap: space.xxs },
    wellRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    railBelow: { marginTop: space.lg },

    // price store
    chipRow: { gap: space.sm, paddingHorizontal: space.gutter, paddingBottom: space.lg },

    // fresh
    freshGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter, columnGap: space.md, rowGap: space.xl },
    freshTile: {},
    freshWell: { borderRadius: radii.card, overflow: 'hidden' },
    freshChip: {
        position: 'absolute',
        top: space.sm,
        left: space.sm,
        maxWidth: '86%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.sm,
        paddingVertical: space.xxs + 1,
        borderRadius: radii.chip,
        backgroundColor: t.colors.surface,
    },
    freshAdd: { position: 'absolute', right: space.sm, bottom: space.sm },
    freshPrice: { marginTop: space.md },
    freshName: { marginTop: space.xxs },

    // season: the rail runs edge to edge inside the card
    seasonCard: { paddingHorizontal: 0, paddingBottom: space.md },
    seasonHead: { paddingHorizontal: space.lg },
    seasonRail: { paddingHorizontal: space.lg, paddingTop: space.lg },
}));
