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
import {
    Delete02Icon,
    DeliveryTruck01Icon,
    Ticket01Icon,
    InformationCircleIcon,
    FlashIcon,
    ArrowRight01Icon,
    GiftIcon,
} from 'hugeicons-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../store/slices/cartSlice';
import { Header, CartItem, EmptyState } from '../components';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const CartScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { items, totalAmount, totalItems } = useSelector((state) => state.cart);
    const { currentLanguage } = useTranslation();
    const isHi = currentLanguage === 'hi';

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

    const headerTitle = isHi ? 'आपकी कार्ट' : 'My Cart';
    const headerSubtitle = isHi ? `${totalItems} सामान` : `${totalItems} items`;

    if (items.length === 0) {
        return (
            <View style={styles.container}>
                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
                <Header title={headerTitle} showBack onBackPress={handleBackPress} />
                <EmptyState
                    type="cart"
                    onAction={handleContinueShopping}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            <Header
                title={headerTitle}
                subtitle={headerSubtitle}
                showBack
                onBackPress={handleBackPress}
                rightComponent={
                    <TouchableOpacity onPress={handleClearCart} style={styles.clearButton} activeOpacity={0.75}>
                        <Delete02Icon size={18} color="#DC2626" strokeWidth={2} />
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
                                    <DeliveryTruck01Icon size={20} color="#6C3CF4" strokeWidth={2} />
                                    <Text style={styles.freeDeliveryText}>
                                        {isHi ? (
                                            <>मुफ़्त डिलीवरी के लिए <Text style={styles.freeDeliveryAmount}>₹{amountForFreeDelivery}</Text> का और सामान जोड़ें</>
                                        ) : (
                                            <>Add <Text style={styles.freeDeliveryAmount}>₹{amountForFreeDelivery}</Text> more for FREE delivery</>
                                        )}
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
                        <TouchableOpacity style={styles.couponSection} activeOpacity={0.85}>
                            <View style={styles.couponLeft}>
                                <View style={styles.couponIcon}>
                                    <Ticket01Icon size={20} color="#6C3CF4" strokeWidth={2} />
                                </View>
                                <View>
                                    <Text style={styles.couponText}>{isHi ? 'कूपन लागू करें' : 'Apply Coupon'}</Text>
                                    <Text style={styles.couponSubtext}>{isHi ? 'अतिरिक्त छूट पाएं' : 'Save extra on your order'}</Text>
                                </View>
                            </View>
                            <ArrowRight01Icon size={18} color={COLORS.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>

                        {/* Bill Details */}
                        <View style={styles.billSection}>
                            <Text style={styles.billTitle}>{isHi ? 'बिल विवरण' : 'Bill Details'}</Text>

                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>{isHi ? 'सामान का कुल मूल्य' : 'Item Total'}</Text>
                                <Text style={styles.billValue}>₹{totalAmount}</Text>
                            </View>

                            <View style={styles.billRow}>
                                <View style={styles.billLabelRow}>
                                    <Text style={styles.billLabel}>{isHi ? 'डिलीवरी शुल्क' : 'Delivery Fee'}</Text>
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
                                    <Text style={styles.billLabel}>{isHi ? 'पैकिंग शुल्क' : 'Packaging Fee'}</Text>
                                    <InformationCircleIcon size={14} color={COLORS.textLight} style={{ marginLeft: 4 }} strokeWidth={2} />
                                </View>
                                <Text style={styles.billValue}>₹{packagingFee}</Text>
                            </View>

                            <View style={styles.billRow}>
                                <Text style={[styles.billLabel, styles.discountLabel]}>{isHi ? 'छूट लागू' : 'Discount Applied'}</Text>
                                <Text style={[styles.billValue, styles.discountValue]}>-₹{discount}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.billRow}>
                                <Text style={styles.totalLabel}>{isHi ? 'कुल राशि' : 'Grand Total'}</Text>
                                <Text style={styles.totalValue}>₹{grandTotal}</Text>
                            </View>
                        </View>

                        {/* Savings Banner */}
                        {discount > 0 && (
                            <View style={styles.savingsBanner}>
                                <GiftIcon size={18} color="#6C3CF4" strokeWidth={2} />
                                <Text style={styles.savingsText}>
                                    {isHi ? (
                                        <>बधाई! आप इस ऑर्डर पर <Text style={styles.savingsAmount}>₹{discount + (deliveryFee === 0 ? 25 : 0)}</Text> बचा रहे हैं!</>
                                    ) : (
                                        <>Yay! You're saving <Text style={styles.savingsAmount}>₹{discount + (deliveryFee === 0 ? 25 : 0)}</Text> on this order!</>
                                    )}
                                </Text>
                            </View>
                        )}

                        {/* Delivery Info */}
                        <View style={styles.deliveryInfo}>
                            <View style={styles.deliveryIconWrapper}>
                                <FlashIcon size={18} color="#D97706" strokeWidth={2} />
                            </View>
                            <View style={styles.deliveryTextContainer}>
                                <Text style={styles.deliveryTitle}>{isHi ? '10-15 मिनट में डिलीवरी' : 'Delivery in 10-15 mins'}</Text>
                                <Text style={styles.deliverySubtitle}>{isHi ? `${totalItems} सामान की शिपमेंट` : `Shipment of ${totalItems} items`}</Text>
                            </View>
                        </View>

                        <View style={{ height: 160 }} />
                    </>
                )}
            />

            {/* Bottom Checkout Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomInfo}>
                    <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
                    <Text style={styles.bottomTotalLabel}>{isHi ? 'कुल राशि' : 'TOTAL'}</Text>
                </View>
                <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout} activeOpacity={0.9}>
                    <Text style={styles.checkoutText}>{isHi ? 'चेकआउट की ओर बढ़ें' : 'Proceed to Checkout'}</Text>
                    <View style={styles.checkoutArrow}>
                        <ArrowRight01Icon size={16} color="#6C3CF4" strokeWidth={2.5} />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    clearButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    cartList: {
        padding: 16,
    },
    freeDeliveryBanner: {
        backgroundColor: '#F3E8FF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E9D5FF',
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
        color: '#6C3CF4',
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(108, 60, 244, 0.2)',
        borderRadius: 2,
        marginTop: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6C3CF4',
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
        backgroundColor: '#F3E8FF',
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
        backgroundColor: '#6C3CF4',
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
        color: '#6C3CF4',
    },
    discountValue: {
        color: '#6C3CF4',
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
        backgroundColor: '#F3E8FF',
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
        color: '#6C3CF4',
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
        bottom: 76,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 22,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#F3E8FF',
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
        backgroundColor: '#6C3CF4',
        paddingHorizontal: 22,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 10,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
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
