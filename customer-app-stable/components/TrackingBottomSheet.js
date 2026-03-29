import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    TouchableOpacity,
    Linking,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SNAP_POINTS = {
    collapsed: SCREEN_HEIGHT * 0.42,  // Shows rider + ETA
    mid: SCREEN_HEIGHT * 0.55,       // Shows status
    expanded: SCREEN_HEIGHT * 0.80,   // Shows everything
};

const STATUS_STEPS = [
    { key: 'PENDING', label: 'Placed', icon: 'check-circle', activeColor: '#0C831F' },
    { key: 'CONFIRMED', label: 'Confirmed', icon: 'store-check', activeColor: '#0C831F' },
    { key: 'PACKED', label: 'Packed', icon: 'package-variant', activeColor: '#0C831F' },
    { key: 'ASSIGNED', label: 'Assigned', icon: 'account-check', activeColor: '#0C831F' },
    { key: 'OUT_FOR_DELIVERY', label: 'On the way', icon: 'bike-fast', activeColor: '#0C831F' },
    { key: 'DELIVERED', label: 'Delivered', icon: 'home-check', activeColor: '#4CAF50' },
];

const TrackingBottomSheet = ({
    order,
    riderLocation,
    routeInfo,
    connectionStatus,
    onCallRider,
}) => {
    const translateY = useRef(new Animated.Value(SNAP_POINTS.collapsed)).current;
    const lastSnap = useRef(SNAP_POINTS.collapsed);
    const [etaCountdown, setEtaCountdown] = useState(null);

    // ETA countdown timer
    useEffect(() => {
        if (!order?.estimatedDeliveryTime) {
            setEtaCountdown(null);
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const eta = new Date(order.estimatedDeliveryTime);
            const diffMs = eta - now;
            const diffMins = Math.max(0, Math.ceil(diffMs / 60000));
            setEtaCountdown(diffMins);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, [order?.estimatedDeliveryTime]);

    // Pan responder for drag gesture
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
            onPanResponderMove: (_, gesture) => {
                const newVal = lastSnap.current - gesture.dy;
                const clamped = Math.max(
                    SNAP_POINTS.collapsed,
                    Math.min(SNAP_POINTS.expanded, newVal)
                );
                translateY.setValue(clamped);
            },
            onPanResponderRelease: (_, gesture) => {
                const currentVal = lastSnap.current - gesture.dy;
                let targetSnap;

                if (gesture.vy > 0.5) {
                    // Swiping down fast
                    targetSnap = SNAP_POINTS.collapsed;
                } else if (gesture.vy < -0.5) {
                    // Swiping up fast
                    targetSnap = SNAP_POINTS.expanded;
                } else {
                    // Find closest snap point
                    const snapValues = Object.values(SNAP_POINTS);
                    targetSnap = snapValues.reduce((prev, curr) =>
                        Math.abs(curr - currentVal) < Math.abs(prev - currentVal)
                            ? curr
                            : prev
                    );
                }

                lastSnap.current = targetSnap;
                Animated.spring(translateY, {
                    toValue: targetSnap,
                    useNativeDriver: false,
                    damping: 25,
                    stiffness: 200,
                }).start();
            },
        })
    ).current;

    const getCurrentStepIndex = () => {
        if (!order) return 0;
        return STATUS_STEPS.findIndex((step) => step.key === order.orderStatus);
    };

    const currentStepIndex = getCurrentStepIndex();

    const handleCallRider = () => {
        const phone = typeof order?.riderId === 'object' ? order.riderId.phone : null;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    const getRiderName = () => {
        if (typeof order?.riderId === 'object' && order.riderId?.name) {
            return order.riderId.name;
        }
        return 'Delivery Partner';
    };

    const getRiderPhone = () => {
        if (typeof order?.riderId === 'object' && order.riderId?.phone) {
            return order.riderId.phone;
        }
        return null;
    };

    const getStatusMessage = () => {
        if (!order) return 'Loading...';
        switch (order.orderStatus) {
            case 'PENDING': return 'Waiting for store to confirm your order';
            case 'CONFIRMED': return 'Store is preparing your order';
            case 'PACKED': return 'Your order is packed and ready!';
            case 'ASSIGNED': return `${getRiderName()} will pick up your order`;
            case 'OUT_FOR_DELIVERY': return `${getRiderName()} is on the way!`;
            case 'DELIVERED': return 'Your order has been delivered! 🎉';
            case 'CANCELLED': return 'Order was cancelled';
            default: return 'Processing your order';
        }
    };

    const bottomSheetHeight = translateY.interpolate({
        inputRange: [SNAP_POINTS.collapsed, SNAP_POINTS.expanded],
        outputRange: [SNAP_POINTS.collapsed, SNAP_POINTS.expanded],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { height: bottomSheetHeight },
            ]}
        >
            {/* Drag Handle */}
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
                <View style={styles.handle} />
            </View>

            {/* Rider Card + ETA (Always visible) */}
            <View style={styles.topSection}>
                {/* ETA Banner */}
                {etaCountdown !== null && order?.orderStatus !== 'DELIVERED' && order?.orderStatus !== 'CANCELLED' && (
                    <View style={styles.etaBanner}>
                        <View style={styles.etaLeft}>
                            <Text style={styles.etaLabel}>
                                {order?.orderStatus === 'OUT_FOR_DELIVERY' ? 'Arriving in' : 'Estimated delivery'}
                            </Text>
                            <View style={styles.etaTimeRow}>
                                <Text style={styles.etaTime}>{etaCountdown}</Text>
                                <Text style={styles.etaUnit}> mins</Text>
                            </View>
                        </View>
                        <View style={styles.etaRight}>
                            {routeInfo && (
                                <View style={styles.routeInfoBadge}>
                                    <MaterialCommunityIcons name="map-marker-distance" size={14} color={COLORS.secondary} />
                                    <Text style={styles.routeInfoText}>{routeInfo.distance}</Text>
                                </View>
                            )}
                            <View style={[
                                styles.connectionDot,
                                connectionStatus === 'connected' && styles.connectionDotOnline,
                                connectionStatus === 'reconnecting' && styles.connectionDotReconnecting,
                                connectionStatus === 'disconnected' && styles.connectionDotOffline,
                            ]} />
                        </View>
                    </View>
                )}

                {/* Delivered Card */}
                {order?.orderStatus === 'DELIVERED' && (
                    <View style={styles.deliveredBanner}>
                        <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />
                        <View style={styles.deliveredContent}>
                            <Text style={styles.deliveredTitle}>Order Delivered!</Text>
                            <Text style={styles.deliveredSubtitle}>Thank you for ordering with us</Text>
                        </View>
                    </View>
                )}

                {/* Status message */}
                <Text style={styles.statusMessage}>{getStatusMessage()}</Text>

                {/* Rider Info Card */}
                {order?.riderId && (order?.orderStatus === 'ASSIGNED' || order?.orderStatus === 'OUT_FOR_DELIVERY') && (
                    <View style={styles.riderCard}>
                        <View style={styles.riderAvatar}>
                            <MaterialCommunityIcons name="account" size={24} color={COLORS.white} />
                        </View>
                        <View style={styles.riderInfo}>
                            <Text style={styles.riderName}>{getRiderName()}</Text>
                            <Text style={styles.riderLabel}>
                                {order?.orderStatus === 'OUT_FOR_DELIVERY' ? 'Is delivering your order' : 'Picking up your order'}
                            </Text>
                        </View>
                        <View style={styles.riderActions}>
                            {getRiderPhone() && (
                                <TouchableOpacity style={styles.callBtn} onPress={handleCallRider}>
                                    <MaterialCommunityIcons name="phone" size={20} color={COLORS.secondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </View>

            {/* Horizontal Status Stepper */}
            <View style={styles.stepperContainer}>
                <View style={styles.stepperTrack}>
                    {STATUS_STEPS.map((step, index) => {
                        const isActive = index <= currentStepIndex;
                        const isCurrent = index === currentStepIndex;
                        return (
                            <React.Fragment key={step.key}>
                                {index > 0 && (
                                    <View
                                        style={[
                                            styles.stepperLine,
                                            isActive && styles.stepperLineActive,
                                        ]}
                                    />
                                )}
                                <View style={styles.stepperItem}>
                                    <View
                                        style={[
                                            styles.stepperDot,
                                            isActive && { backgroundColor: step.activeColor },
                                            isCurrent && styles.stepperDotCurrent,
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name={step.icon}
                                            size={14}
                                            color={isActive ? COLORS.white : '#CCC'}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.stepperLabel,
                                            isActive && styles.stepperLabelActive,
                                            isCurrent && styles.stepperLabelCurrent,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {step.label}
                                    </Text>
                                </View>
                            </React.Fragment>
                        );
                    })}
                </View>
            </View>

            {/* Order Details (visible when expanded) */}
            <View style={styles.detailsSection}>
                <View style={styles.detailsDivider} />

                {/* Order Summary */}
                <View style={styles.orderSummary}>
                    <View style={styles.summaryHeader}>
                        <Text style={styles.summaryTitle}>Order Details</Text>
                        <Text style={styles.summaryOrderId}>
                            {order?.orderId || `#${order?._id?.slice(-8).toUpperCase()}`}
                        </Text>
                    </View>

                    {/* Items */}
                    {order?.items?.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                            <View style={styles.itemQtyBadge}>
                                <Text style={styles.itemQtyText}>{item.quantity}x</Text>
                            </View>
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                        </View>
                    ))}

                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalValue}>₹{order?.totalAmount}</Text>
                    </View>
                </View>

                {/* Delivery Address */}
                {order?.deliveryAddress && (
                    <View style={styles.addressSection}>
                        <View style={styles.addressHeader}>
                            <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.secondary} />
                            <Text style={styles.addressTitle}>Delivery Address</Text>
                        </View>
                        <Text style={styles.addressText}>
                            {order.deliveryAddress.address}
                        </Text>
                        <Text style={styles.addressCity}>
                            {order.deliveryAddress.city}, {order.deliveryAddress.pincode}
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...SHADOWS.dark,
        overflow: 'hidden',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#DDD',
    },

    // Top section
    topSection: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },

    // ETA Banner
    etaBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    etaLeft: {},
    etaLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    etaTimeRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    etaTime: {
        fontSize: 36,
        fontWeight: '800',
        color: COLORS.secondary,
    },
    etaUnit: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    etaRight: {
        alignItems: 'flex-end',
        gap: 8,
    },
    routeInfoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.white,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
    },
    routeInfoText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#CCC',
    },
    connectionDotOnline: {
        backgroundColor: '#4CAF50',
    },
    connectionDotReconnecting: {
        backgroundColor: '#FF9800',
    },
    connectionDotOffline: {
        backgroundColor: '#F44336',
    },

    // Delivered
    deliveredBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        gap: 12,
    },
    deliveredContent: {
        flex: 1,
    },
    deliveredTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2E7D32',
    },
    deliveredSubtitle: {
        fontSize: 13,
        color: '#66BB6A',
        marginTop: 2,
    },

    // Status message
    statusMessage: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        marginBottom: 12,
    },

    // Rider Card
    riderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    riderAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    riderInfo: {
        flex: 1,
        marginLeft: 12,
    },
    riderName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    riderLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    riderActions: {
        flexDirection: 'row',
        gap: 8,
    },
    callBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Horizontal Status Stepper
    stepperContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    stepperTrack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepperLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E0E0E0',
        marginHorizontal: -2,
    },
    stepperLineActive: {
        backgroundColor: COLORS.secondary,
    },
    stepperItem: {
        alignItems: 'center',
        width: 46,
    },
    stepperDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E8E8E8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperDotCurrent: {
        borderWidth: 2,
        borderColor: COLORS.secondary,
        transform: [{ scale: 1.15 }],
    },
    stepperLabel: {
        fontSize: 9,
        color: '#BBB',
        marginTop: 4,
        fontWeight: '500',
        textAlign: 'center',
    },
    stepperLabelActive: {
        color: '#666',
    },
    stepperLabelCurrent: {
        color: COLORS.secondary,
        fontWeight: '700',
    },

    // Details section
    detailsSection: {
        paddingHorizontal: 20,
        flex: 1,
    },
    detailsDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginBottom: 16,
    },

    // Order Summary
    orderSummary: {
        marginBottom: 16,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    summaryOrderId: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 10,
    },
    itemQtyBadge: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemQtyText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.secondary,
    },
    itemName: {
        flex: 1,
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 12,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.secondary,
    },

    // Address section
    addressSection: {
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    addressTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    addressText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
        marginLeft: 24,
    },
    addressCity: {
        fontSize: 12,
        color: '#999',
        marginLeft: 24,
        marginTop: 2,
    },
});

export default TrackingBottomSheet;
