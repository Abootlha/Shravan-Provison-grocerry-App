import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { AnimatedScreen, Chip, ContentSwap, EmptyState, GradientHeader, IconButton, Screen, SkeletonGroup, SkeletonProductTile, Text } from '../components/ui';
import { ProductCard, FloatingCartBar } from '../components';
import { space } from '../constants/theme';
import { layout, stagger } from '../theme/motion';
import { makeStyles, useTheme } from '../theme';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';
import SubcategoryRail, { RAIL_WIDTH } from './categories/SubcategoryRail';
import { discountOf, headerThemeFor, nameOf, toCardProduct } from './home/catalog';

const GRID_PAD = space.md;
const GRID_GAP = space.sm + space.xxs; // 10 — Part C #7 (8–10)

const SORTS = [
    { id: 'relevance', en: 'Relevance', hi: 'प्रासंगिक' },
    { id: 'priceAsc', en: 'Price: low to high', hi: 'कम कीमत पहले' },
    { id: 'priceDesc', en: 'Price: high to low', hi: 'ज़्यादा कीमत पहले' },
    { id: 'discount', en: 'Biggest discount', hi: 'सबसे ज़्यादा छूट' },
];

const STAGGER_WINDOW = 600; // ms after a grid swap during which newly mounted cells stagger in

/**
 * Sort reorder: while `true`, every grid cell carries a LinearTransition, so changing the sort slides
 * each card to its new slot (FlashList keeps one cell per product id once recycling is paused).
 * Off the rest of the time, so FlashList's own measuring passes never animate.
 */
const ReorderContext = createContext(false);
const ReorderCell = forwardRef((props, ref) => {
    const reorder = useContext(ReorderContext);
    return <Animated.View ref={ref} {...props} layout={reorder ? layout.list : undefined} />;
});

const GridItem = React.memo(({ item, index, width, language, onProductPress, enterAt }) => {
    const styles = useStyles();
    const product = useMemo(() => toCardProduct(item, language), [item, language]);
    const onPress = useCallback(() => onProductPress(item), [onProductPress, item]);
    // first screenful of a fresh grid staggers in (35ms apart, capped); later cells appear instantly
    const [entering] = useState(() => (enterAt && index <= stagger.maxItems ? layout.enterAt(index) : undefined));
    return (
        <Animated.View entering={entering} style={[styles.cell, { width }]}>
            <ProductCard product={product} onPress={onPress} style={{ width }} />
        </Animated.View>
    );
});

