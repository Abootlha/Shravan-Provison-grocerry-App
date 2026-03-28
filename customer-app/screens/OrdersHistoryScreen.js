import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Header, EmptyState } from '../components';
import { COLORS, SHADOWS } from '../constants';
import { OrderService } from '../services';

const OrdersHistoryScreen = ({ navigation }) => {
    const { user } = useSelector((state) => state.auth);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadOrders = async () => {
            try {
                if (!user?.id) {
                    setOrders([]);
                    return;
                }

                const response = await OrderService.getOrders(user.id);
                if (!active) return;

                const normalized = Array.isArray(response) ? response : response.orders || [];
                setOrders(normalized);
            } catch (error) {
                console.error('Failed to load order history:', error);
                if (active) {
                    setOrders([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadOrders();
        return () => {
            active = false;
        };
    }, [user?.id]);

    const handleBackPress = () => {
        navigation.goBack();
    };

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'DELIVERED':
                return { bg: '#E8F5E9', text: COLORS.secondary };
            case 'OUT_FOR_DELIVERY':
                return { bg: '#E3F2FD', text: '#1976D2' };
            case 'PACKED':
            case 'CONFIRMED':
            case 'PENDING':
                return { bg: '#FFF3E0', text: '#FF9800' };
            case 'CANCELLED':
                return { bg: '#FFEBEE', text: COLORS.error };
            default:
                return { bg: COLORS.lightGray, text: COLORS.textSecondary };
        }
    };

    const renderOrder = ({ item }) => {
        const statusColor = getStatusColor(item.orderStatus);
        const itemCount = item.items?.reduce((sum, entry) => sum + (entry.quantity || 0), 0) || 0;
        const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
        const deliveryTime = item.estimatedDeliveryTime
            ? new Date(item.estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '--';

        return (
            <TouchableOpacity style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderNumber}>{item.orderId}</Text>
                        <Text style={styles.orderDate}>{date}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                        <Text style={[styles.statusText, { color: statusColor.text }]}>
                            {item.orderStatus}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.orderDetails}>
                    <View style={styles.detailItem}>
                        <MaterialCommunityIcons
                            name="package-variant"
                            size={18}
                            color={COLORS.textSecondary}
                        />
                        <Text style={styles.detailText}>{itemCount} items</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MaterialCommunityIcons
                            name="clock-outline"
                            size={18}
                            color={COLORS.textSecondary}
                        />
                        <Text style={styles.detailText}>{deliveryTime}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MaterialCommunityIcons
                            name="currency-inr"
                            size={18}
                            color={COLORS.textSecondary}
                        />
                        <Text style={styles.detailText}>₹{item.totalAmount}</Text>
                    </View>
                </View>

                <View style={styles.orderActions}>
                    <TouchableOpacity style={styles.reorderButton}>
                        <MaterialCommunityIcons
                            name="refresh"
                            size={18}
                            color={COLORS.secondary}
                        />
                        <Text style={styles.reorderText}>Reorder</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.detailsButton}>
                        <Text style={styles.detailsText}>View Details</Text>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={18}
                            color={COLORS.secondary}
                        />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            <Header
                title="My Orders"
                showBack
                onBackPress={handleBackPress}
            />

            {loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                </View>
            ) : orders.length > 0 ? (
                <FlatList
                    data={orders}
                    renderItem={renderOrder}
                    keyExtractor={(item) => item.id || item.orderId}
                    contentContainerStyle={styles.ordersList}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <EmptyState
                    icon="package-variant-closed"
                    title="No orders yet"
                    subtitle="When you place orders, they will appear here"
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    ordersList: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...SHADOWS.light,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    orderNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    orderDate: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 12,
    },
    orderDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 6,
    },
    orderActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
    },
    reorderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    reorderText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.secondary,
        marginLeft: 6,
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.secondary,
    },
});

export default OrdersHistoryScreen;
