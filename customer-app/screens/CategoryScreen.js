import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    ScrollView,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Header, ProductCard } from '../components';
import { COLORS } from '../constants';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const CategoryScreen = ({ route, navigation }) => {
    const { category } = route.params;
    const { currentLanguage } = useTranslation();
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [subcategories, setSubcategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get cart and location from Redux
    const cartItems = useSelector((state) => state.cart.totalItems);
    const { selectedAddress } = useSelector((state) => state.location);

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
                            translatedName: subcat.nameHi || await translateToHindi(subcat.name)
                        }))
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
            const params = isCategory 
                ? { categoryId: subcategoryId, limit: 100 }
                : { subcategoryId, limit: 100 };
                
            const productsData = await ProductService.getProducts(params);
            let finalProducts = productsData.products || [];
            
            // If Hindi is selected, translate immediately before setting state
            if (currentLanguage === 'hi' && finalProducts.length > 0) {
                try {
                    finalProducts = await Promise.all(
                        finalProducts.map(async (prod) => ({
                            ...prod,
                            translatedName: prod.nameHi || await translateToHindi(prod.name)
                        }))
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

    const handleProductPress = (product) => {
        navigation.navigate('ProductDetail', { product });
    };

    const handleBackPress = () => {
        navigation.goBack();
    };

    const handleLocationPress = () => {
        navigation.navigate('Location');
    };

    const handleSearchPress = () => {
        navigation.navigate('Main', { screen: 'Search' });
    };

    const handleCartPress = () => {
        navigation.navigate('Main', { screen: 'Cart' });
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

    const SearchButton = () => (
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress} activeOpacity={0.85}>
            <View style={styles.searchIconWrapper}>
                <MaterialCommunityIcons name="magnify" size={22} color={COLORS.text} />
            </View>
        </TouchableOpacity>
    );

    const renderSubcategory = ({ item }) => {
        const isSelected = selectedSubcategory?._id === item._id;
        const displayName = currentLanguage === 'hi' && item.translatedName 
            ? item.translatedName 
            : item.name;
        
        // Check if icon is a valid image URL or base64
        // Skip base64 images that are too large (over 100KB)
        const hasValidImage = item.icon && (
            item.icon.startsWith('http') || 
            (item.icon.startsWith('data:image/') && item.icon.length < 100000)
        );
        
        // Warn about large base64 images
        if (item.icon && item.icon.startsWith('data:image/') && item.icon.length > 100000) {
            console.warn(`Base64 image too large for ${item.name}: ${Math.round(item.icon.length / 1024)}KB. Please use an image URL or compress the image.`);
        }
        
        return (
            <TouchableOpacity
                style={[
                    styles.subcategoryItem,
                    isSelected && styles.subcategoryItemActive,
                ]}
                onPress={() => setSelectedSubcategory(item)}
                activeOpacity={0.7}
            >
                {/* Subcategory Icon/Image */}
                {hasValidImage ? (
                    <Image 
                        source={{ uri: item.icon }} 
                        style={styles.subcategoryIcon}
                        resizeMode="contain"
                        onError={(e) => {
                            console.log('Image load error for:', item.name);
                        }}
                    />
                ) : (
                    <View style={[
                        styles.subcategoryIconPlaceholder,
                        isSelected && styles.subcategoryIconPlaceholderActive
                    ]}>
                        <MaterialCommunityIcons 
                            name="package-variant" 
                            size={24} 
                            color={isSelected ? COLORS.secondary : COLORS.textSecondary} 
                        />
                    </View>
                )}
                
                {/* Subcategory Name */}
                <Text
                    style={[
                        styles.subcategoryText,
                        isSelected && styles.subcategoryTextActive,
                    ]}
                    numberOfLines={2}
                >
                    {displayName}
                </Text>
                
                {/* Active Indicator */}
                {isSelected && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
        );
    };

    const renderProduct = ({ item }) => {
        const displayName = currentLanguage === 'hi' && item.translatedName 
            ? item.translatedName 
            : item.name;
        
        return (
            <View style={styles.productWrapper}>
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
            </View>
        );
    };

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <Header
                    showLocation
                    showBack
                    location={selectedAddress?.type || 'Home'}
                    subtitle={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                    whiteBackground
                    onBackPress={handleBackPress}
                    onLocationPress={handleLocationPress}
                    rightComponent={
                        <View style={styles.headerRight}>
                            <SearchButton />
                            <CartBadge />
                        </View>
                    }
                />
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={64} color={COLORS.textSecondary} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Reusable Header with Location and Back Button */}
            <Header
                showLocation
                showBack
                location={selectedAddress?.type || 'Home'}
                subtitle={selectedAddress ? `${selectedAddress.address}` : 'Select your location'}
                whiteBackground
                onBackPress={handleBackPress}
                onLocationPress={handleLocationPress}
                rightComponent={
                    <View style={styles.headerRight}>
                        <SearchButton />
                        <CartBadge />
                    </View>
                }
            />

            <View style={styles.content}>
                {/* Left Sidebar - Subcategories */}
                <View style={styles.sidebar}>
                    <FlatList
                        data={subcategories}
                        renderItem={renderSubcategory}
                        keyExtractor={(item) => item._id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.subcategoryList}
                    />
                </View>

                {/* Right Content - Products */}
                <View style={styles.productsContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.secondary} />
                            <Text style={styles.loadingText}>Loading products...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={products}
                            renderItem={renderProduct}
                            keyExtractor={(item) => item._id}
                            numColumns={2}
                            contentContainerStyle={styles.productGrid}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <MaterialCommunityIcons name="package-variant" size={64} color={COLORS.textSecondary} />
                                    <Text style={styles.emptyText}>No products found</Text>
                                    <Text style={styles.emptySubtext}>Check back later for new items</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchButton: {
        marginRight: 8,
    },
    searchIconWrapper: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartButton: {
        position: 'relative',
    },
    cartIconWrapper: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: COLORS.background,
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
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 100,
        backgroundColor: '#F8F8F8',
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    subcategoryList: {
        paddingVertical: 8,
    },
    subcategoryItem: {
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: 'transparent',
    },
    subcategoryItemActive: {
        backgroundColor: COLORS.white,
    },
    subcategoryIcon: {
        width: 48,
        height: 48,
        marginBottom: 8,
        borderRadius: 8,
    },
    subcategoryIconPlaceholder: {
        width: 48,
        height: 48,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subcategoryIconPlaceholderActive: {
        backgroundColor: '#E8F5E9',
    },
    subcategoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 14,
    },
    subcategoryTextActive: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
    activeIndicator: {
        position: 'absolute',
        left: 0,
        top: '50%',
        marginTop: -20,
        width: 3,
        height: 40,
        backgroundColor: COLORS.secondary,
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    productsContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    productGrid: {
        padding: 8,
    },
    productWrapper: {
        flex: 1,
        padding: 8,
        maxWidth: '50%',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    emptySubtext: {
        marginTop: 4,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});

export default CategoryScreen;
