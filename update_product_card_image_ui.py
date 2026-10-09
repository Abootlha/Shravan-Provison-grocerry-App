import re

new_code = """import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { COLORS, SHADOWS } from '../constants';

const ProductCard = ({ product, onPress, variant = 'default' }) => {
    const dispatch = useDispatch();
    const cartItems = useSelector((state) => state.cart.items);
    const cartItem = cartItems.find((item) => item.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;

    const handleAddToCart = (e) => {
        e.stopPropagation();
        dispatch(addToCart(product));
    };

    const handleIncrement = (e) => {
        e.stopPropagation();
        dispatch(incrementQuantity(product.id));
    };

    const handleDecrement = (e) => {
        e.stopPropagation();
        dispatch(decrementQuantity(product.id));
    };

    const isCompact = variant === 'compact';
    const isLarge = variant === 'large';
    
    const savings = product.originalPrice > product.price ? product.originalPrice - product.price : 0;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isCompact && styles.compactContainer,
                isLarge && styles.largeContainer
            ]}
            onPress={onPress}
            activeOpacity={0.95}
        >
            {/* Top Image Section */}
            <View style={[styles.imageWrapper, isLarge && styles.largeImageWrapper]}>
                <View style={styles.imageBackground}>
                    <Image
                        source={{ uri: product.image }}
                        style={[styles.image, isLarge && styles.largeImage]}
                        resizeMode="contain"
                    />
                </View>

                {/* Discount Badge - Top Left */}
                {product.discount > 0 && (
                    <View style={styles.discountBadge}>
                        <MaterialCommunityIcons name="brightness-percent" size={10} color={COLORS.white} style={{ marginRight: 2 }} />
                        <Text style={styles.discountText}>{product.discount}% OFF</Text>
                    </View>
                )}

                {/* Favorite Icon - Top Right */}
                <TouchableOpacity style={styles.favoriteButton}>
                    <MaterialCommunityIcons name="heart-outline" size={18} color="#666" />
                </TouchableOpacity>

                {/* Add Button / Stepper - Bottom Right inside Image Section */}
                <View style={styles.addButtonWrapper}>
                    {quantity === 0 ? (
                        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                            <MaterialCommunityIcons name="cart-outline" size={14} color={COLORS.secondary} style={{ marginRight: 4 }} />
                            <Text style={styles.addButtonText}>ADD</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.stepperContainer}>
                            <TouchableOpacity style={styles.stepperButton} onPress={handleDecrement}>
                                <MaterialCommunityIcons name="minus" size={14} color={COLORS.white} />
                            </TouchableOpacity>
                            <Text style={styles.stepperText}>{quantity}</Text>
                            <TouchableOpacity style={styles.stepperButton} onPress={handleIncrement}>
                                <MaterialCommunityIcons name="plus" size={14} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* Bottom Details Section */}
            <View style={styles.details}>
                {/* Price Row */}
                <View style={styles.priceRow}>
                    <Text style={[styles.price, isLarge && styles.largePrice]}>₹{product.price}</Text>
                    {product.originalPrice > product.price && (
                        <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                    )}
                </View>
                
                {/* Savings Pill */}
                {savings > 0 && (
                    <View style={styles.savingsPill}>
                        <Text style={styles.savingsText}>₹{savings} OFF</Text>
                    </View>
                )}

                {/* Title */}
                <Text style={[styles.name, isCompact && styles.compactName]} numberOfLines={2}>
                    {product.name}
                </Text>
                
                {/* Unit/Quantity */}
                <Text style={styles.unit}>{product.unit}</Text>
            </View>

            {/* Out of Stock Overlay */}
            {product.stock === 0 && (
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
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginRight: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        overflow: 'hidden',
    },
    compactContainer: {
        width: 135,
    },
    largeContainer: {
        width: 175,
    },
    imageWrapper: {
        position: 'relative',
        height: 140,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 11,
        borderTopRightRadius: 11,
    },
    largeImageWrapper: {
        height: 160,
    },
    imageBackground: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    largeImage: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E53935', // Standard red for discount
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        zIndex: 10,
    },
    discountText: {
        color: COLORS.white,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    favoriteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        padding: 4,
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
        backgroundColor: '#E8F5E9', // Light green background
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minWidth: 65,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(12, 131, 31, 0.1)',
    },
    addButtonText: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: '800',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        borderRadius: 6,
        overflow: 'hidden',
        minWidth: 65,
        justifyContent: 'space-between',
    },
    stepperButton: {
        paddingHorizontal: 6,
        paddingVertical: 6,
    },
    stepperText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '800',
        minWidth: 16,
        textAlign: 'center',
    },
    details: {
        padding: 10,
        paddingTop: 6,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111',
    },
    largePrice: {
        fontSize: 17,
    },
    originalPrice: {
        fontSize: 12,
        color: '#888',
        textDecorationLine: 'line-through',
        marginLeft: 6,
        marginTop: 2,
    },
    savingsPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFEBEE',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 8,
    },
    savingsText: {
        color: '#D32F2F',
        fontSize: 9,
        fontWeight: '800',
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: '#222',
        lineHeight: 16,
        minHeight: 32,
        marginBottom: 4,
    },
    compactName: {
        fontSize: 11,
        minHeight: 30,
    },
    unit: {
        fontSize: 11,
        color: '#888',
        fontWeight: '500',
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        zIndex: 20,
    },
    outOfStockText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D32F2F',
        backgroundColor: '#FFEbee',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
});

export default ProductCard;
"""

with open('customer-app/components/ProductCard.js', 'w') as f:
    f.write(new_code)
