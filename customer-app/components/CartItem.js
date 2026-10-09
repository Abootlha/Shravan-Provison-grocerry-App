import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { incrementQuantity, decrementQuantity, removeFromCart } from '../store/slices/cartSlice';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const CartItem = ({ item, compact = false }) => {
    const dispatch = useDispatch();
    const { currentLanguage } = useTranslation();
    const [translatedName, setTranslatedName] = useState(item.name);

    // Translate item name when language changes
    useEffect(() => {
        const translateName = async () => {
            if (currentLanguage === 'hi') {
                try {
                    const translated = item.nameHi || await translateToHindi(item.name);
                    setTranslatedName(translated);
                } catch (err) {
                    console.error('Translation error:', err);
                    setTranslatedName(item.name);
                }
            } else {
                setTranslatedName(item.name);
            }
        };

        translateName();
    }, [currentLanguage, item.name, item.nameHi]);

    const handleIncrement = () => {
        dispatch(incrementQuantity(item.id));
    };

    const handleDecrement = () => {
        dispatch(decrementQuantity(item.id));
    };

    const handleRemove = () => {
        dispatch(removeFromCart(item.id));
    };

    const savings = item.originalPrice && item.originalPrice > item.price
        ? (item.originalPrice - item.price) * item.quantity
        : 0;

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <Image
                    source={{ uri: item.image }}
                    style={styles.compactImage}
                    resizeMode="contain"
                />
                <View style={styles.compactDetails}>
                    <Text style={styles.compactName} numberOfLines={1}>{translatedName}</Text>
                    <Text style={styles.compactUnit}>{item.unit} × {item.quantity}</Text>
                </View>
                <Text style={styles.compactPrice}>₹{item.price * item.quantity}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Product Image */}
            <View style={styles.imageWrapper}>
                <Image
                    source={{ uri: item.image }}
                    style={styles.image}
                    resizeMode="contain"
                />
                {/* Discount Badge */}
                {item.discount > 0 && (
                    <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{item.discount}%</Text>
                    </View>
                )}
            </View>

            {/* Product Details */}
            <View style={styles.details}>
                <Text style={styles.name} numberOfLines={2}>{translatedName}</Text>
                <Text style={styles.unit}>{item.unit}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.price}>₹{item.price}</Text>
                    {item.originalPrice > item.price && (
                        <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
                    )}
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                {/* Quantity Selector */}
                <View style={styles.quantityContainer}>
                    <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={handleDecrement}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name={item.quantity === 1 ? "trash-can-outline" : "minus"}
                            size={16}
                            color={item.quantity === 1 ? COLORS.error : COLORS.secondary}
                        />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={handleIncrement}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="plus" size={16} color={COLORS.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Item Total */}
                <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>

                {/* Savings */}
                {savings > 0 && (
                    <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>Save ₹{savings}</Text>
                    </View>
                )}
            </View>

            {/* Remove Button */}
            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
                <MaterialCommunityIcons name="close" size={14} color={COLORS.textLight} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        ...SHADOWS.light,
        position: 'relative',
    },
    imageWrapper: {
        position: 'relative',
    },
    image: {
        width: 75,
        height: 75,
        borderRadius: 12,
        backgroundColor: '#F8F8F8',
    },
    discountBadge: {
        position: 'absolute',
        top: -4,
        left: -4,
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
    },
    discountText: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.white,
    },
    details: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        lineHeight: 19,
    },
    unit: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 3,
        fontWeight: '500',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 6,
    },
    price: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    originalPrice: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textDecorationLine: 'line-through',
    },
    actions: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.secondary,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: COLORS.white,
    },
    quantityButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    quantityText: {
        color: COLORS.secondary,
        fontSize: 14,
        fontWeight: '800',
        paddingHorizontal: 6,
        minWidth: 28,
        textAlign: 'center',
    },
    itemTotal: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    savingsBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    savingsText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    removeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Compact variant styles
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    compactImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F8F8F8',
    },
    compactDetails: {
        flex: 1,
        marginLeft: 12,
    },
    compactName: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    compactUnit: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    compactPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
    },
});

export default CartItem;
