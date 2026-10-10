import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { AnimatedListItem, ContentSwap, GradientHeader, icon3dFor, Screen, SectionHeader, Skeleton, SkeletonGroup, Text } from '../components/ui';
import { CategoryCard, FloatingCartBar, SearchBar } from '../components';
import { space } from '../constants/theme';
import { stagger } from '../theme/motion';
import { useTheme } from '../theme';
import { useCartBarOffset, useTabBarHeight } from '../components/BottomTabsIcons';
import { CATEGORIES, CATEGORY_GROUPS } from '../constants';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';
import { glyphOf, groupIndexOf, idOf, imageOf, nameOf } from './home/catalog';
import { useTabBarScroll } from './home/useTabBarScroll';
import { useTabEnter } from './home/useTabEnter';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);
const GAP = space.md;
const CART_PILL_H = 56; // FloatingCartBar pill — the list clears it as well as the dock
const STAGGER_WINDOW = 700; // ms: rows mounted after this (scrolling) appear instantly

const Tile = React.memo(({ cat, index, width, language, onPress }) => {
    const category = useMemo(
        () => ({ id: idOf(cat), name: nameOf(cat, language), icon: glyphOf(cat, 'basket-outline'), image: imageOf(cat), icon3d: icon3dFor(cat) }),
        [cat, language],
    );
    const handlePress = useCallback(() => onPress(cat), [onPress, cat]);
    return <CategoryCard category={category} index={index} width={width} onPress={handlePress} />;
});

const CategoriesScreen = ({ navigation }) => {
    const { currentLanguage, isHi } = useTranslation();
    const { width } = useWindowDimensions();
    const columns = width >= 360 ? 4 : 3;
    const tileW = Math.floor((width - space.gutter * 2 - GAP * (columns - 1)) / columns);
    const { onScroll } = useTabBarScroll(navigation);
    const { headerThemes } = useTheme();
    const theme = headerThemes.default;
    const enter = useTabEnter();
    const cartBarOffset = useCartBarOffset();
    const dockHeight = useTabBarHeight();
    const listPad = useMemo(() => ({ paddingTop: space.xs, paddingBottom: dockHeight + CART_PILL_H + space['4xl'] }), [dockHeight]);

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [translatedGroups, setTranslatedGroups] = useState(CATEGORY_GROUPS);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch real categories from backend API
            const apiCategories = await ProductService.getCategories();
            const rawList = apiCategories && apiCategories.length > 0 ? apiCategories : CATEGORIES;

            if (currentLanguage === 'hi') {
                try {
                    const [translatedCats, translatedGrps] = await Promise.all([
                        Promise.all(
                            rawList.map(async (cat) => ({
                                ...cat,
                                translatedName: cat.nameHi || (await translateToHindi(cat.name)),
                            })),
                        ),
                        Promise.all(CATEGORY_GROUPS.map((group) => translateToHindi(group))),
                    ]);
                    setCategories(translatedCats);
                    setTranslatedGroups(translatedGrps);
                } catch (translationErr) {
                    console.error('Translation error in CategoriesScreen:', translationErr);
                    setCategories(rawList);
                    setTranslatedGroups(CATEGORY_GROUPS);
                }
            } else {
                setCategories(rawList);
                setTranslatedGroups(CATEGORY_GROUPS);
            }
        } catch (err) {
            console.error('Error loading categories:', err);
            setCategories(CATEGORIES);
            setTranslatedGroups(CATEGORY_GROUPS);
        } finally {
            setLoading(false);
        }
    }, [currentLanguage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCategoryPress = useCallback((category) => navigation.navigate('Category', { category }), [navigation]);
    const handleSearchPress = useCallback((fromRect) => navigation.navigate('Search', fromRect ? { fromRect } : undefined), [navigation]);
    const handleCartPress = useCallback(() => navigation.navigate('Cart'), [navigation]);

    // Only the first screenful staggers (once, after the skeleton swaps out); rows that mount later
    // while scrolling appear instantly instead of fading in 280ms late.
    const [staggering, setStaggering] = useState(true);
    const staggerTimer = useRef(null);
    useEffect(() => {
        if (loading) return undefined;
        staggerTimer.current = setTimeout(() => setStaggering(false), STAGGER_WINDOW);
        return () => clearTimeout(staggerTimer.current);
    }, [loading]);

    // Flatten grouped categories into header + row items for one virtualized list.
    const rows = useMemo(() => {
        const buckets = CATEGORY_GROUPS.map(() => []);
        const more = [];
        categories.forEach((cat) => {
            const g = groupIndexOf(cat, CATEGORY_GROUPS);
            (g < buckets.length ? buckets[g] : more).push(cat);
        });
        const groups = buckets.map((items, i) => ({ title: translatedGroups[i] || CATEGORY_GROUPS[i], items }));
        if (more.length) groups.push({ title: isHi ? 'और भी' : 'More to explore', items: more });

        const out = [];
        let tileIndex = 0;
        groups
            .filter((g) => g.items.length)
            .forEach((g, gi) => {
                out.push({ key: `h-${gi}`, type: 'header', title: g.title, count: g.items.length });
                for (let i = 0; i < g.items.length; i += columns) {
                    out.push({ key: `r-${gi}-${i}`, type: 'row', items: g.items.slice(i, i + columns), start: tileIndex });
                    tileIndex += Math.min(columns, g.items.length - i);
                }
            });
        return out;
    }, [categories, translatedGroups, columns, isHi]);

    const renderItem = useCallback(
        ({ item, index }) => {
            if (item.type === 'header') {
                return (
                    <AnimatedListItem index={index} disabled={!staggering || index > stagger.maxItems}>
                        <SectionHeader
                            title={item.title}
                            subtitle={`${item.count} ${isHi ? 'श्रेणियाँ' : item.count === 1 ? 'category' : 'categories'}`}
                            style={styles.groupHeader}
                        />
                    </AnimatedListItem>
                );
            }
            return (
                <AnimatedListItem index={index} disabled={!staggering || index > stagger.maxItems} style={styles.row}>
                    {item.items.map((cat, i) => (
                        <Tile
                            key={idOf(cat) || i}
                            cat={cat}
                            index={item.start + i}
                            width={tileW}
                            language={currentLanguage}
                            onPress={handleCategoryPress}
                        />
                    ))}
                </AnimatedListItem>
            );
        },
        [currentLanguage, handleCategoryPress, isHi, tileW, staggering],
    );

    return (
        <Screen edges={[]} statusBar={theme.statusBar} topInsetColor={theme.bg}>
            <Animated.View style={[styles.fill, enter.fade]}>
                <TopBar onSearchPress={handleSearchPress} isHi={isHi} count={categories.length} loading={loading} theme={theme} />
                <Animated.View style={[styles.fill, enter.rise]}>
                    {/* skeleton → grid crossfade (no pop, no layout jump) */}
                    <ContentSwap stateKey={loading ? 'loading' : 'data'} style={styles.fill}>
                        {loading ? (
                            <GridSkeleton columns={columns} tileW={tileW} style={listPad} />
                        ) : (
                            <AnimatedFlashList
                                data={rows}
                                renderItem={renderItem}
                                keyExtractor={rowKey}
                                getItemType={rowType}
                                extraData={staggering}
                                onScroll={onScroll}
                                scrollEventThrottle={16}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={listPad}
                            />
                        )}
                    </ContentSwap>
                </Animated.View>
                <FloatingCartBar onPress={handleCartPress} bottomOffset={cartBarOffset} />
            </Animated.View>
        </Screen>
    );
};

