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
import { useSelector } from 'react-redux';
import {
    Header,
    SearchBar,
    CategoryCard,
    ProductCard,
    FloatingCartBar,
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
                ProductService.getProducts({ limit: 20 })
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

            {/* Subtle Gradient & Ambient Glow Blobs Background */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={styles.ambientBlobTopRight} />
                <View style={styles.ambientBlobMidLeft} />
                <View style={styles.ambientBlobBottomRight} />
            </View>

            {/* ===== STICKY HEADER (Location, SearchBar, Popular Tags & Quick Categories Sticky) ===== */}
            <View style={styles.stickyHeaderWrapper}>
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
            </View>

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

                {/* Flash Deals Section (with Timer Badge) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#7C3AED" />
                            <Text style={styles.sectionTitle}>Flash Deals</Text>
                            <View style={styles.timerBadge}>
                                <MaterialCommunityIcons name="clock-outline" size={12} color="#7C3AED" />
                                <Text style={styles.timerText}>08 : 45 : 12</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.seeAllButton}>
                            <Text style={styles.seeAllText}>{t('viewAll')}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                    </View>
                    {products.length > 0 ? (
                        <FlatList
                            data={products.slice(0, 6)}
                            renderItem={renderProduct}
                            keyExtractor={(item) => item._id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.productList}
                        />
                    ) : (
                        <View style={styles.emptySection}>
                            <Text style={styles.emptyText}>{t('noProducts')}</Text>
                        </View>
                    )}
                </View>

                {/* Best Sellers */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <View style={[styles.sectionBadge, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialCommunityIcons name="trending-up" size={12} color={COLORS.secondary} />
                            </View>
                            <Text style={styles.sectionTitle}>{t('bestSellers')}</Text>
                        </View>
                        <TouchableOpacity style={styles.seeAllButton}>
                            <Text style={styles.seeAllText}>{t('viewAll')}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.secondary} />
                        </TouchableOpacity>
                    </View>
                    {products.length > 6 ? (
                        <FlatList
                            data={products.slice(6, 12)}
                            renderItem={renderProduct}
                            keyExtractor={(item) => item._id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.productList}
                        />
                    ) : (
                        <View style={styles.emptySection}>
                            <Text style={styles.emptyText}>{t('noProducts')}</Text>
                        </View>
                    )}
                </View>

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
    ambientBlobTopRight: {
        position: 'absolute',
        top: 160,
        right: -70,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: '#FFE0B2',
        opacity: 0.28,
    },
    ambientBlobMidLeft: {
        position: 'absolute',
        top: 420,
        left: -90,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: '#C8E6C9',
        opacity: 0.25,
    },
    ambientBlobBottomRight: {
        position: 'absolute',
        top: 750,
        right: -80,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#F8BBD0',
        opacity: 0.22,
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
        zIndex: 100,
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
        marginTop: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 14,
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
