import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import {
    Header,
    SearchBar,
    BannerCarousel,
    CategoryCard,
    ProductCard,
} from '../components';
import { COLORS, BANNERS, SHADOWS } from '../constants';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const HomeScreen = ({ navigation }) => {
    const { t, currentLanguage } = useTranslation();
    const cartItems = useSelector((state) => state.cart.totalItems);
    const totalAmount = useSelector((state) => state.cart.totalAmount);
    const { selectedAddress } = useSelector((state) => state.location);

    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    const renderCategory = ({ item }) => {
        const displayName = currentLanguage === 'hi' && item.translatedName 
            ? item.translatedName 
            : item.name;
        
        return (
            <CategoryCard 
                category={{
                    id: item._id,
                    name: displayName,
                    icon: item.icon || 'package-variant',
                    color: item.color || '#E8F5E9',
                    image: item.icon  // Use icon field for image as well
                }} 
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

    const CartBadge = () => (
        <TouchableOpacity style={styles.cartButton} onPress={handleCartPress} activeOpacity={0.85}>
            <View style={styles.cartIconWrapper}>
                <MaterialCommunityIcons name="cart-outline" size={22} color={COLORS.text} />
            </View>
            {cartItems > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{cartItems}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.primary} />
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    subtitle={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    deliveryTime="10 mins"
                    rightComponent={<CartBadge />}
                    onLocationPress={handleLocationPress}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.primary} />
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    subtitle={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    deliveryTime="10 mins"
                    rightComponent={<CartBadge />}
                    onLocationPress={handleLocationPress}
                />
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={64} color={COLORS.textSecondary} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                        <Text style={styles.retryButtonText}>{t('retry')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.primary} />

            {/* Header with Location */}
            <Header
                showLocation
                location={selectedAddress?.type || 'Home'}
                subtitle={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                deliveryTime="10 mins"
                rightComponent={<CartBadge />}
                onLocationPress={handleLocationPress}
            />

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Search Bar */}
                <SearchBar onPress={handleSearchPress} />

                {/* Banner Carousel */}
                <BannerCarousel banners={BANNERS} />

                {/* Categories Section */}
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

                {/* Featured Products */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <View style={styles.sectionBadge}>
                                <MaterialCommunityIcons name="star" size={12} color="#FFB300" />
                            </View>
                            <Text style={styles.sectionTitle}>{t('featuredProducts')}</Text>
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

                {/* Quick Links */}
                <View style={styles.quickLinksSection}>
                    <Text style={styles.quickLinksTitle}>{t('quickAccess')}</Text>
                    <View style={styles.quickLinks}>
                        <TouchableOpacity style={styles.quickLink}>
                            <View style={[styles.quickIcon, { backgroundColor: '#FFF3E0' }]}>
                                <MaterialCommunityIcons name="percent" size={22} color="#FF9800" />
                            </View>
                            <Text style={styles.quickLinkText}>{t('offers')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickLink}>
                            <View style={[styles.quickIcon, { backgroundColor: '#E3F2FD' }]}>
                                <MaterialCommunityIcons name="lightning-bolt" size={22} color="#1976D2" />
                            </View>
                            <Text style={styles.quickLinkText}>{t('flashSale')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickLink}>
                            <View style={[styles.quickIcon, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialCommunityIcons name="package-variant" size={22} color={COLORS.secondary} />
                            </View>
                            <Text style={styles.quickLinkText}>{t('combos')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickLink}>
                            <View style={[styles.quickIcon, { backgroundColor: '#FCE4EC' }]}>
                                <MaterialCommunityIcons name="crown" size={22} color="#E91E63" />
                            </View>
                            <Text style={styles.quickLinkText}>{t('premium')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Floating Cart Bar */}
            {cartItems > 0 && (
                <TouchableOpacity style={styles.floatingCart} onPress={handleCartPress} activeOpacity={0.95}>
                    <View style={styles.floatingCartLeft}>
                        <View style={styles.floatingCartBadge}>
                            <Text style={styles.floatingCartItems}>{cartItems} items</Text>
                        </View>
                        <Text style={styles.floatingCartTotal}>₹{totalAmount}</Text>
                    </View>
                    <View style={styles.floatingCartRight}>
                        <Text style={styles.floatingCartText}>View Cart</Text>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.white} />
                    </View>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        marginTop: 12,
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
    quickLinksSection: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
    quickLinksTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 14,
    },
    quickLinks: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 16,
        ...SHADOWS.light,
    },
    quickLink: {
        alignItems: 'center',
        flex: 1,
    },
    quickIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    quickLinkText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.text,
    },
    cartButton: {
        position: 'relative',
    },
    cartIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.secondary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '800',
    },
    bottomPadding: {
        height: 100,
    },
    floatingCart: {
        position: 'absolute',
        bottom: 20,
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
});

export default HomeScreen;
