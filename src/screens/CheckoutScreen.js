import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Header } from '../components';
import { COLORS, SHADOWS } from '../constants';

const CheckoutScreen = ({ navigation }) => {
    const { totalAmount, totalItems } = useSelector((state) => state.cart);
    const [selectedAddress, setSelectedAddress] = useState(0);
    const [selectedPayment, setSelectedPayment] = useState('cod');

    const deliveryFee = totalAmount >= 200 ? 0 : 25;
    const packagingFee = 5;
    const discount = Math.round(totalAmount * 0.05);
    const grandTotal = totalAmount + deliveryFee + packagingFee - discount;

    const addresses = [
        { id: 0, type: 'Home', address: '123, Main Street, City - 110001', icon: 'home' },
        { id: 1, type: 'Office', address: '456, Business Park, City - 110002', icon: 'office-building' },
    ];

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
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    {addresses.map((addr) => (
                        <TouchableOpacity
                            key={addr.id}
                            style={[styles.card, selectedAddress === addr.id && styles.cardSelected]}
                            onPress={() => setSelectedAddress(addr.id)}
                        >
                            <MaterialCommunityIcons name={addr.icon} size={22} color={COLORS.secondary} />
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>{addr.type}</Text>
                                <Text style={styles.cardSubtitle}>{addr.address}</Text>
                            </View>
                            <View style={[styles.radio, selectedAddress === addr.id && styles.radioSelected]}>
                                {selectedAddress === addr.id && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                    ))}
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
                <TouchableOpacity style={styles.placeBtn} onPress={() => navigation.navigate('OrderTracking')}>
                    <Text style={styles.placeBtnText}>Place Order</Text>
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
    sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 10 },
    cardSelected: { borderColor: COLORS.secondary, backgroundColor: '#FAFFF5' },
    cardText: { flex: 1, marginLeft: 12 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    cardSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: COLORS.secondary },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.secondary },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    label: { fontSize: 14, color: COLORS.textSecondary },
    value: { fontSize: 14, fontWeight: '500', color: COLORS.text },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
    total: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, ...SHADOWS.medium },
    bottomTotal: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    bottomLabel: { fontSize: 12, color: COLORS.textSecondary },
    placeBtn: { backgroundColor: COLORS.secondary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
    placeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default CheckoutScreen;
