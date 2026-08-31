import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { COLORS, SHADOWS, PRODUCTS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const { width } = Dimensions.get('window');

const ProductDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { product } = route.params;
    const { currentLanguage } = useTranslation();
    const dispatch = useDispatch();
    const cartItems = useSelector((state) => state.cart.items);
    const productId = product.id || product._id || product.productId;
    const normalizedProduct = { ...product, id: productId };
    const cartItem = cartItems.find((item) => item.id === productId);
    const quantity = cartItem ? cartItem.quantity : 0;

    const [translatedProduct, setTranslatedProduct] = useState(product);
    const [expandedSections, setExpandedSections] = useState({
        description: true,
        highlights: true,
        nutritional: false,
        ingredients: false,
        storage: false,
    });

    // Translate product when language changes
    useEffect(() => {
        const translateProduct = async () => {
            if (currentLanguage === 'hi') {
                try {
                    const translated = {
                        ...product,
                        name: product.nameHi || await translateToHindi(product.name),
                        description: product.descriptionHi || (product.description ? await translateToHindi(product.description) : product.description),
                        highlights: product.highlightsHi || (product.highlights ? await translateToHindi(product.highlights) : product.highlights),
                        brand: product.brandHi || (product.brand ? await translateToHindi(product.brand) : product.brand)
                    };
                    setTranslatedProduct(translated);
                } catch (err) {
                    console.error('Translation error:', err);
                    setTranslatedProduct(product);
                }
            } else {
                setTranslatedProduct(product);
            }
        };

        translateProduct();
    }, [currentLanguage, product]);

    const similarProducts = PRODUCTS.filter(
        (p) => p.categoryId === product.categoryId && p.id !== product.id
    ).slice(0, 4);

    const handleAddToCart = () => {
        dispatch(addToCart(normalizedProduct));
    };

    const handleIncrement = () => {
        dispatch(incrementQuantity(productId));
    };

    const handleDecrement = () => {
        dispatch(decrementQuantity(productId));
    };

    const handleBackPress = () => {
        navigation.goBack();
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const renderDescriptionText = (text) => {
        if (!text) return null;
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return <View key={index} style={{ height: 8 }} />;
            
            // Short lines without trailing punctuation act as bold headings
            const isHeading = trimmedLine.length < 35 && !/[.,;:]$/.test(trimmedLine);
            if (isHeading) {
                return (
                    <Text key={index} style={[styles.description, { fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 4, fontSize: 15 }]}>
                        {trimmedLine}
                    </Text>
                );
            }
            return (
                <Text key={index} style={styles.description}>
                    {trimmedLine}
                </Text>
            );
        });
    };

    const renderHighlightsList = (text) => {
        if (!text) return null;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const pairs = [];
        for (let i = 0; i < lines.length; i += 2) {
            if (i + 1 < lines.length && lines[i].length < 40) {
                pairs.push({ key: lines[i], value: lines[i+1] });
            } else {
                pairs.push({ key: null, value: lines[i] });
                i--;
            }
        }
        
        return pairs.map((pair, index) => (
            <View key={index} style={[styles.infoRow, { paddingVertical: 4, borderBottomWidth: index === pairs.length - 1 ? 0 : 1, borderBottomColor: '#F0F0F0' }]}>
                {pair.key && <Text style={[styles.infoLabel, { flex: 0.4 }]}>{pair.key}</Text>}
                <Text style={[styles.infoValue, { flex: pair.key ? 0.6 : 1, textAlign: pair.key ? 'right' : 'left' }]}>{pair.value}</Text>
            </View>
        ));
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
                <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareButton}>
                    <MaterialCommunityIcons name="share-variant" size={22} color={COLORS.text} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Product Image */}
                <View style={styles.imageContainer}>
                    {translatedProduct.discount > 0 && (
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>{translatedProduct.discount}% OFF</Text>
                        </View>
                    )}
                    <Image
                        source={{ uri: translatedProduct.image }}
                        style={styles.productImage}
                        resizeMode="contain"
                    />
                </View>

                {/* Product Info */}
                <View style={styles.infoContainer}>
                    {/* Delivery Badge */}
                    <View style={styles.deliveryBadge}>
                        <MaterialCommunityIcons name="clock-fast" size={16} color={COLORS.secondary} />
                        <Text style={styles.deliveryText}>Delivery in 10 mins</Text>
                    </View>

                    <Text style={styles.productName}>{translatedProduct.name}</Text>
                    <Text style={styles.productUnit}>{translatedProduct.unit}</Text>

                    {/* Rating */}
                    <View style={styles.ratingContainer}>
                        <View style={styles.ratingBadge}>
                            <MaterialCommunityIcons name="star" size={14} color={COLORS.white} />
                            <Text style={styles.ratingText}>{translatedProduct.rating}</Text>
                        </View>
                        <Text style={styles.reviewsText}>{translatedProduct.reviews} reviews</Text>
                    </View>

                    {/* Price */}
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>₹{translatedProduct.price}</Text>
                        {translatedProduct.originalPrice > translatedProduct.price && (
                            <>
                                <Text style={styles.originalPrice}>₹{translatedProduct.originalPrice}</Text>
                                <View style={styles.savingsBadge}>
                                    <Text style={styles.savingsText}>
                                        Save ₹{translatedProduct.originalPrice - translatedProduct.price}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Product Description Section */}
                    <TouchableOpacity 
                        style={styles.sectionContainer}
                        onPress={() => toggleSection('description')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Product Details</Text>
                            <MaterialCommunityIcons 
                                name={expandedSections.description ? "chevron-up" : "chevron-down"} 
                                size={22} 
                                color={COLORS.textSecondary} 
                            />
                        </View>
                    </TouchableOpacity>
                    {expandedSections.description && (
                        <View style={styles.sectionContent}>
                            {renderDescriptionText(translatedProduct.description)}
                        </View>
                    )}
                    <View style={styles.sectionDivider} />

                    {/* Highlights Section */}
                    {translatedProduct.highlights && (
                        <>
                            <TouchableOpacity 
                                style={styles.sectionContainer}
                                onPress={() => toggleSection('highlights')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Highlights</Text>
                                    <MaterialCommunityIcons 
                                        name={expandedSections.highlights ? "chevron-up" : "chevron-down"} 
                                        size={22} 
                                        color={COLORS.textSecondary} 
                                    />
                                </View>
                            </TouchableOpacity>
                            {expandedSections.highlights && (
                                <View style={styles.sectionContent}>
                                    {renderHighlightsList(translatedProduct.highlights)}
                                </View>
                            )}
                            <View style={styles.sectionDivider} />
                        </>
                    )}

                    {/* Nutritional Information Section */}
                    <TouchableOpacity 
                        style={styles.sectionContainer}
                        onPress={() => toggleSection('nutritional')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Nutritional Information</Text>
                            <MaterialCommunityIcons 
                                name={expandedSections.nutritional ? "chevron-up" : "chevron-down"} 
                                size={22} 
                                color={COLORS.textSecondary} 
                            />
                        </View>
                    </TouchableOpacity>
                    {expandedSections.nutritional && (
                        <View style={styles.sectionContent}>
                            <View style={styles.nutritionalTable}>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Energy</Text>
                                    <Text style={styles.nutritionalValue}>150 kcal</Text>
                                </View>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Protein</Text>
                                    <Text style={styles.nutritionalValue}>3.5g</Text>
                                </View>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Carbohydrates</Text>
                                    <Text style={styles.nutritionalValue}>25g</Text>
                                </View>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Total Fat</Text>
                                    <Text style={styles.nutritionalValue}>5g</Text>
                                </View>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Sugar</Text>
                                    <Text style={styles.nutritionalValue}>12g</Text>
                                </View>
                                <View style={styles.nutritionalRow}>
                                    <Text style={styles.nutritionalLabel}>Sodium</Text>
                                    <Text style={styles.nutritionalValue}>200mg</Text>
                                </View>
                            </View>
                            <Text style={styles.nutritionalNote}>*Per 100g serving</Text>
                        </View>
                    )}
                    <View style={styles.sectionDivider} />

                    {/* Unit & Shelf Life Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Unit</Text>
                            <Text style={styles.infoValue}>{translatedProduct.unit}</Text>
                        </View>
                    </View>
                    <View style={styles.sectionDivider} />

                    <View style={styles.sectionContainer}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Shelf Life</Text>
                            <Text style={styles.infoValue}>6 months</Text>
                        </View>
                    </View>
                    <View style={styles.sectionDivider} />

                    {/* Why Choose Section */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Why Choose This?</Text>
                        <View style={styles.whyChooseList}>
                            <View style={styles.whyChooseItem}>
                                <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.secondary} />
                                <Text style={styles.whyChooseText}>100% Fresh & Quality Assured</Text>
                            </View>
                            <View style={styles.whyChooseItem}>
                                <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.secondary} />
                                <Text style={styles.whyChooseText}>Delivered in 10 minutes</Text>
                            </View>
                            <View style={styles.whyChooseItem}>
                                <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.secondary} />
                                <Text style={styles.whyChooseText}>Easy returns & refunds</Text>
                            </View>
                        </View>
                    </View>

                    {/* Similar Products */}
                    {similarProducts.length > 0 && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.similarProductsSection}>
                                <Text style={styles.similarProductsTitle}>Similar Products</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.similarProductsScroll}
                                >
                                    {similarProducts.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.similarProduct}
                                            onPress={() => navigation.push('ProductDetail', { product: item })}
                                        >
                                            <Image
                                                source={{ uri: item.image }}
                                                style={styles.similarImage}
                                                resizeMode="contain"
                                            />
                                            <Text style={styles.similarName} numberOfLines={2}>
                                                {item.name}
                                            </Text>
                                            <Text style={styles.similarUnit}>{item.unit}</Text>
                                            <View style={styles.similarPriceRow}>
                                                <Text style={styles.similarPrice}>₹{item.price}</Text>
                                                {item.originalPrice > item.price && (
                                                    <Text style={styles.similarOriginalPrice}>₹{item.originalPrice}</Text>
                                                )}
                                            </View>
                                            <TouchableOpacity style={styles.similarAddButton}>
                                                <Text style={styles.similarAddText}>ADD</Text>
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </>
                    )}

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            {/* Bottom CTA */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomPrice}>
                    <Text style={styles.bottomPriceLabel}>Total Price</Text>
                    <Text style={styles.bottomPriceValue}>₹{translatedProduct.price * (quantity || 1)}</Text>
                </View>

                {quantity === 0 ? (
                    <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
                        <MaterialCommunityIcons name="cart-plus" size={22} color={COLORS.white} />
                        <Text style={styles.addToCartText}>Add to Cart</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.quantityContainer}>
                        <TouchableOpacity style={styles.quantityButton} onPress={handleDecrement}>
                            <MaterialCommunityIcons name="minus" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{quantity}</Text>
                        <TouchableOpacity style={styles.quantityButton} onPress={handleIncrement}>
                            <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    shareButton: {
        padding: 8,
    },
    scrollView: {
        flex: 1,
    },
    imageContainer: {
        width: width,
        height: 280,
        backgroundColor: '#F8F8F8',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    discountBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        zIndex: 1,
    },
    discountText: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    productImage: {
        width: '80%',
        height: '80%',
    },
    infoContainer: {
        padding: 20,
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 12,
    },
    deliveryText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.secondary,
        marginLeft: 6,
    },
    productName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text,
        lineHeight: 28,
    },
    productUnit: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    ratingText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
    },
    reviewsText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 10,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
    },
    price: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text,
    },
    originalPrice: {
        fontSize: 18,
        color: COLORS.textSecondary,
        textDecorationLine: 'line-through',
        marginLeft: 12,
    },
    savingsBadge: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 12,
    },
    savingsText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FF9800',
    },
    divider: {
        height: 8,
        backgroundColor: '#F5F5F5',
        marginVertical: 16,
    },
    sectionContainer: {
        paddingVertical: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    sectionContent: {
        paddingTop: 12,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 4,
    },
    description: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    nutritionalTable: {
        marginTop: 4,
    },
    nutritionalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    nutritionalLabel: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '400',
    },
    nutritionalValue: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    nutritionalNote: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        marginTop: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '400',
    },
    infoValue: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    whyChooseList: {
        marginTop: 12,
    },
    whyChooseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    whyChooseText: {
        fontSize: 14,
        color: COLORS.text,
        marginLeft: 10,
        flex: 1,
    },
    similarProductsSection: {
        marginTop: 8,
    },
    similarProductsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
    },
    similarProductsScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    similarProduct: {
        width: 140,
        marginRight: 12,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    similarImage: {
        width: '100%',
        height: 100,
        marginBottom: 8,
    },
    similarName: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.text,
        lineHeight: 18,
        marginBottom: 4,
    },
    similarUnit: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 6,
    },
    similarPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    similarPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        marginRight: 6,
    },
    similarOriginalPrice: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textDecorationLine: 'line-through',
    },
    similarAddButton: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.secondary,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    similarAddText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...SHADOWS.medium,
    },
    bottomPrice: {
        flex: 1,
    },
    bottomPriceLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    bottomPriceValue: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        marginTop: 2,
    },
    addToCartButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 12,
    },
    addToCartText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        borderRadius: 12,
        overflow: 'hidden',
    },
    quantityButton: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    quantityText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: '700',
        paddingHorizontal: 16,
    },
});

export default ProductDetailScreen;
