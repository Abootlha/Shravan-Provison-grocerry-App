import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    SafeAreaView,
    ActivityIndicator,
    Image,
    Animated,
    Dimensions,
    DeviceEventEmitter,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    DiscountTag01Icon,
    GiftIcon,
    CheckmarkBadge01Icon,
    ShoppingBasket01Icon,
} from 'hugeicons-react-native';
import Svg, { Line } from 'react-native-svg';
import { useSelector } from 'react-redux';
import {
    Header,
    SearchBar,
    CategoryCard,
    ProductCard,
    FloatingCartBar,
    CategoryTabBar,
    ProductCardSkeleton,
} from '../components';
import { COLORS, SHADOWS } from '../constants';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_DATA = [
    require('../assets/banner-card1.png'),
    require('../assets/banner-card2.png'),
    require('../assets/banner-card3.png'),
];

const HomeScreen = ({ navigation }) => {
    const { t, currentLanguage } = useTranslation();
    const { width: screenWidth } = useWindowDimensions();

    // Responsive width for feature cards (Always 4 in a row on large screens, scrollable on mobile)
    const featureCardWidth = Math.max(105, (screenWidth - 32 - 30) / 4);
    const cartItems = useSelector((state) => state.cart.totalItems);
    const totalAmount = useSelector((state) => state.cart.totalAmount);
    const { selectedAddress } = useSelector((state) => state.location);

    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        {
            useNativeDriver: false,
            listener: (event) => {
                const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
                DeviceEventEmitter.emit('ON_SCROLL_Y', currentY);
            }
        }
    );

    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeQuickCat, setActiveQuickCat] = useState('all');
    const [activeSubcats, setActiveSubcats] = useState({});
    const [visibleCounts, setVisibleCounts] = useState({});
    const [loadingMoreSections, setLoadingMoreSections] = useState({});

    const handleLoadMore = (sectionId, totalCount) => {
        const currentVisible = visibleCounts[sectionId] || 12;
        if (currentVisible >= totalCount || loadingMoreSections[sectionId]) return;

        setLoadingMoreSections((prev) => ({ ...prev, [sectionId]: true }));

        setTimeout(() => {
            setVisibleCounts((prev) => ({
                ...prev,
                [sectionId]: Math.min(currentVisible + 8, totalCount),
            }));
            setLoadingMoreSections((prev) => ({ ...prev, [sectionId]: false }));
        }, 500);
    };

    const carouselRef = useRef(null);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    // Auto-scroll effect for banner
    useEffect(() => {
        const interval = setInterval(() => {
            let nextIndex = currentBannerIndex + 1;
            if (nextIndex >= BANNER_DATA.length) {
                nextIndex = 0;
            }
            if (carouselRef.current) {
                carouselRef.current.scrollToIndex({ index: nextIndex, animated: true });
            }
            setCurrentBannerIndex(nextIndex);
        }, 5000);

        return () => clearInterval(interval);
    }, [currentBannerIndex]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            DeviceEventEmitter.emit('SET_TAB_BAR_VISIBLE', true);
            DeviceEventEmitter.emit('ON_SCROLL_Y', 0);
        });
        DeviceEventEmitter.emit('SET_TAB_BAR_VISIBLE', true);
        DeviceEventEmitter.emit('ON_SCROLL_Y', 0);
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        fetchData();
    }, []);

    // Re-fetch data when language changes to get translated content
    useEffect(() => {
        fetchData();
    }, [currentLanguage]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch categories and products in parallel
            const [categoriesData, productsData] = await Promise.all([
                ProductService.getCategories(),
                ProductService.getProducts({ limit: 100 })
            ]);

            let finalCategories = categoriesData || [];
            let finalProducts = productsData.products || [];

            // If Hindi is selected, translate immediately before setting state
            if (currentLanguage === 'hi') {
                try {
                    // Translate categories and products in parallel
                    const [translatedCats, translatedProds] = await Promise.all([
                        Promise.all(
                            finalCategories.map(async (cat) => ({
                                ...cat,
                                translatedName: cat.nameHi || await translateToHindi(cat.name)
                            }))
                        ),
                        Promise.all(
                            finalProducts.map(async (prod) => ({
                                ...prod,
                                translatedName: prod.nameHi || await translateToHindi(prod.name)
                            }))
                        )
                    ]);

                    finalCategories = translatedCats;
                    finalProducts = translatedProds;
                } catch (translationErr) {
                    console.error('Translation error during fetch:', translationErr);
                    // Continue with English if translation fails
                }
            }

            setCategories(finalCategories);
            setProducts(finalProducts);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Helper to group products category-wise
    const getCategorySections = () => {
        if (!products || products.length === 0) return [];

        const sectionMap = {};

        products.forEach((prod) => {
            const catId = prod.categoryId?._id || prod.categoryId?.id || (typeof prod.categoryId === 'string' ? prod.categoryId : 'uncategorized');
            const matchedCat = categories.find((c) => String(c._id || c.id) === String(catId));

            const catName = matchedCat
                ? (currentLanguage === 'hi' && matchedCat.translatedName ? matchedCat.translatedName : matchedCat.name)
                : (prod.categoryName || 'Daily Essentials');

            if (!sectionMap[catId]) {
                sectionMap[catId] = {
                    id: catId,
                    categoryObj: matchedCat || { _id: catId, name: catName },
                    title: catName,
                    icon: matchedCat?.icon || 'store-outline',
                    products: [],
                };
            }
            sectionMap[catId].products.push(prod);
        });

        return Object.values(sectionMap);
    };

    // Helper to get subcategory filter tabs dynamically from section products
    const getSubcategoryTabsForSection = (sec) => {
        const subcatMap = new Map();

        // 1. Extract dynamic subcategories present in this section's products
        (sec.products || []).forEach((prod) => {
            const subObj = prod.subcategoryId;
            const subId = subObj?._id || subObj?.id || (typeof subObj === 'string' ? subObj : null);
            let subName = subObj?.name || prod.subCategoryName || prod.subcategoryName;

            if (subName && typeof subName === 'string' && subName.trim()) {
                const cleanName = subName.trim();
                const key = cleanName.toLowerCase();
                if (!subcatMap.has(key)) {
                    subcatMap.set(key, {
                        id: subId ? String(subId) : `sub_${key}`,
                        name: cleanName,
                        subcategoryId: subId ? String(subId) : null,
                    });
                }
            }
        });

        const dynamicTabs = Array.from(subcatMap.values());

        return [
            { id: 'all', name: 'All Items', subcategoryId: null },
            ...dynamicTabs
        ];
    };

    // Helper to get filtered products for a category section dynamically
    const getFilteredProductsForSection = (sec) => {
        const selectedTabId = activeSubcats[sec.id] || 'all';
        if (selectedTabId === 'all') return sec.products;

        const tabs = getSubcategoryTabsForSection(sec);
        const selectedTab = tabs.find(t => t.id === selectedTabId);
        if (!selectedTab) return sec.products;

        const targetName = (selectedTab.name || '').toLowerCase();
        const targetId = selectedTab.subcategoryId || selectedTab.id;

        const filtered = sec.products.filter((prod) => {
            const subObj = prod.subcategoryId;
            const pSubId = subObj?._id || subObj?.id || (typeof subObj === 'string' ? subObj : null);
            let pSubName = (subObj?.name || prod.subCategoryName || prod.subcategoryName || '').toLowerCase();

            // Direct ID match
            if (pSubId && String(pSubId) === String(targetId)) return true;

            // Direct name match
            if (pSubName && (pSubName === targetName || pSubName.includes(targetName) || targetName.includes(pSubName))) {
                return true;
            }

            return false;
        });

        return filtered.length > 0 ? filtered : sec.products;
    };

    const handleCategoryPress = (category) => navigation.navigate('Category', { category });
    const handleProductPress = (product) => navigation.navigate('ProductDetail', { product });
    const handleSearchPress = () => navigation.navigate('Search');
    const handleCartPress = () => navigation.navigate('Cart');
    const handleLocationPress = () => navigation.navigate('Location');

    const renderCategory = ({ item, index }) => {
        const displayName = currentLanguage === 'hi' && item.translatedName
            ? item.translatedName
            : item.name;

        return (
            <CategoryCard
                category={{
                    id: item._id,
                    name: displayName,
                    icon: item.icon || 'package-variant',
                    color: item.color,
                    image: item.icon  // Use icon field for image as well
                }}
                index={index}
                onPress={() => handleCategoryPress(item)}
                size="medium"
            />
        );
    };

    const renderProduct = ({ item }) => {
        const displayName = currentLanguage === 'hi' && item.translatedName
            ? item.translatedName
            : item.name;

        return (
            <ProductCard
                product={{
                    id: item._id,
                    name: displayName,
                    price: item.price,
                    originalPrice: item.originalPrice,
                    unit: item.unit,
                    image: item.image,
                    categoryId: item.categoryId?._id || item.categoryId,
                    inStock: item.isAvailable && item.stock > 0,
                    discount: item.originalPrice > item.price
                        ? Math.round((1 - item.price / item.originalPrice) * 100)
                        : 0
                }}
                onPress={() => handleProductPress(item)}
            />
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    addressDetail={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    deliveryTime="10 minutes"
                    onLocationPress={handleLocationPress}
                    onProfilePress={() => navigation.navigate('Main', { screen: 'Account' })}
                    onWalletPress={() => navigation.navigate('Main', { screen: 'Account' })}
                >
                    <View style={styles.embeddedSearchWrapper}>
                        <SearchBar onPress={handleSearchPress} />
                    </View>
                </Header>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    addressDetail={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    deliveryTime="10 minutes"
                    onLocationPress={handleLocationPress}
                    onProfilePress={() => navigation.navigate('Main', { screen: 'Account' })}
                    onWalletPress={() => navigation.navigate('Main', { screen: 'Account' })}
                >
                    <View style={styles.embeddedSearchWrapper}>
                        <SearchBar onPress={handleSearchPress} />
                    </View>
                </Header>
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={64} color={COLORS.textSecondary} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                        <Text style={styles.retryButtonText}>{t('retry')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            {/* ===== STICKY HEADER (Location, SearchBar, Popular Tags & Quick Categories Sticky) ===== */}
            <Animated.View style={[
                styles.stickyHeaderWrapper,
                {
                    zIndex: 999,
                    elevation: 12,
                    shadowColor: '#7C3AED',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.12,
                    shadowRadius: 15,
                }
            ]}>
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    addressDetail={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    deliveryTime="10 minutes"
                    onLocationPress={handleLocationPress}
                    onProfilePress={() => navigation.navigate('Main', { screen: 'Account' })}
                    onWalletPress={() => navigation.navigate('Main', { screen: 'Account' })}
                    scrollY={scrollY}
                >
                    {/* Integrated Search Bar */}
                    <View style={styles.embeddedSearchWrapper}>
                        <SearchBar onPress={handleSearchPress} />
                    </View>

                    {/* Quick Categories Bar (Sticky with Header) */}
                    <View style={styles.quickCatBar}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCatScroll}>
                            {[
                                { id: 'all', name: 'All', icon: 'basket-outline' },
                                { id: 'atta', name: 'Atta & Rice', icon: 'barley' },
                                { id: 'snacks', name: 'Snacks', icon: 'cookie-outline' },
                                { id: 'dairy', name: 'Dairy & Milk', icon: 'cup-water' },
                                { id: 'beauty', name: 'Beauty', icon: 'lipstick' },
                                { id: 'drinks', name: 'Beverages', icon: 'bottle-soda-outline' },
                            ].map((cat) => {
                                const isSelected = activeQuickCat === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.quickCatPill, isSelected && styles.quickCatPillActive]}
                                        onPress={() => setActiveQuickCat(cat.id)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialCommunityIcons
                                            name={cat.icon}
                                            size={15}
                                            color={isSelected ? '#111111' : '#444444'}
                                        />
                                        <Text style={[styles.quickCatText, isSelected && styles.quickCatTextActive]}>
                                            {cat.name}
                                        </Text>
                                        {isSelected && <View style={styles.quickCatActiveLine} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </Header>
            </Animated.View>

            {/* ===== SCROLLABLE CONTENT (NON-STICKY) ===== */}
            <Animated.ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {/* Spacer for absolute header */}
                <View style={{ height: Platform.OS === 'android' ? 270 : 290 }} />

                {/* Hero Banner Carousel (Auto-scrolling) */}
                <View style={styles.heroBannerWrapper}>
                    <FlatList
                        ref={carouselRef}
                        data={BANNER_DATA}
                        keyExtractor={(_, index) => index.toString()}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(event) => {
                            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                            setCurrentBannerIndex(index);
                        }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={{ width: screenWidth, alignItems: 'center' }}
                                activeOpacity={0.92}
                                onPress={() => navigation.navigate('Categories')}
                            >
                                <View style={[styles.bannerContainer, { width: screenWidth - 32 }]}>
                                    <Image
                                        source={item}
                                        style={styles.heroBannerCardImage}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.bannerOverlay}>
                                        <View style={styles.bannerTopPill}>
                                            <MaterialCommunityIcons name="moped" size={14} color="#4C1D95" />
                                            <Text style={styles.bannerTopPillText}>FREE DELIVERY</Text>
                                        </View>
                                        <Text style={styles.bannerHeadline}>Your Daily{'\n'}Essentials</Text>
                                        <Text style={styles.bannerSubtitle}>Delivered in</Text>
                                        <Text style={styles.bannerHighlight}>10 minutes</Text>
                                        <TouchableOpacity style={styles.bannerShopButton} onPress={() => navigation.navigate('Categories')}>
                                            <Text style={styles.bannerShopButtonText}>Shop Now</Text>
                                            <MaterialCommunityIcons name="arrow-right" size={16} color="#000" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* 4 Feature Grid Cards (Blinkit / Quick-Commerce Style with Hugeicons) */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featureGridContainer}
                >
                    {[
                        { title: 'Top Offers', subtitle: 'Best deals', IconComponent: DiscountTag01Icon, bg: '#F5EEFF', iconColor: '#7C3AED' },
                        { title: 'Combo Store', subtitle: 'Save more', IconComponent: GiftIcon, bg: '#EDEAFF', iconColor: '#6366F1' },
                        { title: 'New Arrivals', subtitle: 'Just in', IconComponent: CheckmarkBadge01Icon, bg: '#E0F2FE', iconColor: '#0284C7' },
                        { title: 'Smart Basket', subtitle: 'Buy again', IconComponent: ShoppingBasket01Icon, bg: '#F3E8FF', iconColor: '#9333EA' },
                    ].map((card, idx) => {
                        const Icon = card.IconComponent;
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.featureGridCard, { backgroundColor: card.bg, width: featureCardWidth }]}
                                onPress={() => navigation.navigate('Categories')}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.featureIconCircle, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                                    <Icon size={22} color={card.iconColor} strokeWidth={2} />
                                </View>
                                <Text style={styles.featureCardTitle}>{card.title}</Text>
                                <Text style={styles.featureCardSubtitle}>{card.subtitle}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Categories Section (Shop by Category) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>{t('shopByCategory')}</Text>
                            <Text style={styles.sectionSubtitle}>{t('freshGroceriesDelivered')}</Text>
                        </View>
                        <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('Categories')}>
                            <Text style={styles.seeAllText}>{t('viewAll')}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                    </View>
                    {categories.length > 0 ? (
                        <FlatList
                            data={categories}
                            renderItem={renderCategory}
                            keyExtractor={(item) => item._id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoryList}
                        />
                    ) : (
                        <View style={styles.emptySection}>
                            <Text style={styles.emptyText}>{t('noCategories')}</Text>
                        </View>
                    )}
                </View>

                {/* Category-Wise Product Sections */}
                {getCategorySections().map((sec) => {
                    const filteredProducts = getFilteredProductsForSection(sec);
                    if (!filteredProducts || filteredProducts.length === 0) return null;

                    const tabs = getSubcategoryTabsForSection(sec);
                    const currentActiveTab = activeSubcats[sec.id] || 'all';

                    const totalFilteredCount = filteredProducts.length;
                    // Dynamic Layout Rule: < 12 items -> Single Row (1 row); >= 12 items -> 2 Rows
                    const isSingleRow = totalFilteredCount < 12;

                    const currentVisible = visibleCounts[sec.id] || 12;
                    const itemsToShow = filteredProducts.slice(0, currentVisible);
                    const isLoadingMore = !!loadingMoreSections[sec.id];
                    const hasMore = currentVisible < totalFilteredCount;

                    return (
                        <View key={sec.id} style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.sectionTitle}>{sec.title}</Text>
                                        <View style={{ flex: 1, height: 2, marginLeft: 10, justifyContent: 'center' }}>
                                            <Svg height="2" width="100%">
                                                <Line
                                                    x1="0"
                                                    y1="1"
                                                    x2="100%"
                                                    y2="1"
                                                    stroke="#CBD5E1"
                                                    strokeWidth="2"
                                                    strokeDasharray="6, 4"
                                                />
                                            </Svg>
                                        </View>
                                    </View>
                                    <Text style={styles.sectionSubtitle}>{totalFilteredCount} items available</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.seeAllButton}
                                    onPress={() => handleCategoryPress(sec.categoryObj)}
                                >
                                    <Text style={styles.seeAllText}>{t('viewAll')}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={16} color="#7C3AED" />
                                </TouchableOpacity>
                            </View>

                            {/* Premium Connected Outlined Category Tab Navigation */}
                            {tabs.length > 1 && (
                                <CategoryTabBar
                                    tabs={tabs}
                                    activeTabId={currentActiveTab}
                                    onTabSelect={(tabId) => {
                                        setActiveSubcats((prev) => ({ ...prev, [sec.id]: tabId }));
                                        setVisibleCounts((prev) => ({ ...prev, [sec.id]: 12 }));
                                    }}
                                    brandColor="#7C3AED"
                                    activeBgColor="#F3E8FF"
                                    inactiveTextColor="#1E293B"
                                />
                            )}

                            {/* Product List: 1-Row for <12 items, 2-Rows for >=12 items with Skeleton Loading */}
                            {isSingleRow ? (() => {
                                let singleRowData = [...itemsToShow];
                                if (isLoadingMore) {
                                    singleRowData.push(
                                        { _id: `skel-${sec.id}-1`, isSkeleton: true },
                                        { _id: `skel-${sec.id}-2`, isSkeleton: true }
                                    );
                                }
                                return (
                                    <FlatList
                                        data={singleRowData}
                                        keyExtractor={(item, index) => item._id || item.id || `skel-${index}`}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.productList2Rows}
                                        onEndReached={() => {
                                            if (hasMore && !isLoadingMore) {
                                                handleLoadMore(sec.id, totalFilteredCount);
                                            }
                                        }}
                                        onEndReachedThreshold={0.5}
                                        renderItem={({ item }) => {
                                            if (item.isSkeleton) {
                                                return <ProductCardSkeleton />;
                                            }
                                            return renderProduct({ item });
                                        }}
                                    />
                                );
                            })() : (() => {
                                const pairedProducts = [];
                                for (let i = 0; i < itemsToShow.length; i += 2) {
                                    pairedProducts.push({
                                        id: `pair-${sec.id}-${i}`,
                                        items: itemsToShow.slice(i, i + 2)
                                    });
                                }
                                if (isLoadingMore) {
                                    pairedProducts.push(
                                        { id: `skel-pair-${sec.id}-1`, isSkeletonPair: true },
                                        { id: `skel-pair-${sec.id}-2`, isSkeletonPair: true }
                                    );
                                }
                                return (
                                    <FlatList
                                        data={pairedProducts}
                                        keyExtractor={(item) => item.id}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.productList2Rows}
                                        onEndReached={() => {
                                            if (hasMore && !isLoadingMore) {
                                                handleLoadMore(sec.id, totalFilteredCount);
                                            }
                                        }}
                                        onEndReachedThreshold={0.5}
                                        renderItem={({ item }) => {
                                            if (item.isSkeletonPair) {
                                                return (
                                                    <View style={styles.twoRowColumnContainer}>
                                                        <ProductCardSkeleton />
                                                        <ProductCardSkeleton />
                                                    </View>
                                                );
                                            }
                                            const pair = item.items;
                                            return (
                                                <View style={styles.twoRowColumnContainer}>
                                                    {renderProduct({ item: pair[0] })}
                                                    {pair[1] ? renderProduct({ item: pair[1] }) : <View style={{ width: 155 }} />}
                                                </View>
                                            );
                                        }}
                                    />
                                );
                            })()}
                        </View>
                    );
                })}

                <View style={styles.bottomPadding} />
            </Animated.ScrollView>

            {/* Premium Floating Cart Bar */}
            <FloatingCartBar onPress={handleCartPress} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: '#FAFAFC', // Subtle soft tint background
        position: 'relative',
    },
    heroBannerWrapper: {
        marginTop: 4,
        marginBottom: 14,
    },
    bannerContainer: {
        height: 250,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        ...SHADOWS.medium,
        position: 'relative',
        backgroundColor: '#6C48C5',
    },
    heroBannerCardImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    bannerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    bannerTopPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    bannerTopPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#4C1D95',
        marginLeft: 4,
    },
    bannerHeadline: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 32,
        marginBottom: 8,
    },
    bannerSubtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    bannerHighlight: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FDE047',
        marginBottom: 16,
    },
    bannerShopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    bannerShopButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111111',
        marginRight: 4,
    },
    stickyHeaderWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        elevation: 100,
        backgroundColor: 'transparent',
    },
    featureGridContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 10,
    },
    featureGridCard: {
        borderRadius: 16,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
        ...SHADOWS.light,
    },
    featureIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    featureCardTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#1E1B4B',
        textAlign: 'center',
    },
    featureCardSubtitle: {
        fontSize: 9,
        fontWeight: '500',
        color: '#6B7280',
        marginTop: 1,
        textAlign: 'center',
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        gap: 4,
        marginLeft: 6,
    },
    timerText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#7C3AED',
        letterSpacing: 0.5,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginTop: 26,
        marginBottom: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    dashedHeaderLine: {
        flex: 1,
        height: 1,
        borderTopWidth: 1.5,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        marginHorizontal: 12,
    },
    subcatTabWrapper: {
        marginTop: 6,
        marginBottom: 16,
        position: 'relative',
        height: 38,
        justifyContent: 'flex-end',
    },
    subcatTabUnderline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#E11D48',
        zIndex: 1,
    },
    subcatTabScroll: {
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
        zIndex: 2,
    },
    subcatTabItem: {
        paddingHorizontal: 16,
        paddingTop: 7,
        paddingBottom: 7,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        marginBottom: -1,
    },
    subcatTabItemActive: {
        backgroundColor: '#FFF0F4',
        borderTopColor: '#E11D48',
        borderLeftColor: '#E11D48',
        borderRightColor: '#E11D48',
        borderBottomColor: '#FFF0F4',
        borderBottomWidth: 2,
    },
    subcatTabText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        letterSpacing: -0.2,
    },
    subcatTabTextActive: {
        color: '#E11D48',
        fontWeight: '800',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionBadge: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#FFF8E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    categoryList: {
        paddingHorizontal: 16,
    },
    productList: {
        paddingHorizontal: 16,
    },
    bottomPadding: {
        height: 140,
    },
    floatingCart: {
        position: 'absolute',
        bottom: 76,
        left: 16,
        right: 16,
        backgroundColor: COLORS.secondary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        paddingHorizontal: 18,
        ...SHADOWS.dark,
    },
    floatingCartLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    floatingCartBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    floatingCartItems: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.white,
    },
    floatingCartTotal: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.white,
    },
    floatingCartRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    floatingCartText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: COLORS.secondary,
        borderRadius: 12,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.white,
    },
    emptySection: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    categoryHeaderIconBadge: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    categorySectionWrapper: {
        marginBottom: 16,
    },
    categorySectionCard: {
        marginHorizontal: 12,
        backgroundColor: '#FAF8FE',
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: '#EFE8FB',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    categorySectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    twoRowColumnContainer: {
        flexDirection: 'column',
    },
    productList2Rows: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 4,
    },
    embeddedSearchWrapper: {
        marginTop: 6,
        marginBottom: 4,
    },
    quickCatBar: {
        marginTop: 2,
        marginBottom: 8,
        paddingHorizontal: 16,
    },
    quickCatScroll: {
        gap: 10,
        alignItems: 'center',
        paddingRight: 16,
    },
    quickCatPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        position: 'relative',
    },
    quickCatPillActive: {
        backgroundColor: COLORS.white,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        ...SHADOWS.light,
    },
    quickCatText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#444444',
    },
    quickCatTextActive: {
        fontWeight: '800',
        color: '#111111',
    },
    quickCatActiveLine: {
        position: 'absolute',
        bottom: -2,
        left: 12,
        right: 12,
        height: 2.5,
        backgroundColor: '#111111',
        borderRadius: 2,
    },
});

export default HomeScreen;
