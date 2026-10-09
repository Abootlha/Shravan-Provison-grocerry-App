import re

new_code = """import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { COLORS, SHADOWS } from '../constants';
import { LinearGradient } from 'expo-linear-gradient';

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

                {/* Discount Badge - Zepto style ribbon */}
                {product.discount > 0 && (
                    <LinearGradient
                        colors={['#5B21B6', '#7C3AED']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.discountBadge}
                    >
                        <MaterialCommunityIcons name="brightness-percent" size={10} color={COLORS.white} style={{ marginRight: 2 }} />
                        <Text style={styles.discountText}>{product.discount}% OFF</Text>
                    </LinearGradient>
                )}

                {/* Delivery Time Badge - overlapping image */}
                <View style={styles.deliveryBadge}>
                    <MaterialCommunityIcons name="clock-fast" size={12} color={COLORS.secondary} />
                    <Text style={styles.deliveryText}>8 MINS</Text>
                </View>
            </View>

            {/* Bottom Details Section */}
            <View style={styles.details}>
                {/* Title */}
                <Text style={[styles.name, isCompact && styles.compactName]} numberOfLines={2}>
                    {product.name}
                </Text>
                
                {/* Unit/Quantity */}
                <Text style={styles.unit}>{product.unit}</Text>

                {/* Price and Add Button */}
                <View style={styles.priceRow}>
                    <View style={styles.priceContainer}>
                        <Text style={[styles.price, isLarge && styles.largePrice]}>₹{product.price}</Text>
                        {product.originalPrice > product.price && (
                            <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                        )}
                    </View>

                    {/* Add / Stepper */}
                    {quantity === 0 ? (
                        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                            <Text style={styles.addButtonText}>ADD</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.stepperContainer}>
                            <TouchableOpacity style={styles.stepperButton} onPress={handleDecrement}>
                                <MaterialCommunityIcons name="minus" size={16} color={COLORS.white} />
                            </TouchableOpacity>
                            <Text style={styles.stepperText}>{quantity}</Text>
                            <TouchableOpacity style={styles.stepperButton} onPress={handleIncrement}>
                                <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
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
        width: 145,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginRight: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    compactContainer: {
        width: 130,
    },
    largeContainer: {
        width: 165,
    },
    imageWrapper: {
        position: 'relative',
        height: 120,
        backgroundColor: '#F8F8F8',
        borderTopLeftRadius: 11,
        borderTopRightRadius: 11,
    },
    largeImageWrapper: {
        height: 145,
    },
    imageBackground: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
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
        top: 0,
        left: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderTopLeftRadius: 11,
        borderBottomRightRadius: 8,
        zIndex: 10,
    },
    discountText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    deliveryBadge: {
        position: 'absolute',
        bottom: -10,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10,
    },
    deliveryText: {
        fontSize: 9,
        color: '#444',
        fontWeight: '800',
        marginLeft: 3,
        letterSpacing: 0.2,
    },
    details: {
        padding: 10,
        paddingTop: 18,
    },
    name: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111',
        lineHeight: 18,
        minHeight: 36,
    },
    compactName: {
        fontSize: 12,
        minHeight: 32,
    },
    unit: {
        fontSize: 11,
        color: '#777',
        marginTop: 4,
        fontWeight: '500',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    priceContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111',
    },
    largePrice: {
        fontSize: 16,
    },
    originalPrice: {
        fontSize: 11,
        color: '#888',
        textDecorationLine: 'line-through',
        marginTop: 1,
    },
    addButton: {
        backgroundColor: '#FFF4F7',
        borderWidth: 1,
        borderColor: '#E91E63',
        borderRadius: 6,
        paddingHorizontal: 16,
        paddingVertical: 6,
        minWidth: 60,
        alignItems: 'center',
    },
    addButtonText: {
        color: '#E91E63',
        fontSize: 13,
        fontWeight: '800',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E91E63',
        borderRadius: 6,
        overflow: 'hidden',
        minWidth: 60,
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
