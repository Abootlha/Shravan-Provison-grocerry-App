import React from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header, EmptyState } from '../components';
import { COLORS, SHADOWS } from '../constants';

// Mock orders data
const ORDERS = [
    {
        id: '1',
        orderNumber: 'ORD-2024-001',
        date: '30 Dec, 2024',
        status: 'Delivered',
        items: 5,
        total: 350,
        deliveryTime: '12:30 PM',
    },
    {
        id: '2',
        orderNumber: 'ORD-2024-002',
        date: '28 Dec, 2024',
        status: 'Delivered',
        items: 3,
        total: 180,
        deliveryTime: '6:45 PM',
    },
    {
        id: '3',
        orderNumber: 'ORD-2024-003',
        date: '25 Dec, 2024',
        status: 'Delivered',
        items: 8,
        total: 620,
        deliveryTime: '10:15 AM',
    },
];

const OrdersHistoryScreen = ({ navigation }) => {
    const handleBackPress = () => {
        navigation.goBack();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Delivered':
                return { bg: '#E8F5E9', text: COLORS.secondary };
            case 'In Transit':
                return { bg: '#E3F2FD', text: '#1976D2' };
            case 'Processing':
                return { bg: '#FFF3E0', text: '#FF9800' };
            case 'Cancelled':
                return { bg: '#FFEBEE', text: COLORS.error };
            default:
                return { bg: COLORS.lightGray, text: COLORS.textSecondary };
        }
    };

    const renderOrder = ({ item }) => {
        const statusColor = getStatusColor(item.status);

        return (
            <TouchableOpacity style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                        <Text style={styles.orderDate}>{item.date}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                        <Text style={[styles.statusText, { color: statusColor.text }]}>
                            {item.status}
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
                        <Text style={styles.detailText}>{item.items} items</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MaterialCommunityIcons
                            name="clock-outline"
                            size={18}
                            color={COLORS.textSecondary}
                        />
                        <Text style={styles.detailText}>{item.deliveryTime}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MaterialCommunityIcons
                            name="currency-inr"
                            size={18}
                            color={COLORS.textSecondary}
                        />
                        <Text style={styles.detailText}>₹{item.total}</Text>
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

            {ORDERS.length > 0 ? (
                <FlatList
                    data={ORDERS}
                    renderItem={renderOrder}
                    keyExtractor={(item) => item.id}
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
