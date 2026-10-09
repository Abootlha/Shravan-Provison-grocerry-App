import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { toggleWishlistItem } from '../store/slices/wishlistSlice';
import * as Haptics from 'expo-haptics';

// Unified Brand Theme (Electric Purple for all discount tags, ADD buttons, steppers, and offer badges)
const BRAND_THEME = {
    badgeBg: '#7C3AED',      // Vibrant Purple for Discount Tag
    badgeText: '#FFFFFF',
    pillBg: '#F3E8FF',       // Soft Light Purple Tint for Savings Tag
    pillText: '#7C3AED',     // Purple Text for Savings Tag
    accentColor: '#7C3AED',  // Vibrant Purple for ADD Button & Stepper
};

const ProductCard = ({ product, onPress, variant = 'default', style }) => {
    const dispatch = useDispatch();
    const cartItems = useSelector((state) => state.cart.items);
    const wishlistItems = useSelector((state) => state.wishlist?.items || []);
    const cartItem = cartItems.find((item) => item.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;

    const isWishlisted = wishlistItems.some((item) => item.id === product.id);

    const theme = BRAND_THEME;

    const handleAddToCart = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        dispatch(addToCart(product));
    };

    const handleIncrement = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        dispatch(incrementQuantity(product.id));
    };

    const handleDecrement = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        dispatch(decrementQuantity(product.id));
    };

    const toggleWishlist = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        dispatch(toggleWishlistItem(product));
    };

    const isCompact = variant === 'compact';
    const isLarge = variant === 'large';

    const price = Number(product.price) || 0;
    const originalPrice = Number(product.originalPrice) || 0;
    const savings = originalPrice > price ? originalPrice - price : 0;

    // Discount percentage or flat offer
    const discountPercent = product.discount || (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0);

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isCompact && styles.compactContainer,
                isLarge && styles.largeContainer,
                isWishlisted && styles.wishlistedContainer,
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.92}
        >
            {/* 1. PRODUCT IMAGE SECTION */}
            <View style={[styles.imageWrapper, { backgroundColor: '#FFFFFF' }, isLarge && styles.largeImageWrapper]}>
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: product.image }}
                        style={styles.image}
                        resizeMode="contain"
                    />
                </View>

                {/* 2. DISCOUNT BADGE - Top Left Pill */}
                {discountPercent > 0 && (
                    <View style={[styles.discountBadge, { backgroundColor: theme.badgeBg }]}>
                        <Text style={[styles.discountText, { color: theme.badgeText }]}>
                            {discountPercent}% OFF
                        </Text>
                    </View>
                )}

                {/* Light Pink Semi-Circle Top-Right Corner Wishlist Button */}
                <TouchableOpacity
                    style={styles.topRightSemiCircle}
                    onPress={toggleWishlist}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <MaterialCommunityIcons
                        name={isWishlisted ? "heart" : "heart-outline"}
                        size={17}
                        color="#E11D48"
                    />
                </TouchableOpacity>

                {/* 3. ADD BUTTON / STEPPER - Bottom Right of Image Area */}
                <View style={styles.addButtonWrapper}>
                    {quantity === 0 ? (
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                { borderColor: theme.accentColor, backgroundColor: '#FFFFFF' }
                            ]}
                            onPress={handleAddToCart}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons
                                name="cart-outline"
                                size={13}
                                color={theme.accentColor}
                                style={{ marginRight: 3 }}
                            />
                            <Text style={[styles.addButtonText, { color: theme.accentColor }]}>
                                ADD
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.stepperContainer, { backgroundColor: theme.accentColor }]}>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={handleDecrement}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="minus" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.stepperText}>{quantity}</Text>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={handleIncrement}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* PRODUCT DETAILS (Below Image Section) */}
            <View style={styles.details}>
                {/* 5. PRICE SECTION: Current Price + Original MRP */}
                <View style={styles.priceRow}>
                    <Text style={[styles.price, isLarge && styles.largePrice]}>
                        ₹{price}
                    </Text>
                    {originalPrice > price && (
                        <Text style={styles.originalPrice}>
                            ₹{originalPrice}
                        </Text>
                    )}
                </View>

                {/* 6. SAVING LABEL: Small colored pill/chip below price */}
                {savings > 0 ? (
                    <View style={[styles.savingsPill, { backgroundColor: theme.pillBg }]}>
                        <Text style={[styles.savingsText, { color: theme.pillText }]}>
                            ₹{savings} OFF
                        </Text>
                    </View>
                ) : (
                    <View style={styles.savingsPillPlaceholder} />
                )}

                {/* 4. PRODUCT NAME: Bold modern typography, max 2 lines */}
                <View style={styles.nameContainer}>
                    <Text
                        style={[styles.name, isCompact && styles.compactName]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {product.name}
                    </Text>
                </View>

                {/* 4. PACK / QUANTITY SIZE: Smaller muted text */}
                <Text style={styles.unit} numberOfLines={1}>
                    {product.unit || product.packSize || '1 pack'}
                </Text>
            </View>

            {/* Out of Stock Overlay */}
            {product.inStock === false && (
                <View style={styles.outOfStockOverlay}>
                    <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 155,
        height: 260, // Explicit fixed height for every card
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        marginRight: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        justifyContent: 'space-between',
        ...Platform.select({
            ios: {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
            },
        }),
    },
    compactContainer: {
        width: 135,
        height: 245,
    },
    largeContainer: {
        width: 175,
        height: 280,
    },
    wishlistedContainer: {
        borderColor: '#E11D48',
        borderWidth: 1.5,
        ...Platform.select({
            ios: {
                shadowColor: '#E11D48',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.14,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
            },
        }),
    },
    imageWrapper: {
        position: 'relative',
        height: 145,
        borderTopLeftRadius: 13,
        borderTopRightRadius: 13,
        overflow: 'hidden',
    },
    largeImageWrapper: {
        height: 165,
    },
    imageContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        paddingTop: 8,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        zIndex: 10,
    },
    discountText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    topRightSemiCircle: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 38,
        height: 38,
        borderBottomLeftRadius: 38,
        backgroundColor: '#FFEBF0', // Soft light pink background blending into white
        zIndex: 10,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingTop: 6,
        paddingRight: 6,
    },
    addButtonWrapper: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minWidth: 62,
        height: 28,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    addButtonText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 8,
        minWidth: 65,
        height: 28,
        paddingHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 2,
    },
    stepperButton: {
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        minWidth: 16,
        textAlign: 'center',
    },
    details: {
        padding: 10,
        paddingTop: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.2,
    },
    largePrice: {
        fontSize: 17,
    },
    originalPrice: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94A3B8',
        textDecorationLine: 'line-through',
        marginLeft: 6,
    },
    savingsPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 6,
    },
    savingsText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    savingsPillPlaceholder: {
        height: 17,
        marginBottom: 6,
    },
    nameContainer: {
        minHeight: 34,
        justifyContent: 'center',
        marginBottom: 4,
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E293B',
        lineHeight: 16,
    },
    compactName: {
        fontSize: 11,
        lineHeight: 15,
    },
    unit: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        zIndex: 20,
    },
    outOfStockText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
});

export default ProductCard;
