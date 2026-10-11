import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, icon3dFor, Screen } from '../components/ui';
import { BannerCarousel, FloatingCartBar } from '../components';
import { space, z } from '../constants/theme';
import { useTheme } from '../theme';
import { durations, easings, springs } from '../theme/motion';
import { OrderService, ProductService, SettingsService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';
import HomeHeader from './home/HomeHeader';
import { CategoryGrid, HomeSkeleton, ProductRail, RailSkeleton } from './home/HomeSections';
import { FreshSection, MomentSection, PriceStore, Reveal, SeasonBlock } from './home/EditorialSections';
import { buildHomeSections, productCategoryId, resolveNow } from './home/collections';
import { headerThemeFor, idOf, nameOf } from './home/catalog';
import { useTabBarScroll } from './home/useTabBarScroll';
import { useTabEnter } from './home/useTabEnter';
import { useCartBarOffset, useTabBarHeight } from '../components/BottomTabsIcons';
import ActiveOrderBar, { ORDER_BAR_HEIGHT, useActiveOrder } from '../components/ActiveOrderBar';
import { FREE_DELIVERY_THRESHOLD } from '../components/product/productUtils';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Bundled art (assets/banner-*.png): unbranded product cut-outs on a transparent canvas (sources in
// assets/README-images.md), products on
// the right. BannerCarousel paints the flat block (neutral, or brand for one slide) and the copy.
const BANNERS = [
    { id: 'b1', image: require('../assets/banner-essentials.png'), surface: 'brand', en: ['Daily essentials in minutes', 'Milk, bread, eggs and more'], hi: ['रोज़ की ज़रूरतें, मिनटों में', 'दूध, ब्रेड, अंडे और भी बहुत कुछ'] },
    { id: 'b2', image: require('../assets/banner-fresh.png'), surface: 'neutral', en: ['Fresh fruits & vegetables', 'Tomatoes, onions, bananas and more'], hi: ['ताज़े फल और सब्ज़ियाँ', 'टमाटर, प्याज़, केले और भी बहुत कुछ'] },
    { id: 'b3', image: require('../assets/banner-pantry.png'), surface: 'neutral', en: ['Stock up your pantry', 'Atta, dal, rice and spices'], hi: ['रसोई का सामान भर लें', 'आटा, दाल, चावल और मसाले'] },
];

const RAIL_LIMIT = 12;
const BANNER_RATIO = 2; // matches the 1200×600 art; a touch shorter than 16:9 so the first viewport isn't all banner
const CART_PILL_H = 56; // FloatingCartBar pill height — the order bar stacks above it
const ORDER_BAR_H = ORDER_BAR_HEIGHT; // ActiveOrderBar pill height

const shortLabel = (name) => {
    const head = (name || '').split(/[,&]/)[0].trim();
    return head.length > 12 ? head.split(/\s+/)[0] : head;
};

const to12h = (hhmm) => {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    if (!Number.isFinite(h)) return null;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return m ? `${hr}:${String(m).padStart(2, '0')} ${suffix}` : `${hr} ${suffix}`;
};

const storeBadgeFor = (settings, isHi) => {
    const t = settings?.storeTimings;
    if (!t?.openTime || !t?.closeTime) return null;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const toMin = (s) => {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + (m || 0);
    };
    const open = mins >= toMin(t.openTime) && mins < toMin(t.closeTime);
    if (open) return { open, label: isHi ? `${to12h(t.closeTime)} तक खुला` : `Open till ${to12h(t.closeTime)}` };
    return { open, label: isHi ? `${to12h(t.openTime)} बजे खुलेगा` : `Opens ${to12h(t.openTime)}` };
};

const translateList = async (list, currentLanguage) => {
    if (currentLanguage !== 'hi' || !list.length) return list;
    try {
        return await Promise.all(list.map(async (x) => ({ ...x, translatedName: x.nameHi || (await translateToHindi(x.name)) })));
    } catch (err) {
        console.error('Translation error during fetch:', err);
        return list;
    }
};

const HomeScreen = ({ navigation }) => {
    const { t, currentLanguage, isHi } = useTranslation();
    const { selectedAddress } = useSelector((state) => state.location);
    const user = useSelector((state) => state.auth?.user);
    const cartCount = useSelector((state) => state.cart.totalItems);
    const reduce = useReducedMotion();
    const themeT = useTheme();
    const enter = useTabEnter();

    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [catProducts, setCatProducts] = useState({}); // categoryId -> products | 'loading'
    const [headerH, setHeaderH] = useState(0);
    const [collapseH, setCollapseH] = useState(0);

    const [orderHistory, setOrderHistory] = useState([]);

    const listRef = useRef(null);
    const cartBarOffset = useCartBarOffset();
    const dockHeight = useTabBarHeight();
    const { order: activeOrder } = useActiveOrder();
    const { scrollY, onScroll } = useTabBarScroll(navigation);

    // ---------------- data ----------------

    const fetchData = useCallback(
        async ({ silent = false } = {}) => {
            try {
                if (!silent) setLoading(true);
                setError(null);
                const [categoriesData, productsData] = await Promise.all([
                    ProductService.getCategories(),
                    ProductService.getProducts({ limit: 100 }),
                ]);
                const [cats, prods] = await Promise.all([
                    translateList(categoriesData || [], currentLanguage),
                    translateList(productsData.products || [], currentLanguage),
                ]);
                setCategories(cats);
                setProducts(prods);
                setCatProducts({});
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load data. Please try again.');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [currentLanguage],
    );

    // Initial load + re-fetch when the language changes (translated content).
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        let alive = true;
        SettingsService.getStoreSettings()
            .then((data) => alive && setSettings(data?.settings || data))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    // Past orders feed the "Buy again" rail (one fetch per sign-in; failures just hide the rail).
    const userId = user?.id || user?._id;
    useEffect(() => {
        if (!userId) return undefined;
        let alive = true;
        OrderService.getOrders(userId)
            .then((res) => alive && setOrderHistory(Array.isArray(res) ? res : res?.orders || []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [userId]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData({ silent: true });
    }, [fetchData]);

    // Load a category's full catalogue the first time its tab is opened (and again after a
    // refresh or language change clears the cache). A generation counter drops stale replies.
    const catGen = useRef(0);
    useEffect(() => {
        catGen.current += 1;
    }, [currentLanguage, products]);
    useEffect(() => {
        if (activeTab === 'all' || catProducts[activeTab]) return;
        const gen = catGen.current;
        const id = activeTab;
        setCatProducts((prev) => ({ ...prev, [id]: 'loading' }));
        ProductService.getProducts({ categoryId: id, limit: 100 })
            .then((res) => translateList(res.products || [], currentLanguage))
            .then((list) => gen === catGen.current && setCatProducts((prev) => ({ ...prev, [id]: list })))
            .catch((err) => {
                console.error('Error fetching category products:', err);
                // fall back to what the home feed already has for this category
                if (gen === catGen.current) {
                    setCatProducts((prev) => ({ ...prev, [id]: products.filter((p) => productCategoryId(p) === id) }));
                }
            });
    }, [activeTab, catProducts, currentLanguage, products]);

    // ---------------- navigation ----------------

    const handleCategoryPress = useCallback((category) => navigation.navigate('Category', { category }), [navigation]);
    const handleProductPress = useCallback((product) => navigation.navigate('ProductDetail', { product }), [navigation]);
    // `fromRect` = the search bar's window rect, so Search can grow its field out of Home's bar.
    const handleSearchPress = useCallback((fromRect) => navigation.navigate('Search', fromRect ? { fromRect } : undefined), [navigation]);
    const handleCartPress = useCallback(() => navigation.navigate('Cart'), [navigation]);
    const handleLocationPress = useCallback(() => navigation.navigate('Location'), [navigation]);
    const handleProfilePress = useCallback(() => navigation.navigate('Main', { screen: 'Account' }), [navigation]);
    const handleAllCategories = useCallback(() => navigation.navigate('Categories'), [navigation]);
    const handleBannerPress = useCallback(() => navigation.navigate('Categories'), [navigation]);
    const handleOrderPress = useCallback(
        () => activeOrder && navigation.navigate('OrderTracking', { orderId: activeOrder._id || activeOrder.orderId }),
        [navigation, activeOrder],
    );

    // ---------------- header ----------------

    const tabs = useMemo(
        () => [
            { id: 'all', label: isHi ? 'सभी' : 'All', icon3d: 'shopping_bags' },
            ...categories.map((c) => ({ id: String(idOf(c)), label: shortLabel(nameOf(c, currentLanguage)), icon3d: icon3dFor(c) })),
        ],
        [categories, currentLanguage, isHi],
    );

    const activeCategory = useMemo(
        () => (activeTab === 'all' ? null : categories.find((c) => String(idOf(c)) === activeTab) || null),
        [activeTab, categories],
    );
    const activeIndex = activeCategory ? categories.indexOf(activeCategory) : -1;
    const theme = activeCategory ? headerThemeFor(activeCategory, activeIndex, themeT) : themeT.headerThemes.default;

    const headerLabels = useMemo(
        () => ({
            deliveryIn: isHi ? 'डिलीवरी' : 'Delivery in',
            minutes: t('minutes'),
            deliverTo: t('deliverTo'),
            profile: isHi ? 'प्रोफ़ाइल खोलें' : 'Open profile',
        }),
        [isHi, t],
    );

    const onHeaderMeasure = useCallback((h, c) => {
        setHeaderH(h);
        setCollapseH(c);
    }, []);

    // Body cross-fades and rises when the category changes.
    const bodyO = useSharedValue(1);
    const bodyY = useSharedValue(0);
    // (the tab-switch rise from useTabEnter is added in, so the two never fight over one transform)
    const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyO.value, transform: [{ translateY: bodyY.value + enter.offset.value }] }));

    // When the dock hides on scroll the cart pill springs down to rest just above the safe area;
    // the order bar makes the same move (same spring, same distance) so it stays 8pt above the
    // pill — or, with an empty cart, sits where the pill would.
    const insets = useSafeAreaInsets();
    const dockDrop = Math.max(0, cartBarOffset - (insets.bottom + space.md));
    const dockHidden = useSharedValue(0);
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('SET_TAB_BAR_VISIBLE', (visible) => {
            const to = visible === false ? 1 : 0;
            dockHidden.value = reduce ? withTiming(to, { duration: durations.fast, easing: easings.out }) : withSpring(to, springs.sheet);
        });
        return () => sub.remove();
    }, [reduce]);
    const orderBarFollow = useAnimatedStyle(() => ({ transform: [{ translateY: dockHidden.value * dockDrop }] }), [dockDrop]);

    const onTabSelect = useCallback(
        (id) => {
            if (id === activeTab) return;
            setActiveTab(id);
            bodyO.value = 0;
            bodyO.value = withTiming(1, { duration: durations.base, easing: easings.out });
            if (!reduce) {
                bodyY.value = 16;
                bodyY.value = withSpring(0, springs.gentle);
            }
            // keep the header state (expanded or pinned) and bring the new content into view
            const offset = Math.min(scrollY.value, collapseH);
            listRef.current?.scrollToOffset?.({ offset, animated: false });
        },
        [activeTab, collapseH, reduce],
    );

    // ---------------- sections ----------------

    const etaMinutes = Number(settings?.estimatedDeliveryMinutes) || 10;

    // Entrance plays once per section: the first screenful staggers, later sections fade in as
    // they first scroll into view, and nothing replays on recycle, refresh or revisit.
    const seenSections = useRef(new Set());
    const [firstPaint, setFirstPaint] = useState(true);
    useEffect(() => {
        if (loading || !firstPaint) return undefined;
        const id = setTimeout(() => setFirstPaint(false), 900);
        return () => clearTimeout(id);
    }, [loading, firstPaint]);

    const sections = useMemo(() => {
        if (loading) return [{ key: 'skeleton', type: 'skeleton' }];
        if (error) return [{ key: 'error', type: 'error' }];

        if (activeCategory) {
            const id = String(idOf(activeCategory));
            const list = catProducts[id];
            if (!list || list === 'loading') return [{ key: `sk-${id}`, type: 'railSkeleton' }, { key: `sk2-${id}`, type: 'railSkeleton' }];
            if (!list.length) return [{ key: `empty-${id}`, type: 'empty' }];
            const bySub = new Map();
            list.forEach((p) => {
                const sub = p.subcategoryId;
                const subName = sub?.name || p.subCategoryName || p.subcategoryName || p.subcategory || nameOf(activeCategory, currentLanguage);
                const key = String(sub?._id || subName);
                if (!bySub.has(key)) bySub.set(key, { key, title: subName, products: [] });
                bySub.get(key).products.push(p);
            });
            return Array.from(bySub.values()).map((g) => ({
                key: `sub-${id}-${g.key}`,
                type: 'rail',
                title: g.title,
                subtitle: `${g.products.length} ${isHi ? 'आइटम' : g.products.length === 1 ? 'item' : 'items'}`,
                products: g.products.slice(0, RAIL_LIMIT),
                onSeeAll: () => handleCategoryPress(activeCategory),
            }));
        }

        return buildHomeSections({ products, categories, orders: orderHistory, now: resolveNow(), language: currentLanguage, t, eta: etaMinutes });
        // `t` is a fresh function every render but only depends on the language, so key on that instead
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, error, activeCategory, catProducts, categories, products, orderHistory, currentLanguage, isHi, handleCategoryPress, etaMinutes]);

    const banners = useMemo(
        () =>
            BANNERS.map((b) => ({
                id: b.id,
                image: b.image,
                surface: b.surface,
                title: (isHi ? b.hi : b.en)[0],
                subtitle: (isHi ? b.hi : b.en)[1],
            })),
        [isHi],
    );

    const freshLabels = useMemo(
        () => ({ chilled: t('homeFeed.fresh.chilled'), shelf: t('homeFeed.fresh.shelf'), shelfOne: t('homeFeed.fresh.shelfOne') }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentLanguage],
    );

    const renderItem = useCallback(
        ({ item, index }) => {
            let body = null;
            switch (item.type) {
                case 'skeleton':
                    return <HomeSkeleton />;
                case 'railSkeleton':
                    return <RailSkeleton />;
                case 'error':
                    return (
                        <EmptyState
                            mood="sad"
                            title={isHi ? 'कुछ गड़बड़ हो गई' : 'Couldn’t load the store'}
                            subtitle={isHi ? 'इंटरनेट जाँचें और फिर कोशिश करें।' : 'Check your connection and try again.'}
                            actionLabel={t('retry')}
                            onAction={fetchData}
                            style={styles.state}
                        />
                    );
                case 'empty':
                    return (
                        <EmptyState
                            title={t('noProducts')}
                            subtitle={isHi ? 'जल्द ही नए उत्पाद आएँगे।' : 'New stock lands here soon. Try another category.'}
                            actionLabel={isHi ? 'सभी देखें' : 'Browse all'}
                            onAction={() => onTabSelect('all')}
                            style={styles.state}
                        />
                    );
                case 'banners':
                    body = (
                        <BannerCarousel banners={banners} onPress={handleBannerPress} aspectRatio={BANNER_RATIO} scrollY={scrollY} style={styles.banner} />
                    );
                    break;
                case 'moment':
                    body = <MomentSection section={item} language={currentLanguage} onProductPress={handleProductPress} />;
                    break;
                case 'priceStore':
                    body = (
                        <PriceStore section={item} language={currentLanguage} onProductPress={handleProductPress} filterLabel={t('homeFeed.priceStore.filterLabel')} />
                    );
                    break;
                case 'fresh':
                    body = (
                        <FreshSection
                            section={item}
                            language={currentLanguage}
                            labels={freshLabels}
                            addLabel={isHi ? 'जोड़ें' : 'ADD'}
                            soldOutLabel={isHi ? 'स्टॉक ख़त्म' : 'Sold out'}
                            actionLabel={t('homeFeed.seeAll')}
                            onProductPress={handleProductPress}
                            onSeeAll={item.category ? () => handleCategoryPress(item.category) : undefined}
                        />
                    );
                    break;
                case 'season':
                    body = <SeasonBlock section={item} language={currentLanguage} onProductPress={handleProductPress} />;
                    break;
                case 'grid':
                    body = (
                        <CategoryGrid
                            title={t('shopByCategory')}
                            lead={isHi ? 'श्रेणी से' : 'Shop by'}
                            emphasis={isHi ? 'खरीदें' : 'category'}
                            actionLabel={t('homeFeed.seeAll')}
                            categories={item.categories}
                            language={currentLanguage}
                            onCategoryPress={handleCategoryPress}
                            onSeeAll={handleAllCategories}
                        />
                    );
                    break;
                case 'rail':
                    body = (
                        <ProductRail
                            title={item.title}
                            lead={item.lead}
                            emphasis={item.emphasis}
                            trail={item.trail}
                            subtitle={item.subtitle}
                            products={item.products}
                            language={currentLanguage}
                            onProductPress={handleProductPress}
                            onSeeAll={item.onSeeAll || (item.category ? () => handleCategoryPress(item.category) : undefined)}
                            actionLabel={t('homeFeed.seeAll')}
                        />
                    );
                    break;
                default:
                    return null;
            }
            return (
                <Reveal id={item.key} index={index} seen={seenSections} stagger={firstPaint}>
                    {body}
                </Reveal>
            );
        },
        [banners, currentLanguage, fetchData, firstPaint, freshLabels, handleAllCategories, handleBannerPress, handleCategoryPress, handleProductPress, isHi, onTabSelect, scrollY, t],
    );

    const addressType = selectedAddress?.type || (isHi ? 'घर' : 'Home');
    const addressLine = selectedAddress?.address || (isHi ? 'अपना पता चुनें' : 'Select your location');
    const offerLabel = isHi ? `₹${FREE_DELIVERY_THRESHOLD} से ऊपर मुफ़्त डिलीवरी` : `Free delivery above ₹${FREE_DELIVERY_THRESHOLD}`;
    const avatarInitial = (user?.name || '').trim().charAt(0).toUpperCase();
    const hasOrderBar = !!activeOrder;
    const cartSpace = cartCount > 0 ? CART_PILL_H + space.sm : 0;
    const orderBarBottom = cartBarOffset + cartSpace;
    // the list scrolls behind the dock: clear the dock, the cart pill and the order bar
    const bottomSpace = dockHeight + space['3xl'] + cartSpace + (hasOrderBar ? ORDER_BAR_H + space.sm : 0);

    return (
        <Screen edges={[]} statusBar={theme.statusBar} topInsetColor={theme.bg}>
            <Animated.View style={[styles.body, enter.fade]}>
                <Animated.View style={[styles.body, bodyStyle]}>
                    <AnimatedFlashList
                        ref={listRef}
                        data={sections}
                        renderItem={renderItem}
                        keyExtractor={sectionKey}
                        getItemType={sectionType}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingTop: headerH, paddingBottom: bottomSpace }}
                        refreshControl={
                            // Plain platform spinner (DESIGN.md: no mascot on loading indicators).
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                progressViewOffset={headerH}
                                tintColor={themeT.colors.brandText}
                                colors={[themeT.colors.brand]}
                                progressBackgroundColor={themeT.colors.surfaceRaised}
                                accessibilityLabel={isHi ? 'रीफ़्रेश हो रहा है' : 'Refreshing'}
                            />
                        }
                    />
                </Animated.View>

                <HomeHeader
                    theme={theme}
                    scrollY={scrollY}
                    etaMinutes={etaMinutes}
                    storeBadge={storeBadgeFor(settings, isHi)}
                    offerLabel={offerLabel}
                    avatarInitial={avatarInitial}
                    addressType={addressType}
                    addressLine={addressLine}
                    labels={headerLabels}
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabSelect={onTabSelect}
                    onSearchPress={handleSearchPress}
                    onAddressPress={handleLocationPress}
                    onProfilePress={handleProfilePress}
                    onMeasure={onHeaderMeasure}
                />

                {hasOrderBar ? (
                    <Animated.View style={[styles.orderBar, { bottom: orderBarBottom }, orderBarFollow, { pointerEvents: 'box-none' }]}>
                        <ActiveOrderBar order={activeOrder} onPress={handleOrderPress} />
                    </Animated.View>
                ) : null}
                <FloatingCartBar onPress={handleCartPress} bottomOffset={cartBarOffset} />
            </Animated.View>
        </Screen>
    );
};

const sectionKey = (item) => item.key;
const sectionType = (item) => item.type;

const styles = StyleSheet.create({
    body: { flex: 1 },
    banner: { marginTop: space.xl },
    orderBar: { position: 'absolute', left: space.lg, right: space.lg, zIndex: z.sticky },
    state: { paddingTop: space['4xl'], paddingHorizontal: space['2xl'] },
});

export default HomeScreen;
