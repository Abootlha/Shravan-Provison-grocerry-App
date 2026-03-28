import React from 'react';
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

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isCompact && styles.compactContainer,
                isLarge && styles.largeContainer
            ]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            {/* Discount Badge */}
            {product.discount > 0 && (
                <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{product.discount}% OFF</Text>
                </View>
            )}

            {/* Product Image */}
            <View style={[styles.imageContainer, isLarge && styles.largeImageContainer]}>
                <Image
                    source={{ uri: product.image }}
                    style={[styles.image, isLarge && styles.largeImage]}
                    resizeMode="contain"
                />

                {/* Quick Add Button - appears on hover for large cards */}
                {isLarge && quantity === 0 && (
                    <TouchableOpacity
                        style={styles.quickAddButton}
                        onPress={handleAddToCart}
                    >
                        <MaterialCommunityIcons name="plus" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Delivery Time Badge */}
            <View style={styles.deliveryBadge}>
                <MaterialCommunityIcons name="clock-fast" size={10} color={COLORS.secondary} />
                <Text style={styles.deliveryText}>10 MINS</Text>
            </View>

            {/* Product Details */}
            <View style={styles.details}>
                <Text style={[styles.name, isCompact && styles.compactName]} numberOfLines={2}>
                    {product.name}
                </Text>
                <Text style={styles.unit}>{product.unit}</Text>

                <View style={styles.priceRow}>
                    <View style={styles.priceContainer}>
                        <Text style={[styles.price, isLarge && styles.largePrice]}>₹{product.price}</Text>
                        {product.originalPrice > product.price && (
                            <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
                        )}
                    </View>

                    {/* Add to Cart Button */}
                    {quantity === 0 ? (
                        <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                            <Text style={styles.addButtonText}>ADD</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity style={styles.quantityButton} onPress={handleDecrement}>
                                <MaterialCommunityIcons name="minus" size={14} color={COLORS.white} />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{quantity}</Text>
                            <TouchableOpacity style={styles.quantityButton} onPress={handleIncrement}>
                                <MaterialCommunityIcons name="plus" size={14} color={COLORS.white} />
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
        width: 155,
        backgroundColor: COLORS.white,
        borderRadius: 16,
        marginRight: 12,
        marginBottom: 12,
        ...SHADOWS.light,
        overflow: 'hidden',
    },
    compactContainer: {
        width: 130,
    },
    largeContainer: {
        width: 175,
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        zIndex: 1,
    },
    discountText: {
        color: COLORS.secondary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    imageContainer: {
        height: 115,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAFAFA',
        position: 'relative',
    },
    largeImageContainer: {
        height: 140,
    },
    image: {
        width: '90%',
        height: '90%',
    },
    largeImage: {
        width: '95%',
        height: '95%',
    },
    quickAddButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.medium,
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 10,
        gap: 4,
    },
    deliveryText: {
        fontSize: 9,
        color: COLORS.secondary,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    details: {
        padding: 12,
        paddingTop: 6,
    },
    name: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.text,
        lineHeight: 18,
        minHeight: 36,
    },
    compactName: {
        fontSize: 12,
        minHeight: 32,
    },
    unit: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
        fontWeight: '500',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    largePrice: {
        fontSize: 16,
    },
    originalPrice: {
        fontSize: 11,
        color: COLORS.textSecondary,
        textDecorationLine: 'line-through',
    },
    addButton: {
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.secondary,
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 7,
    },
    addButtonText: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        borderRadius: 8,
        overflow: 'hidden',
    },
    quantityButton: {
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    quantityText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '800',
        paddingHorizontal: 6,
        minWidth: 24,
        textAlign: 'center',
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outOfStockText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.error,
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
});

export default ProductCard;
