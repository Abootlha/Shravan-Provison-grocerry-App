import React from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../store/slices/cartSlice';
import { Header, CartItem, EmptyState } from '../components';
import { COLORS, SHADOWS } from '../constants';

const CartScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { items, totalAmount, totalItems } = useSelector((state) => state.cart);

    const deliveryFee = totalAmount >= 199 ? 0 : 25;
    const packagingFee = 5;
    const discount = Math.round(totalAmount * 0.05);
    const grandTotal = totalAmount + deliveryFee + packagingFee - discount;
    const amountForFreeDelivery = 199 - totalAmount;

    const handleBackPress = () => navigation.goBack();
    const handleClearCart = () => dispatch(clearCart());
    const handleCheckout = () => navigation.navigate('Checkout');
    const handleContinueShopping = () => navigation.navigate('Home');

    const renderCartItem = ({ item }) => <CartItem item={item} />;

    if (items.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <Header title="Cart" showBack onBackPress={handleBackPress} />
                <EmptyState
                    type="cart"
                    onAction={handleContinueShopping}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            <Header
                title="Cart"
                subtitle={`${totalItems} items`}
                showBack
                onBackPress={handleBackPress}
                rightComponent={
                    <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                }
            />

            <FlatList
                data={items}
                renderItem={renderCartItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.cartList}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={() => (
                    <>
                        {/* Free Delivery Progress */}
                        {amountForFreeDelivery > 0 && (
                            <View style={styles.freeDeliveryBanner}>
                                <View style={styles.freeDeliveryContent}>
                                    <MaterialCommunityIcons name="truck-fast-outline" size={20} color={COLORS.secondary} />
                                    <Text style={styles.freeDeliveryText}>
                                        Add <Text style={styles.freeDeliveryAmount}>₹{amountForFreeDelivery}</Text> more for FREE delivery
                                    </Text>
                                </View>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${Math.min((totalAmount / 199) * 100, 100)}%` }]} />
                                </View>
                            </View>
                        )}
                    </>
                )}
                ListFooterComponent={() => (
                    <>
                        {/* Coupon Section */}
                        <TouchableOpacity style={styles.couponSection}>
                            <View style={styles.couponLeft}>
                                <View style={styles.couponIcon}>
                                    <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={COLORS.secondary} />
                                </View>
                                <View>
                                    <Text style={styles.couponText}>Apply Coupon</Text>
                                    <Text style={styles.couponSubtext}>Save extra on your order</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
                        </TouchableOpacity>

                        {/* Bill Details */}
                        <View style={styles.billSection}>
                            <Text style={styles.billTitle}>Bill Details</Text>

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Item Total</Text>
                                <Text style={styles.billValue}>₹{totalAmount}</Text>
                            </View>

                            <View style={styles.billRow}>
                                <View style={styles.billLabelRow}>
                                    <Text style={styles.billLabel}>Delivery Fee</Text>
                                    {deliveryFee === 0 && (
                                        <View style={styles.freeBadge}>
                                            <Text style={styles.freeText}>FREE</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.billValue, deliveryFee === 0 && styles.strikethrough]}>₹25</Text>
                            </View>

                            <View style={styles.billRow}>
                                <View style={styles.billLabelRow}>
                                    <Text style={styles.billLabel}>Packaging Fee</Text>
                                    <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.textLight} style={{ marginLeft: 4 }} />
                                </View>
                                <Text style={styles.billValue}>₹{packagingFee}</Text>
                            </View>

                            <View style={styles.billRow}>
                                <Text style={[styles.billLabel, styles.discountLabel]}>Discount Applied</Text>
                                <Text style={[styles.billValue, styles.discountValue]}>-₹{discount}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.billRow}>
                                <Text style={styles.totalLabel}>Grand Total</Text>
                                <Text style={styles.totalValue}>₹{grandTotal}</Text>
                            </View>
                        </View>

                        {/* Savings Banner */}
                        {discount > 0 && (
                            <View style={styles.savingsBanner}>
                                <MaterialCommunityIcons name="party-popper" size={18} color={COLORS.secondary} />
                                <Text style={styles.savingsText}>
                                    Yay! You're saving <Text style={styles.savingsAmount}>₹{discount + (deliveryFee === 0 ? 25 : 0)}</Text> on this order!
                                </Text>
                            </View>
                        )}

                        {/* Delivery Info */}
                        <View style={styles.deliveryInfo}>
                            <View style={styles.deliveryIconWrapper}>
                                <MaterialCommunityIcons name="lightning-bolt" size={18} color={COLORS.secondary} />
                            </View>
                            <View style={styles.deliveryTextContainer}>
                                <Text style={styles.deliveryTitle}>Delivery in 10-15 mins</Text>
                                <Text style={styles.deliverySubtitle}>Shipment of {totalItems} items</Text>
                            </View>
                        </View>

                        <View style={{ height: 120 }} />
                    </>
                )}
            />

            {/* Bottom Checkout Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomInfo}>
                    <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
                    <Text style={styles.bottomTotalLabel}>TOTAL</Text>
                </View>
                <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout} activeOpacity={0.9}>
                    <Text style={styles.checkoutText}>Proceed to Checkout</Text>
                    <View style={styles.checkoutArrow}>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.secondary} />
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    clearButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartList: {
        padding: 16,
    },
    freeDeliveryBanner: {
        backgroundColor: '#E8F5E9',
        padding: 14,
        borderRadius: 14,
        marginBottom: 16,
    },
    freeDeliveryContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    freeDeliveryText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    freeDeliveryAmount: {
        fontWeight: '800',
        color: COLORS.secondary,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(12, 131, 31, 0.2)',
        borderRadius: 2,
        marginTop: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.secondary,
        borderRadius: 2,
    },
    couponSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        padding: 14,
        borderRadius: 14,
        marginTop: 8,
        ...SHADOWS.light,
    },
    couponLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    couponIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    couponSubtext: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    billSection: {
        backgroundColor: COLORS.white,
        padding: 18,
        borderRadius: 16,
        marginTop: 16,
        ...SHADOWS.light,
    },
    billTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 18,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    billLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    billLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    billValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    strikethrough: {
        textDecorationLine: 'line-through',
        color: COLORS.textLight,
    },
    freeBadge: {
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginLeft: 8,
    },
    freeText: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.white,
    },
    discountLabel: {
        color: COLORS.secondary,
    },
    discountValue: {
        color: COLORS.secondary,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 10,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
    },
    savingsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
        gap: 10,
    },
    savingsText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    savingsAmount: {
        fontWeight: '800',
        color: COLORS.secondary,
    },
    deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 14,
        borderRadius: 14,
        marginTop: 16,
        ...SHADOWS.light,
    },
    deliveryIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deliveryTextContainer: {
        marginLeft: 12,
    },
    deliveryTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    deliverySubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
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
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        ...SHADOWS.dark,
    },
    bottomInfo: {
        flex: 1,
    },
    bottomTotal: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
    },
    bottomTotalLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 2,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    checkoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 22,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 10,
    },
    checkoutText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '700',
    },
    checkoutArrow: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CartScreen;
