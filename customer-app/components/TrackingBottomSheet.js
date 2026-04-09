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
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

const SNAP_POINTS = {
    collapsed: SCREEN_HEIGHT * 0.45,
    mid: SCREEN_HEIGHT * 0.65,
    expanded: SCREEN_HEIGHT * 0.90,
};

const STATUS_STEPS = [
    { key: 'PENDING', label: 'Placed', icon: 'clipboard-check-outline' },
    { key: 'CONFIRMED', label: 'Confirmed', icon: 'store-check' },
    { key: 'ASSIGNED', label: 'Rider accepted', icon: 'account-check' },
    { key: 'PACKED', label: 'Packed', icon: 'package-variant' },
    { key: 'PICKED_UP', label: 'Picked up', icon: 'package-variant-closed' },
    { key: 'OUT_FOR_DELIVERY', label: 'On the way', icon: 'bike-fast' },
    { key: 'ARRIVED', label: 'Arrived', icon: 'map-marker-check' },
];

const TrackingBottomSheet = ({
    order,
    riderLocation,
    routeInfo,
    connectionStatus,
    activeLeg,
}) => {
    const translateY = useRef(new Animated.Value(SNAP_POINTS.collapsed)).current;
    const lastSnap = useRef(SNAP_POINTS.collapsed);
    const [etaCountdown, setEtaCountdown] = useState(null);
    const [selectedTip, setSelectedTip] = useState(null);

    useEffect(() => {
        if (!order?.estimatedDeliveryTime) {
            setEtaCountdown(10);
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
        const interval = setInterval(updateCountdown, 30000);
        return () => clearInterval(interval);
    }, [order?.estimatedDeliveryTime]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
            onPanResponderMove: (_, gesture) => {
                const newVal = lastSnap.current - gesture.dy;
                const clamped = Math.max(SNAP_POINTS.collapsed, Math.min(SNAP_POINTS.expanded, newVal));
                translateY.setValue(clamped);
            },
            onPanResponderRelease: (_, gesture) => {
                const currentVal = lastSnap.current - gesture.dy;
                let targetSnap;
                if (gesture.vy > 0.5) targetSnap = SNAP_POINTS.collapsed;
                else if (gesture.vy < -0.5) targetSnap = SNAP_POINTS.expanded;
                else {
                    const snapValues = Object.values(SNAP_POINTS);
                    targetSnap = snapValues.reduce((prev, curr) =>
                        Math.abs(curr - currentVal) < Math.abs(prev - currentVal) ? curr : prev
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

    const getRiderName = () => {
        if (order?.rider?.name) return order.rider.name;
        if (typeof order?.riderId === 'object' && order.riderId?.name) return order.riderId.name;
        return 'Rider';
    };

    const handleCallRider = () => {
        const phone = order?.rider?.phone || (typeof order?.riderId === 'object' ? order.riderId.phone : null);
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const riderRating = order?.rider?.rating || order?.riderId?.rating || null;
    const riderRoleLabel = order?.rider?.vehicleType || order?.riderId?.vehicleType || 'Delivery Rider';
    const orderCode = order?.deliveryOtp || order?.otp || order?.orderCode || '----';
    const addressText = order?.deliveryAddress?.address || order?.deliveryAddress?.addressLine || '';

    const bottomSheetHeight = translateY.interpolate({
        inputRange: [SNAP_POINTS.collapsed, SNAP_POINTS.expanded],
        outputRange: [SNAP_POINTS.collapsed, SNAP_POINTS.expanded],
        extrapolate: 'clamp',
    });

    const hasLiveTracking = Boolean(activeLeg && ['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(order?.orderStatus));
    const hasDistanceValue = typeof routeInfo?.distanceValue === 'number' && Number.isFinite(routeInfo.distanceValue);
    const isArrived = order?.orderStatus === 'ARRIVED' || (hasDistanceValue && routeInfo.distanceValue < 100);

    const getPreTrackingMessage = useCallback(() => {
        switch (order?.orderStatus) {
            case 'PENDING':
                return {
                    title: 'Order placed successfully',
                    subtitle: 'The store will confirm your order shortly.',
                    icon: 'clipboard-check-outline',
                };
            case 'CONFIRMED':
                return {
                    title: 'Store is preparing your order',
                    subtitle: 'Live tracking will begin after a rider accepts the delivery.',
                    icon: 'store-check-outline',
                };
            default:
                return {
                    title: 'Preparing live tracking',
                    subtitle: 'We will show the rider route here as soon as delivery starts.',
                    icon: 'map-marker-path',
                };
        }
    }, [order?.orderStatus]);

    const renderArrivedBanner = () => (
        <View style={styles.arrivedBanner}>
            <View style={styles.arrivedHeader}>
                <View style={[styles.arrivedIconBox, { backgroundColor: ZEPTO_GREEN }]}>
                    <MaterialCommunityIcons name="check" size={24} color="white" />
                </View>
                <View style={styles.arrivedHeaderText}>
                    <Text style={styles.arrivedTitle}>Arrived in {etaCountdown || '28'} mins</Text>
                    <View style={styles.onTimeBadgeSmall}>
                        <MaterialCommunityIcons name="lightning-bolt" size={10} color={ZEPTO_GREEN} />
                        <Text style={styles.onTimeTextSmall}>ON TIME</Text>
                    </View>
                </View>
            </View>
            <View style={styles.chatBubble}>
                <Text style={styles.chatText}>
                    Hi! I've reached your location with your fresh order. Please collect it from the entrance.
                </Text>
                <View style={styles.chatPointer} />
            </View>
        </View>
    );

    const renderEnRouteBanner = () => (
        <View style={styles.etaBanner}>
            <View style={styles.etaHeader}>
                <View style={styles.etaLeft}>
                    <Text style={styles.etaLabel}>Arriving in</Text>
                    <View style={styles.etaTimeRow}>
                        <Text style={styles.etaTime}>{etaCountdown || '10'}</Text>
                        <Text style={styles.etaUnit}>MINS</Text>
                    </View>
                    <View style={styles.onTimeBadgeLarge}>
                        <MaterialCommunityIcons name="lightning-bolt" size={12} color={ZEPTO_GREEN} />
                        <Text style={styles.onTimeTextLarge}>ON TIME</Text>
                    </View>
                </View>
                <View style={styles.etaRight}>
                    <View style={styles.zeptoIllustration}>
                        <MaterialCommunityIcons name="bike-fast" size={40} color={ZEPTO_PURPLE} />
                    </View>
                </View>
            </View>
            <View style={styles.riderBar}>
                <View style={styles.riderAvatarSmall}>
                    <MaterialCommunityIcons name="account" size={16} color="#999" />
                </View>
                <Text style={styles.riderBarText}>
                    <Text style={{ fontWeight: '800' }}>{getRiderName()}</Text>{' '}
                    {activeLeg === 'to_store' ? 'is heading to the store' : 'is on the way to you'}
                </Text>
            </View>
        </View>
    );

    const renderPreTrackingBanner = () => {
        const message = getPreTrackingMessage();

        return (
            <View style={styles.preTrackingBanner}>
                <View style={styles.preTrackingIconBox}>
                    <MaterialCommunityIcons name={message.icon} size={24} color={ZEPTO_PURPLE} />
                </View>
                <View style={styles.preTrackingText}>
                    <Text style={styles.preTrackingTitle}>{message.title}</Text>
                    <Text style={styles.preTrackingSubtitle}>{message.subtitle}</Text>
                </View>
            </View>
        );
    };

    const getStepIndex = (status) => {
        if (status === 'PENDING') return 0;
        if (status === 'CONFIRMED') return 1;
        if (status === 'ASSIGNED') return 2;
        if (status === 'PACKED') return 3;
        if (status === 'PICKED_UP') return 4;
        if (status === 'OUT_FOR_DELIVERY') return 5;
        if (['ARRIVED', 'DELIVERED'].includes(status)) return 6;
        return -1;
    };

    const renderStepper = () => (
        <View style={styles.stepperContainer}>
            <View style={styles.stepperItems}>
                {STATUS_STEPS.map((step, index) => {
                    const isActive = index <= getStepIndex(order?.orderStatus);
                    return (
                        <View key={step.key} style={styles.stepperItem}>
                            <View style={[styles.stepperNode, isActive && { backgroundColor: ZEPTO_GREEN }]}>
                                <MaterialCommunityIcons name={step.icon} size={14} color={isActive ? "white" : "#CCC"} />
                            </View>
                            <Text style={[styles.stepperLabel, isActive && { color: "#333", fontWeight: '700' }]}>{step.label}</Text>
                        </View>
                    );
                })}
            </View>
            <View style={styles.stepperLineTrack}>
                <View style={[styles.stepperLineFill, { width: `${(Math.max(0, getStepIndex(order?.orderStatus)) / (STATUS_STEPS.length - 1)) * 100}%` }]} />
            </View>
        </View>
    );

    return (
        <Animated.View style={[styles.container, { height: bottomSheetHeight }]}>
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
                <View style={styles.handle} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.content}>
                    {/* Arrived or En Route Banner */}
                    {hasLiveTracking
                        ? (isArrived ? renderArrivedBanner() : renderEnRouteBanner())
                        : renderPreTrackingBanner()}

                    {/* Order Code Section */}
                    {order?.orderStatus !== 'DELIVERED' && (
                        <View style={styles.codeContainer}>
                            <View style={styles.codeLeft}>
                                <Text style={styles.codeLabel}>Your code</Text>
                                <Text style={styles.codeValue}>{orderCode}</Text>
                            </View>
                            <View style={styles.codeRight}>
                                <MaterialCommunityIcons name="shield-check" size={24} color={ZEPTO_PURPLE} />
                                <Text style={styles.codeSecureText}>Secure Delivery</Text>
                            </View>
                        </View>
                    )}

                    {/* Horizontal Stepper */}
                    {renderStepper()}

                    {/* Rider Info Card */}
                    <View style={styles.riderCard}>
                        <View style={styles.riderMain}>
                            <View style={styles.riderAvatarBox}>
                                <View style={styles.riderAvatar}>
                                    <MaterialCommunityIcons name="account" size={32} color="#AAA" />
                                </View>
                                <View style={styles.ratingBadge}>
                                    <MaterialCommunityIcons name="star" size={10} color="#FFB300" />
                                    <Text style={styles.ratingText}>{riderRating ? Number(riderRating).toFixed(1) : 'NA'}</Text>
                                </View>
                            </View>
                            <View style={styles.riderDetails}>
                                <Text style={styles.riderNameText}>{getRiderName()}</Text>
                                <Text style={styles.riderStatusText}>{riderRoleLabel}</Text>
                            </View>
                        </View>
                        <View style={styles.riderActions}>
                            <TouchableOpacity style={styles.riderActionBtn}>
                                <MaterialCommunityIcons name="chat-processing" size={22} color={ZEPTO_PURPLE} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.riderActionBtn, { marginLeft: 12 }]} onPress={handleCallRider}>
                                <MaterialCommunityIcons name="phone" size={22} color={ZEPTO_PURPLE} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Tip Your Shopper Section */}
                    <View style={styles.tipSection}>
                        <View style={styles.tipHeader}>
                            <Text style={styles.tipTitle}>Tip your shopper</Text>
                            <Text style={styles.tipSubtitle}>100% of your tip goes to {getRiderName()}</Text>
                        </View>
                        <View style={styles.tipButtons}>
                            {[20, 30, 50, 100].map(amount => (
                                <TouchableOpacity
                                    key={amount}
                                    style={[styles.tipBtn, selectedTip === amount && styles.tipBtnActive]}
                                    onPress={() => setSelectedTip(amount)}
                                >
                                    <Text style={[styles.tipBtnText, selectedTip === amount && styles.tipBtnTextActive]}>₹{amount}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Order Details */}
                    <View style={styles.orderDetails}>
                        <View style={styles.orderHeaderRow}>
                            <Text style={styles.orderLabel}>Order Info</Text>
                            <TouchableOpacity>
                                <Text style={styles.viewItemsText}>VIEW ITEMS</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.addressBox}>
                            <MaterialCommunityIcons name="map-marker-outline" size={18} color="#666" />
                            <Text style={styles.addressText} numberOfLines={2}>
                                {addressText || 'Delivery address unavailable'}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        ...SHADOWS.dark,
        overflow: 'hidden',
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E5E7EB',
    },
    content: {
        paddingHorizontal: 20,
    },

    // Arrived Banner
    arrivedBanner: {
        backgroundColor: '#F0FDF4',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    arrivedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    arrivedIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrivedHeaderText: {
        flex: 1,
    },
    preTrackingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 20,
        backgroundColor: '#F8F5FF',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E9DDFC',
    },
    preTrackingIconBox: {
        width: 52,
        height: 52,
        borderRadius: 18,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    preTrackingText: {
        flex: 1,
    },
    preTrackingTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#171717',
        marginBottom: 4,
    },
    preTrackingSubtitle: {
        fontSize: 13,
        lineHeight: 18,
        color: '#6B7280',
        fontWeight: '500',
    },
    arrivedTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#065F46',
    },
    onTimeBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 4,
        gap: 2,
    },
    onTimeTextSmall: {
        fontSize: 9,
        fontWeight: '900',
        color: ZEPTO_GREEN,
    },
    chatBubble: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
        ...SHADOWS.light,
    },
    chatText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
        fontWeight: '500',
    },
    chatPointer: {
        position: 'absolute',
        top: -8,
        left: 20,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'white',
    },

    // En Route Banner
    etaBanner: {
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.08)',
    },
    etaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    etaLeft: {},
    etaLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
    },
    etaTimeRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: -4,
    },
    etaTime: {
        fontSize: 48,
        fontWeight: '900',
        color: ZEPTO_PURPLE,
    },
    etaUnit: {
        fontSize: 16,
        fontWeight: '900',
        color: ZEPTO_PURPLE,
        marginLeft: 4,
    },
    onTimeBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 4,
        gap: 4,
    },
    onTimeTextLarge: {
        fontSize: 10,
        fontWeight: '900',
        color: ZEPTO_GREEN,
    },
    zeptoIllustration: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    riderBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(124, 58, 237, 0.1)',
        gap: 8,
    },
    riderAvatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    riderBarText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },

    // Code Section
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
    },
    codeLeft: {},
    codeLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    codeValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#111827',
        letterSpacing: 2,
    },
    codeRight: {
        alignItems: 'center',
        gap: 4,
    },
    codeSecureText: {
        fontSize: 10,
        fontWeight: '800',
        color: ZEPTO_PURPLE,
    },

    // Stepper
    stepperContainer: {
        marginTop: 24,
        paddingHorizontal: 4,
    },
    stepperItems: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 2,
    },
    stepperItem: {
        alignItems: 'center',
        width: 60,
    },
    stepperNode: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    stepperLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        marginTop: 6,
        fontWeight: '600',
    },
    stepperLineTrack: {
        position: 'absolute',
        top: 15,
        left: 30,
        right: 30,
        height: 2,
        backgroundColor: '#F3F4F6',
        zIndex: 1,
    },
    stepperLineFill: {
        height: '100%',
        backgroundColor: ZEPTO_GREEN,
    },

    // Rider Card
    riderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        marginTop: 24,
    },
    riderMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    riderAvatarBox: {
        position: 'relative',
    },
    riderAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingBadge: {
        position: 'absolute',
        bottom: -4,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        ...SHADOWS.light,
        gap: 2,
    },
    ratingText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#111827',
    },
    riderDetails: {
        gap: 2,
    },
    riderNameText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#111827',
    },
    riderStatusText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    riderActions: {
        flexDirection: 'row',
    },
    riderActionBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Tip Section
    tipSection: {
        marginTop: 24,
    },
    tipHeader: {
        gap: 2,
    },
    tipTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#111827',
    },
    tipSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    tipButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    tipBtn: {
        flex: 1,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tipBtnActive: {
        backgroundColor: ZEPTO_PURPLE,
        borderColor: ZEPTO_PURPLE,
    },
    tipBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#374151',
    },
    tipBtnTextActive: {
        color: 'white',
    },

    // Order Details
    orderDetails: {
        marginTop: 24,
    },
    orderHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderLabel: {
        fontSize: 15,
        fontWeight: '900',
        color: '#111827',
    },
    viewItemsText: {
        fontSize: 12,
        fontWeight: '800',
        color: ZEPTO_PURPLE,
    },
    addressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
    },
    addressText: {
        flex: 1,
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
});

export default TrackingBottomSheet;