const TopBar = React.memo(({ onSearchPress, isHi, count, loading, theme }) => (
    <GradientHeader gradient={theme.gradient} rounded={false} style={styles.top}>
        <View style={styles.titleRow}>
            <Text variant="h1" color={theme.ink} accessibilityRole="header">
                {isHi ? 'सभी श्रेणियाँ' : 'All categories'}
            </Text>
            {!loading && count ? (
                <Text variant="label" weight="medium" color={theme.inkSecondary}>
                    {count} {isHi ? 'श्रेणियाँ' : 'aisles'}
                </Text>
            ) : null}
        </View>
        <SearchBar onPress={onSearchPress} />
    </GradientHeader>
));

const GridSkeleton = ({ columns, tileW, style }) => (
    <SkeletonGroup style={style}>
        {[0, 1].map((g) => (
            <View key={g}>
                <View style={styles.groupHeader}>
                    <Skeleton width={180} height={20} />
                    <Skeleton width={90} height={12} style={styles.boneSub} />
                </View>
                {[0, 1].map((r) => (
                    <View key={r} style={styles.row}>
                        {Array.from({ length: columns }).map((_, i) => (
                            <View key={i} style={{ width: tileW }}>
                                <Skeleton width={tileW} height={tileW} radius="md" />
                                <Skeleton width={tileW * 0.8} height={10} style={styles.boneLabel} />
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        ))}
    </SkeletonGroup>
);

const rowKey = (item) => item.key;
const rowType = (item) => item.type;

const styles = StyleSheet.create({
    fill: { flex: 1 },
    top: {
        paddingBottom: space.lg,
        gap: space.lg,
    },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: space.sm },
    groupHeader: { paddingHorizontal: space.gutter, marginTop: space['2xl'], marginBottom: space.lg },
    row: {
        flexDirection: 'row',
        columnGap: GAP,
        paddingHorizontal: space.gutter,
        marginBottom: space.xl,
    },
    boneSub: { marginTop: space.sm },
    boneLabel: { marginTop: space.sm, alignSelf: 'center' },
});

export default CategoriesScreen;
