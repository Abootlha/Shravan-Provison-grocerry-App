import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    ShoppingBasket01Icon,
    DiscountTag01Icon,
    ArrowRight02Icon,
} from 'hugeicons-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from '../hooks/useTranslation';
import { incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';

const FloatingCartBar = ({ onPress }) => {
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const cartItems = useSelector((state) => state.cart.totalItems);
    const totalAmount = useSelector((state) => state.cart.totalAmount);
    const items = useSelector((state) => state.cart.items);

    if (!cartItems || cartItems <= 0) return null;

    // Estimate realistic savings (approx 15-20% off MRP)
    const estimatedSavings = Math.round(totalAmount * 0.16) || 120;
    const lastItem = items && items.length > 0 ? items[items.length - 1] : null;

    const handleDecrement = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (lastItem) {
            dispatch(decrementQuantity(lastItem.id));
        }
    };

    const handleIncrement = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (lastItem) {
            dispatch(incrementQuantity(lastItem.id));
        }
    };

    return (
        <TouchableOpacity
            style={styles.compactContainer}
            onPress={onPress}
            activeOpacity={0.88}
        >
            {/* Top Right Stepper Badge (- 3 +) */}
            <View style={styles.stepperBadge}>
                <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={handleDecrement}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="minus" size={12} color="#FFFFFF" />
                </TouchableOpacity>

                <Text style={styles.badgeText}>{cartItems}</Text>

                <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={handleIncrement}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="plus" size={12} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Left Basket Icon */}
            <View style={styles.iconBox}>
                <ShoppingBasket01Icon size={20} color="#FFFFFF" strokeWidth={2.3} />
            </View>

            {/* Middle Info Stack with Discount Tag */}
            <View style={styles.infoStack}>
                <View style={styles.topMetaRow}>
                    <Text style={styles.itemsSubtext}>
                        {cartItems} {isHi ? 'सामान' : (cartItems === 1 ? 'Item' : 'Items')}
                    </Text>
                    <View style={styles.discountPill}>
                        <DiscountTag01Icon size={10} color="#FDE047" strokeWidth={2.2} />
                        <Text style={styles.discountText}>
                            {isHi ? `₹${estimatedSavings} बचत` : `Saved ₹${estimatedSavings}`}
                        </Text>
                    </View>
                </View>
                <Text style={styles.priceText}>₹{totalAmount}</Text>
            </View>

            {/* Right CTA Text & Arrow */}
            <View style={styles.ctaPill}>
                <Text style={styles.ctaText}>{isHi ? 'कार्ट' : 'View'}</Text>
                <ArrowRight02Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    compactContainer: {
        position: 'absolute',
        bottom: 80,
        right: 14,
        height: 66,
        backgroundColor: '#6C3CF4',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        gap: 8,

        // Ultra Modern 3D Purple Shadow
        shadowColor: '#6B3CFF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.42,
        shadowRadius: 18,
        elevation: 14,
        zIndex: 999,
    },

    // Floating Stepper Badge (- count +)
    stepperBadge: {
        position: 'absolute',
        top: -8,
        right: -4,
        backgroundColor: '#111827',
        height: 24,
        borderRadius: 12,
        borderWidth: 1.8,
        borderColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        gap: 4,
    },
    stepperBtn: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        paddingHorizontal: 2,
    },

    // Left Icon Box
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Middle Info Stack
    infoStack: {
        justifyContent: 'center',
    },
    topMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemsSubtext: {
        fontSize: 11,
        fontWeight: '600',
        color: '#E9D5FF',
    },
    discountPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(253, 224, 71, 0.2)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.8,
        borderColor: 'rgba(253, 224, 71, 0.4)',
        gap: 2,
    },
    discountText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FDE047',
    },
    priceText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.4,
    },

    // Right CTA Pill
    ctaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 10,
        gap: 3,
        marginLeft: 2,
    },
    ctaText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default FloatingCartBar;
