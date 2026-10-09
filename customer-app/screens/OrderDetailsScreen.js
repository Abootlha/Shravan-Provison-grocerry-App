import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header } from '../components';
import { COLORS, SHADOWS } from '../constants';
import { OrderService, SettingsService } from '../services';

const currency = (value) => `₹${Number(value || 0).toFixed(2)}`;

const OrderDetailsScreen = ({ navigation, route }) => {
    const { orderId } = route.params || {};
    const [order, setOrder] = useState(null);
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const [orderResponse, storeResponse] = await Promise.all([
                    OrderService.getOrderById(orderId),
                    SettingsService.getStoreSettings(),
                ]);

                if (!active) return;
                setOrder(orderResponse?.order || orderResponse || null);
                setStore(storeResponse?.settings || storeResponse || null);
            } catch (error) {
                if (active) {
                    setOrder(null);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        if (orderId) {
            load();
        } else {
            setLoading(false);
        }

        return () => {
            active = false;
        };
    }, [orderId]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <Header title="Order Details" showBack onBackPress={() => navigation.goBack()} />
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <Header title="Order Details" showBack onBackPress={() => navigation.goBack()} />
                <View style={styles.loadingState}>
                    <Text style={styles.emptyText}>Unable to load order details.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const itemTotal = order.itemTotal ?? order.items?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0) ?? 0;
    const deliveryFee = order.deliveryFee ?? 0;
    const packagingFee = order.packagingFee ?? 0;
    const discount = order.discount ?? 0;
    const totalAmount = order.totalAmount ?? itemTotal + deliveryFee + packagingFee - discount;
    const gstAmount = Number((itemTotal * 0.05).toFixed(2));

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
            <Header
                title="Order Details"
                subtitle={order.orderId}
                showBack
                onBackPress={() => navigation.goBack()}
            />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <View>
                            <Text style={styles.sectionTitle}>Invoice</Text>
                            <Text style={styles.orderId}>{order.orderId}</Text>
                        </View>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{order.orderStatus}</Text>
                        </View>
                    </View>
                    <Text style={styles.metaText}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Order time unavailable'}
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Store Details</Text>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="storefront-outline" size={18} color={COLORS.secondary} />
                        <View style={styles.infoTextWrap}>
                            <Text style={styles.infoPrimary}>{store?.storeName || 'Shravan Kirana Store'}</Text>
                            <Text style={styles.infoSecondary}>{store?.location?.address || 'Store address unavailable'}</Text>
                            {store?.contactPhone ? <Text style={styles.infoSecondary}>{store.contactPhone}</Text> : null}
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={18} color={COLORS.secondary} />
                        <View style={styles.infoTextWrap}>
                            <Text style={styles.infoPrimary}>{order.userId?.name || 'Customer'}</Text>
                            <Text style={styles.infoSecondary}>
                                {order.deliveryAddress?.address}, {order.deliveryAddress?.city} - {order.deliveryAddress?.pincode}
                            </Text>
                            {order.userId?.phone ? <Text style={styles.infoSecondary}>{order.userId.phone}</Text> : null}
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Items Ordered</Text>
                    {order.items?.map((item, index) => (
                        <View key={`${item.productId || item.name}-${index}`} style={[styles.itemRow, index < order.items.length - 1 && styles.itemBorder]}>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
                            </View>
                            <Text style={styles.itemPrice}>{currency((item.price || 0) * (item.quantity || 0))}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Price Breakdown</Text>
                    <View style={styles.priceRow}><Text style={styles.priceLabel}>Items Total</Text><Text style={styles.priceValue}>{currency(itemTotal)}</Text></View>
                    <View style={styles.priceRow}><Text style={styles.priceLabel}>Delivery Fee</Text><Text style={styles.priceValue}>{currency(deliveryFee)}</Text></View>
                    <View style={styles.priceRow}><Text style={styles.priceLabel}>Packaging Fee</Text><Text style={styles.priceValue}>{currency(packagingFee)}</Text></View>
                    <View style={styles.priceRow}><Text style={styles.priceLabel}>Estimated GST</Text><Text style={styles.priceValue}>{currency(gstAmount)}</Text></View>
                    <View style={styles.priceRow}><Text style={styles.priceLabel}>Discount</Text><Text style={[styles.priceValue, styles.discount]}>{`- ${currency(discount)}`}</Text></View>
                    <View style={styles.divider} />
                    <View style={styles.priceRow}><Text style={styles.totalLabel}>Grand Total</Text><Text style={styles.totalValue}>{currency(totalAmount)}</Text></View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
        gap: 14,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: 15,
        fontWeight: '600',
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        ...SHADOWS.light,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 8,
    },
    orderId: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.secondary,
    },
    statusBadge: {
        backgroundColor: '#EEF6FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: '#2563EB',
        fontSize: 12,
        fontWeight: '700',
    },
    metaText: {
        marginTop: 8,
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    infoPrimary: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '700',
    },
    infoSecondary: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 4,
        lineHeight: 19,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    itemInfo: {
        flex: 1,
        paddingRight: 16,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    itemMeta: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 3,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    priceValue: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '600',
    },
    discount: {
        color: COLORS.secondary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
    },
});

export default OrderDetailsScreen;