const CategoryScreen = ({ route, navigation }) => {
    const { category } = route.params;
    const { currentLanguage, isHi, t } = useTranslation();
    const styles = useStyles();
    const themeT = useTheme();
    const { gradients } = themeT;
    const { width } = useWindowDimensions();
    const listRef = useRef(null);
    const [reorder, setReorder] = useState(false);
    const reorderTimer = useRef(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [subcategories, setSubcategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState('relevance');
    const [inStockOnly, setInStockOnly] = useState(false);

    // Get cart from Redux
    const cartItems = useSelector((state) => state.cart.totalItems);

    useEffect(() => {
        fetchData();
    }, [category]);

    useEffect(() => {
        if (selectedSubcategory) {
            fetchProducts(selectedSubcategory._id);
        }
    }, [selectedSubcategory]);

    // Re-fetch data when language changes to get translated content
    useEffect(() => {
        if (category) {
            fetchData();
        }
    }, [currentLanguage]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch subcategories for this category
            const categoryId = category._id || category.id;
            const response = await ProductService.getSubcategories({ parentId: categoryId });
            let subcats = response.subcategories || [];

            // If Hindi is selected, translate immediately before setting state
            if (currentLanguage === 'hi' && subcats.length > 0) {
                try {
                    subcats = await Promise.all(
                        subcats.map(async (subcat) => ({
                            ...subcat,
                            translatedName: subcat.nameHi || (await translateToHindi(subcat.name)),
                        })),
                    );
                } catch (translationErr) {
                    console.error('Translation error during fetch:', translationErr);
                    // Continue with English if translation fails
                }
            }

            setSubcategories(subcats);

            // Auto-select first subcategory
            if (subcats.length > 0) {
                setSelectedSubcategory(subcats[0]);
            } else {
                // If no subcategories, fetch all products for this category
                fetchProducts(categoryId, true);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load data');
            setLoading(false);
        }
    };

    const fetchProducts = async (subcategoryId, isCategory = false) => {
        try {
            setLoading(true);

            // Fetch products for this subcategory or category
            const params = isCategory ? { categoryId: subcategoryId, limit: 100 } : { subcategoryId, limit: 100 };

            const productsData = await ProductService.getProducts(params);
            let finalProducts = productsData.products || [];

            // If Hindi is selected, translate immediately before setting state
            if (currentLanguage === 'hi' && finalProducts.length > 0) {
                try {
                    finalProducts = await Promise.all(
                        finalProducts.map(async (prod) => ({
                            ...prod,
                            translatedName: prod.nameHi || (await translateToHindi(prod.name)),
                        })),
                    );
                } catch (translationErr) {
                    console.error('Translation error during product fetch:', translationErr);
                    // Continue with English if translation fails
                }
            }

            setProducts(finalProducts);
        } catch (err) {
            console.error('Error fetching products:', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleProductPress = useCallback((product) => navigation.navigate('ProductDetail', { product }), [navigation]);
    const handleBackPress = () => navigation.goBack();
    const handleSearchPress = () => navigation.navigate('Main', { screen: 'Search' });
    const handleCartPress = () => navigation.navigate('Main', { screen: 'Cart' });

    // ---------------- presentation ----------------

    const theme = headerThemeFor(category, 0, themeT);
    const title = nameOf(category, currentLanguage);
    const gridW = width - (subcategories.length ? RAIL_WIDTH : 0);
    const cardW = Math.floor((gridW - GRID_PAD * 2 - GRID_GAP) / 2);

    const visible = useMemo(() => {
        let list = inStockOnly ? products.filter((p) => p.isAvailable && p.stock > 0) : products;
        if (sort === 'priceAsc') list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
        else if (sort === 'priceDesc') list = [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
        else if (sort === 'discount') list = [...list].sort((a, b) => discountOf(b) - discountOf(a));
        return list;
    }, [products, sort, inStockOnly]);

    // Grid states crossfade through ContentSwap (6px rise): skeleton -> grid, and a new subcategory or
    // stock filter is a new state. A sort change is NOT: the same cards slide to their new slots (ReorderCell).
    const gridKey = loading ? 'loading' : `grid-${selectedSubcategory?._id || 'all'}-${inStockOnly ? 'stock' : 'any'}`;
    const staggerUntil = useRef(0);
    const lastGridKey = useRef(gridKey);
    if (lastGridKey.current !== gridKey) {
        lastGridKey.current = gridKey;
        if (!loading) staggerUntil.current = Date.now() + STAGGER_WINDOW;
    }

    const onSortPress = useCallback(
        (id) => {
            if (id === sort) return;
            clearTimeout(reorderTimer.current);
            listRef.current?.prepareForLayoutAnimationRender?.();
            setReorder(true);
            // let the cells pick up their layout transition before they move
            requestAnimationFrame(() => setSort(id));
            reorderTimer.current = setTimeout(() => setReorder(false), 700);
        },
        [sort],
    );
    useEffect(() => () => clearTimeout(reorderTimer.current), []);

    const renderItem = useCallback(
        ({ item, index }) => (
            <GridItem
                item={item}
                index={index}
                width={cardW}
                language={currentLanguage}
                onProductPress={handleProductPress}
                enterAt={Date.now() < staggerUntil.current}
            />
        ),
        [cardW, currentLanguage, handleProductPress],
    );

    const subtitle = loading
        ? isHi
            ? 'लोड हो रहा है…'
            : 'Loading…'
        : `${visible.length} ${isHi ? 'आइटम' : visible.length === 1 ? 'item' : 'items'}${selectedSubcategory ? ` · ${nameOf(selectedSubcategory, currentLanguage)}` : ''}`;

    const header = (
        <GradientHeader gradient={gradients.header} rounded={false} style={styles.top}>
            <View style={styles.topRow}>
                <IconButton name="arrow-left" variant="floating" accessibilityLabel={isHi ? 'वापस जाएँ' : 'Go back'} onPress={handleBackPress} />
                <View style={styles.topActions}>
                    <IconButton name="magnify" variant="floating" accessibilityLabel={t('search')} onPress={handleSearchPress} />
                    <IconButton
                        name="shopping-outline"
                        variant="floating"
                        accessibilityLabel={`${t('cart')}${cartItems ? `, ${cartItems}` : ''}`}
                        badge={cartItems}
                        onPress={handleCartPress}
                    />
                </View>
            </View>
            <View style={styles.titles}>
                <Text variant="h1" color={theme.ink} numberOfLines={2} accessibilityRole="header">
                    {title}
                </Text>
                <Text variant="caption" weight="medium" color={theme.inkSecondary} numberOfLines={1} style={styles.subtitle}>
                    {subtitle}
                </Text>
            </View>
        </GradientHeader>
    );

    if (error) {
        return (
            <Screen edges={[]} statusBar={theme.statusBar} topInsetColor={theme.bg}>
                {header}
                <AnimatedScreen>
                    <EmptyState
                        mood="sad"
                        title={isHi ? 'यह श्रेणी लोड नहीं हुई' : 'Couldn’t load this aisle'}
                        subtitle={isHi ? 'इंटरनेट जाँचें और फिर कोशिश करें।' : 'Check your connection and try again.'}
                        actionLabel={t('retry')}
                        onAction={fetchData}
                        style={styles.state}
                    />
                </AnimatedScreen>
            </Screen>
        );
    }

    return (
        <Screen edges={[]} statusBar={theme.statusBar} topInsetColor={theme.bg}>
            {header}
            <AnimatedScreen style={styles.content}>
                {subcategories.length ? (
                    <SubcategoryRail
                        items={subcategories}
                        selectedId={selectedSubcategory?._id}
                        language={currentLanguage}
                        onSelect={setSelectedSubcategory}
                    />
                ) : null}

                <View style={styles.right}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
                        {SORTS.map((s) => (
                            <Chip
                                key={s.id}
                                size="sm"
                                label={isHi ? s.hi : s.en}
                                selected={sort === s.id}
                                onPress={() => onSortPress(s.id)}
                            />
                        ))}
                        <Chip size="sm" label={isHi ? 'स्टॉक में' : 'In stock'} selected={inStockOnly} onPress={() => setInStockOnly((v) => !v)} />
                    </ScrollView>

                    <ContentSwap stateKey={gridKey} style={styles.grid}>
                        {loading ? (
                            <SkeletonGroup style={styles.skeletonGrid}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <SkeletonProductTile key={i} width={cardW} />
                                ))}
                            </SkeletonGroup>
                        ) : (
                            <ReorderContext.Provider value={reorder}>
                                <FlashList
                                    ref={listRef}
                                    data={visible}
                                    renderItem={renderItem}
                                    keyExtractor={productKey}
                                    numColumns={2}
                                    extraData={cardW}
                                    CellRendererComponent={ReorderCell}
                                    contentContainerStyle={styles.gridContent}
                                    showsVerticalScrollIndicator={false}
                                    ListEmptyComponent={
                                        <EmptyState
                                            compact
                                            title={t('noProducts')}
                                            subtitle={
                                                inStockOnly
                                                    ? isHi
                                                        ? 'स्टॉक फ़िल्टर हटाकर देखें।'
                                                        : 'Everything here is sold out right now. Clear the stock filter to see it all.'
                                                    : isHi
                                                      ? 'जल्द ही नया स्टॉक आएगा।'
                                                      : 'New stock lands here soon. Try another aisle.'
                                            }
                                            actionLabel={inStockOnly ? (isHi ? 'फ़िल्टर हटाएँ' : 'Clear filter') : undefined}
                                            onAction={inStockOnly ? () => setInStockOnly(false) : undefined}
                                            style={styles.state}
                                        />
                                    }
                                />
                            </ReorderContext.Provider>
                        )}
                    </ContentSwap>
                </View>
            </AnimatedScreen>

            {/* Floating cart bar (owned by the cart flow) */}
            <FloatingCartBar onPress={handleCartPress} />
        </Screen>
    );
};

const productKey = (item) => String(item._id);

const useStyles = makeStyles((t) => ({
    top: { paddingHorizontal: space.gutter, paddingBottom: space.lg },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topActions: { flexDirection: 'row', gap: space.sm },
    titles: { marginTop: space.md },
    subtitle: { marginTop: space.xxs },
    content: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: t.colors.canvas,
        borderTopWidth: StyleSheet.hairlineWidth * 2,
        borderTopColor: t.colors.hairline,
    },
    right: { flex: 1 },
    chipBar: { flexGrow: 0 },
    chips: { gap: space.sm, paddingHorizontal: GRID_PAD, paddingTop: space.md, paddingBottom: space.sm },
    grid: { flex: 1 },
    gridContent: { paddingHorizontal: GRID_PAD - GRID_GAP / 2, paddingTop: space.xs, paddingBottom: 160 },
    cell: { marginHorizontal: GRID_GAP / 2, marginBottom: GRID_GAP },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: GRID_PAD },
    state: { paddingTop: space['3xl'], paddingHorizontal: space.lg },
}));

export default CategoryScreen;
