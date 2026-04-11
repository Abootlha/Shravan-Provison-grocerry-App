import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { Header } from '../components';
import { COLORS, SHADOWS } from '../constants';
import { UserService, OrderService } from '../services';
import { setSavedAddresses, setSelectedAddress } from '../store/slices/locationSlice';
import { clearCart } from '../store/slices/cartSlice';

const CheckoutScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { totalAmount, totalItems, items: cartItems } = useSelector((state) => state.cart);
    const { savedAddresses, selectedAddress } = useSelector((state) => state.location);
    const [selectedPayment, setSelectedPayment] = useState('cod');
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);

    const deliveryFee = totalAmount >= 200 ? 0 : 25;
    const packagingFee = 5;
    const discount = Math.round(totalAmount * 0.05);
    const grandTotal = totalAmount + deliveryFee + packagingFee - discount;

    // Fetch saved addresses from backend on mount
    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        setIsFetchingAddresses(true);
        try {
            const profile = await UserService.getProfile();
            if (profile?.addresses && profile.addresses.length > 0) {
                const formattedAddresses = profile.addresses.map((addr, index) => ({
                    id: `saved-${index}`,
                    type: addr.type,
                    address: addr.address,
                    city: addr.city,
                    pincode: addr.pincode,
                    isDefault: addr.isDefault,
                    latitude: addr.latitude,
                    longitude: addr.longitude,
                }));
                dispatch(setSavedAddresses(formattedAddresses));

                // Auto-select default address if none selected
                if (!selectedAddress) {
                    const defaultAddr = formattedAddresses.find(a => a.isDefault) || formattedAddresses[0];
                    dispatch(setSelectedAddress(defaultAddr));
                }
            }
        } catch (error) {
            // Silently fail - addresses may already be in Redux
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    const handleSelectAddress = (addr) => {
        dispatch(setSelectedAddress(addr));
    };

    const getAddressIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'home': return 'home';
            case 'office': return 'office-building';
            case 'current location': return 'crosshairs-gps';
            default: return 'map-marker';
        }
    };

    const PAYMENT_MAP = { cod: 'COD', upi: 'UPI', card: 'CARD' };
    const mongoIdPattern = /^[a-f\d]{24}$/i;

    const handlePlaceOrder = async () => {
        if (!selectedAddress) {
            Alert.alert('No Address', 'Please select a delivery address before placing your order.');
            return;
        }
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Your cart is empty. Add items before placing an order.');
            return;
        }

        setIsPlacing(true);
        try {
            const invalidCartItem = cartItems.find((item) => {
                const productId = item.productId || item._id || item.id;
                return !productId || !mongoIdPattern.test(String(productId));
            });

            if (invalidCartItem) {
                Alert.alert(
                    'Cart needs refresh',
                    'Please remove and add this item again before placing your order.'
                );
                return;
            }

            const orderData = {
                items: cartItems.map(item => ({
                    productId: item.productId || item._id || item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    image: item.image || undefined,
                })),
                itemTotal: totalAmount,
                deliveryFee,
                packagingFee,
                discount,
                totalAmount: grandTotal,
                deliveryAddress: {
                    type: selectedAddress.type || 'Home',
                    address: selectedAddress.address,
                    city: selectedAddress.city,
                    pincode: selectedAddress.pincode,
                    latitude: selectedAddress.latitude || 0,
                    longitude: selectedAddress.longitude || 0,
                },
                paymentMethod: PAYMENT_MAP[selectedPayment] || 'COD',
                paymentStatus: selectedPayment === 'cod' ? 'PENDING' : 'COMPLETED',
            };

            const response = await OrderService.createOrder(orderData);
            const orderId = response?.order?._id || response?._id || response?.orderId;

            if (orderId) {
                dispatch(clearCart());
                navigation.replace('OrderTracking', { orderId });
            } else {
                Alert.alert('Error', 'Order created but could not get order ID. Check your orders.');
            }
        } catch (error) {
            const msg = error?.response?.data?.message;
            Alert.alert('Order Failed', Array.isArray(msg) ? msg.join('\n') : msg || 'Failed to place order. Please try again.');
        } finally {
            setIsPlacing(false);
        }
    };

    const paymentMethods = [
        { id: 'cod', name: 'Cash on Delivery', icon: 'cash' },
        { id: 'upi', name: 'UPI', icon: 'cellphone' },
        { id: 'card', name: 'Credit/Debit Card', icon: 'credit-card' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
            <Header title="Checkout" showBack onBackPress={() => navigation.goBack()} />

            <ScrollView style={styles.scrollView}>
                {/* Delivery Banner */}
                <View style={styles.deliveryBanner}>
                    <MaterialCommunityIcons name="clock-fast" size={24} color={COLORS.secondary} />
                    <Text style={styles.deliveryText}>Delivery in 10-15 mins</Text>
                </View>

                {/* Addresses */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Delivery Address</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Location')}>
                            <Text style={styles.changeLink}>Change</Text>
                        </TouchableOpacity>
                    </View>

                    {isFetchingAddresses ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={COLORS.secondary} />
                        </View>
                    ) : savedAddresses.length > 0 ? (
                        savedAddresses.map((addr) => (
                            <TouchableOpacity
                                key={addr.id}
                                style={[styles.card, selectedAddress?.id === addr.id && styles.cardSelected]}
                                onPress={() => handleSelectAddress(addr)}
                            >
                                <MaterialCommunityIcons name={getAddressIcon(addr.type)} size={22} color={COLORS.secondary} />
                                <View style={styles.cardText}>
                                    <Text style={styles.cardTitle}>{addr.type}</Text>
                                    <Text style={styles.cardSubtitle}>{addr.address}, {addr.city} - {addr.pincode}</Text>
                                </View>
                                <View style={[styles.radio, selectedAddress?.id === addr.id && styles.radioSelected]}>
                                    {selectedAddress?.id === addr.id && <View style={styles.radioInner} />}
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <TouchableOpacity
                            style={styles.addAddressBtn}
                            onPress={() => navigation.navigate('Location')}
                        >
                            <MaterialCommunityIcons name="plus-circle-outline" size={22} color={COLORS.secondary} />
                            <Text style={styles.addAddressText}>Add Delivery Address</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Payment Methods */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Method</Text>
                    {paymentMethods.map((method) => (
                        <TouchableOpacity
                            key={method.id}
                            style={[styles.card, selectedPayment === method.id && styles.cardSelected]}
                            onPress={() => setSelectedPayment(method.id)}
                        >
                            <MaterialCommunityIcons name={method.icon} size={22} color={COLORS.secondary} />
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>{method.name}</Text>
                            </View>
                            <View style={[styles.radio, selectedPayment === method.id && styles.radioSelected]}>
                                {selectedPayment === method.id && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.row}><Text style={styles.label}>Items ({totalItems})</Text><Text style={styles.value}>₹{totalAmount}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Delivery</Text><Text style={styles.value}>{deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}</Text></View>
                    <View style={styles.row}><Text style={styles.label}>Packaging</Text><Text style={styles.value}>₹{packagingFee}</Text></View>
                    <View style={styles.row}><Text style={[styles.label, { color: COLORS.secondary }]}>Discount</Text><Text style={[styles.value, { color: COLORS.secondary }]}>-₹{discount}</Text></View>
                    <View style={styles.divider} />
                    <View style={styles.row}><Text style={styles.total}>Total</Text><Text style={styles.total}>₹{grandTotal}</Text></View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <View>
                    <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
                    <Text style={styles.bottomLabel}>Total Amount</Text>
                </View>
                <TouchableOpacity
                    style={[styles.placeBtn, isPlacing && styles.placeBtnDisabled]}
                    onPress={handlePlaceOrder}
                    disabled={isPlacing}
                >
                    {isPlacing ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.placeBtnText}>Place Order</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    deliveryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', margin: 16, padding: 16, borderRadius: 12 },
    deliveryText: { fontSize: 15, fontWeight: '700', color: COLORS.secondary, marginLeft: 12 },
    section: { backgroundColor: COLORS.white, padding: 16, marginHorizontal: 16, marginTop: 8, borderRadius: 12, ...SHADOWS.light },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    changeLink: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
    card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 10 },
    cardSelected: { borderColor: COLORS.secondary, backgroundColor: '#FAFFF5' },
    cardText: { flex: 1, marginLeft: 12 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    cardSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: COLORS.secondary },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.secondary },
    loadingContainer: { padding: 20, alignItems: 'center' },
    addAddressBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 10, borderStyle: 'dashed', gap: 8 },
    addAddressText: { fontSize: 14, fontWeight: '600', color: COLORS.secondary },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    label: { fontSize: 14, color: COLORS.textSecondary },
    value: { fontSize: 14, fontWeight: '500', color: COLORS.text },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
    total: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOWS.medium },
    bottomTotal: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    bottomLabel: { fontSize: 12, color: COLORS.textSecondary },
    placeBtn: { backgroundColor: COLORS.secondary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, minWidth: 140, alignItems: 'center' },
    placeBtnDisabled: { opacity: 0.7 },
    placeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default CheckoutScreen;
