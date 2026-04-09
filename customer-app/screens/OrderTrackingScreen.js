import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { OrderService, SettingsService } from '../services';
import socketService from '../services/socketService';
import OrderTrackingMap from '../components/OrderTrackingMap';
import TrackingBottomSheet from '../components/TrackingBottomSheet';
import {
    fetchRoute,
    calculateBearing,
} from '../services/directionsService';
import {
    setCurrentOrder,
    clearCurrentOrder,
    clearRiderLocation,
    setError,
    setRouteCoordinates,
    setRouteInfo,
    setStoreLocation,
    setRiderHeading,
} from '../store/slices/orderTrackingSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

const OrderTrackingScreen = ({ navigation, route: navRoute }) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const { orderId } = navRoute.params || {};

    const {
        currentOrder,
        riderLocation,
        previousRiderLocation,
        riderHeading,
        routeCoordinates,
        routeInfo,
        storeLocation,
        connectionStatus,
        error,
        isLoading,
        activeLeg,
    } = useSelector((state) => state.orderTracking);

    const { token } = useSelector((state) => state.auth);
    const [mapReady, setMapReady] = useState(false);
    const [showFullMap, setShowFullMap] = useState(false);
    const headerOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!orderId) {
            navigation.goBack();
            return;
        }

        Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();

        if (token) {
            socketService.connect(token);
            socketService.joinOrderRoom(orderId);
        }

        fetchOrderDetails();

        return () => {
            if (orderId) {
                socketService.leaveOrderRoom(orderId);
            }
            dispatch(clearCurrentOrder());
            dispatch(clearRiderLocation());
        };
    }, [orderId, token]);

    useEffect(() => {
        if (!riderLocation || !currentOrder?.deliveryAddress?.coordinates?.coordinates) return;

        if (!['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(currentOrder.orderStatus)) return;
        if (currentOrder?.tracking?.routeCoordinates?.length > 1) return;

        const destination = activeLeg === 'to_store' && storeLocation
            ? storeLocation
            : currentOrder?.deliveryAddress?.coordinates?.coordinates
                ? {
                    latitude: currentOrder.deliveryAddress.coordinates.coordinates[1],
                    longitude: currentOrder.deliveryAddress.coordinates.coordinates[0],
                }
                : null;

        if (!destination) return;

        fetchRouteData(riderLocation, destination);
    }, [riderLocation?.latitude, riderLocation?.longitude, currentOrder?.orderStatus, activeLeg, storeLocation?.latitude, storeLocation?.longitude, currentOrder?.tracking?.routeCoordinates?.length]);

    useEffect(() => {
        if (riderLocation && previousRiderLocation) {
            const bearing = calculateBearing(previousRiderLocation, riderLocation);
            dispatch(setRiderHeading(bearing));
        }
    }, [riderLocation]);

    useEffect(() => {
        const fetchStoreLocation = async () => {
            try {
                const data = await SettingsService.getStoreSettings();
                const settings = data?.settings || data;
                if (settings?.location) {
                    dispatch(setStoreLocation({
                        latitude: settings.location.latitude,
                        longitude: settings.location.longitude,
                    }));
                }
            } catch (err) {
                console.warn('Failed to fetch store location:', err);
            }
        };
        fetchStoreLocation();
    }, []);

    const fetchOrderDetails = async () => {
        try {
            const data = await OrderService.getOrderById(orderId);
            const order = data.order || data;
            dispatch(setCurrentOrder(order));
            if (order?.tracking?.routeCoordinates?.length) {
                dispatch(setRouteCoordinates(order.tracking.routeCoordinates));
            }
            if (order?.tracking) {
                dispatch(setRouteInfo({
                    distanceValue: order.tracking.distanceRemaining ?? null,
                    durationValue: order.tracking.durationMinutes ? order.tracking.durationMinutes * 60 : null,
                    distance: order.tracking.distanceRemaining != null
                        ? `${(order.tracking.distanceRemaining / 1000).toFixed(1)} km`
                        : null,
                    duration: order.tracking.durationMinutes != null
                        ? `${order.tracking.durationMinutes} min`
                        : null,
                }));
            }
        } catch (err) {
            dispatch(setError(err.message || 'Failed to load order details'));
        }
    };

    const fetchRouteData = async (origin, destination) => {
        try {
            const result = await fetchRoute(origin, destination);
            if (result) {
                dispatch(setRouteCoordinates(result.coordinates));
                dispatch(setRouteInfo({
                    distance: result.distance,
                    duration: result.duration,
                    distanceValue: result.distanceValue,
                    durationValue: result.durationValue,
                }));
            } else {
                dispatch(setRouteCoordinates([]));
            }
        } catch (err) {
            console.warn('Failed to fetch route:', err);
            dispatch(setRouteCoordinates([]));
        }
    };

    const getCustomerLocation = () => {
        if (!currentOrder?.deliveryAddress?.coordinates?.coordinates) return null;
        return {
            latitude: currentOrder.deliveryAddress.coordinates.coordinates[1],
            longitude: currentOrder.deliveryAddress.coordinates.coordinates[0],
        };
    };

    const shouldShowMap = () => {
        if (!currentOrder) return false;
        return ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(currentOrder.orderStatus);
    };

    if (isLoading || !currentOrder) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <View style={styles.loadingContent}>
                    <View style={styles.loadingIconContainer}>
                        <ActivityIndicator size="large" color={ZEPTO_PURPLE} />
                    </View>
                    <Text style={styles.loadingTitle}>Finding your order</Text>
                    <Text style={styles.loadingSubtitle}>Setting up live tracking...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const renderCarousel = () => (
        <View style={styles.carouselContainer}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                style={styles.carouselScroll}
            >
                <View style={styles.carouselItem}>
                    <View style={[styles.carouselCard, { backgroundColor: '#1A1A1A' }]}>
                        <View style={styles.carouselInfo}>
                            <Text style={styles.carouselBadge}>PREMIUM</Text>
                            <Text style={styles.carouselTitle}>15% discount on First Year Premium</Text>
                            <Text style={styles.carouselSubtitle}>100% premium back with special exit value benefit</Text>
                            <TouchableOpacity style={styles.applyBtn}>
                                <Text style={styles.applyBtnText}>APPLY NOW</Text>
                                <MaterialCommunityIcons name="chevron-right" size={12} color={ZEPTO_PURPLE} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.carouselImagePlaceholder}>
                            <MaterialCommunityIcons name="wallet-giftcard" size={40} color="rgba(255,255,255,0.2)" />
                        </View>
                    </View>
                </View>
                <View style={styles.carouselItem}>
                    <View style={[styles.carouselCard, { backgroundColor: ZEPTO_PURPLE }]}>
                        <View style={styles.carouselInfo}>
                            <Text style={styles.carouselBadge}>OFFER</Text>
                            <Text style={styles.carouselTitle}>Get FREE Delivery on next 5 orders</Text>
                            <Text style={styles.carouselSubtitle}>Valid for active ShravanKirana Pass members</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.viewMapBtn}
                onPress={() => setShowFullMap(!showFullMap)}
            >
                <View style={styles.viewMapContent}>
                    <View style={styles.viewMapIconBox}>
                        <MaterialCommunityIcons name="map-marker-distance" size={16} color="white" />
                        <View style={styles.viewMapCross} />
                    </View>
                    <Text style={styles.viewMapText}>VIEW MAP</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    if (!shouldShowMap()) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="white" />

                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitleText}>Order Status</Text>
                        <Text style={styles.headerSubtitleText}>#{orderId?.slice(-8).toUpperCase() || 'ORDER'}</Text>
                    </View>
                    <TouchableOpacity style={styles.getHelpBtn}>
                        <MaterialCommunityIcons name="chat-question-outline" size={18} color={ZEPTO_PURPLE} />
                        <Text style={styles.getHelpText}>Get Help</Text>
                    </TouchableOpacity>
                </View>

                {renderCarousel()}

                <View style={styles.preDeliveryContainer}>
                    <PreDeliveryAnimation orderStatus={currentOrder.orderStatus} />
                </View>

                <TrackingBottomSheet
                    order={currentOrder}
                    riderLocation={riderLocation}
                    routeInfo={routeInfo}
                    connectionStatus={connectionStatus}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

                        <OrderTrackingMap
                            riderLocation={riderLocation}
                            customerLocation={getCustomerLocation()}
                            storeLocation={storeLocation}
                            routeCoordinates={currentOrder?.tracking?.routeCoordinates?.length ? currentOrder.tracking.routeCoordinates : routeCoordinates}
                            riderHeading={riderHeading}
                            orderStatus={currentOrder.orderStatus}
                            activeLeg={currentOrder?.tracking?.activeLeg || activeLeg}
                            onMapReady={() => setMapReady(true)}
                            showFullMap={showFullMap}
                        />

            <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity, top: Math.max(insets.top + 8, Platform.OS === 'ios' ? 60 : 50) }]}>
                <TouchableOpacity
                    style={styles.floatingBackBtn}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.text} />
                </TouchableOpacity>

                <View style={styles.floatingHeaderCenter}>
                    <Text style={styles.floatingHeaderTitle}>Order Status</Text>
                    <View style={styles.liveIndicator}>
                        <View style={[
                            styles.liveDot,
                            connectionStatus === 'connected' && styles.liveDotOnline,
                        ]} />
                        <Text style={[styles.liveText, connectionStatus === 'connected' && { color: ZEPTO_GREEN }]}>
                            {connectionStatus === 'connected' ? 'LIVE' : 'CONNECTING'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.getHelpBtnHeader}>
                    <MaterialCommunityIcons name="chat-question-outline" size={18} color={ZEPTO_PURPLE} />
                </TouchableOpacity>
            </Animated.View>

            {error && (
                <View style={[styles.errorBanner, { top: Math.max(insets.top + 72, 120) }]}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F44336" />
                    <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
                </View>
            )}

                        <TrackingBottomSheet
                            order={currentOrder}
                            riderLocation={riderLocation}
                            routeInfo={routeInfo}
                            connectionStatus={connectionStatus}
                            activeLeg={currentOrder?.tracking?.activeLeg || activeLeg}
                        />
        </SafeAreaView>
    );
};

const PreDeliveryAnimation = ({ orderStatus }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 8000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const getStatusConfig = () => {
        switch (orderStatus) {
            case 'PENDING':
                return {
                    icon: 'clock-outline',
                    title: 'Order Placed!',
                    subtitle: 'Waiting for store confirmation',
                    color: ZEPTO_PURPLE,
                    bgColor: 'rgba(124, 58, 237, 0.08)',
                };
            case 'CONFIRMED':
                return {
                    icon: 'store',
                    title: 'Order Confirmed',
                    subtitle: 'Store is preparing your items',
                    color: '#FF9800',
                    bgColor: '#FFF3E0',
                };
            case 'PACKED':
                return {
                    icon: 'package-variant-closed',
                    title: 'Order Packed!',
                    subtitle: 'Looking for a delivery partner',
                    color: ZEPTO_GREEN,
                    bgColor: 'rgba(16, 185, 129, 0.08)',
                };
            default:
                return {
                    icon: 'clock-outline',
                    title: 'Processing',
                    subtitle: 'Please wait...',
                    color: '#666',
                    bgColor: '#F5F5F5',
                };
        }
    };

    const config = getStatusConfig();

    return (
        <View style={styles.preDeliveryContent}>
            <Animated.View
                style={[
                    styles.animatedRing,
                    { borderColor: config.color + '30', transform: [{ rotate: spin }] },
                ]}
            />

            <Animated.View
                style={[
                    styles.preDeliveryIcon,
                    { backgroundColor: config.bgColor, transform: [{ scale: pulseAnim }] },
                ]}
            >
                <MaterialCommunityIcons name={config.icon} size={48} color={config.color} />
            </Animated.View>

            <Text style={[styles.preDeliveryTitle, { color: config.color }]}>
                {config.title}
            </Text>
            <Text style={styles.preDeliverySubtitle}>
                {config.subtitle}
            </Text>

            <View style={styles.dotsContainer}>
                {[0, 1, 2].map((i) => (
                    <DotAnimation key={i} delay={i * 300} color={config.color} />
                ))}
            </View>
        </View>
    );
};

const DotAnimation = ({ delay, color }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const timeout = setTimeout(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.delay(200),
                ])
            ).start();
        }, delay);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <Animated.View
            style={[
                styles.dot,
                {
                    backgroundColor: color,
                    opacity: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                    }),
                    transform: [
                        {
                            translateY: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -8],
                            }),
                        },
                    ],
                },
            ]}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },

    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    loadingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    loadingTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 8,
    },
    loadingSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'ios' ? 50 : 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
    },
    headerCenter: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitleText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1F1F1F',
    },
    headerSubtitleText: {
        fontSize: 12,
        color: '#888',
        fontWeight: '600',
        marginTop: 1,
    },
    getHelpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(124, 58, 237, 0.04)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    getHelpText: {
        fontSize: 12,
        fontWeight: '700',
        color: ZEPTO_PURPLE,
    },
    getHelpBtnHeader: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },

    carouselContainer: {
        paddingVertical: 16,
        backgroundColor: COLORS.white,
        flexDirection: 'row',
        alignItems: 'center',
    },
    carouselScroll: {
        flex: 1,
    },
    carouselItem: {
        width: SCREEN_WIDTH - 120,
        marginLeft: 16,
    },
    carouselCard: {
        borderRadius: 20,
        padding: 16,
        height: 120,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    carouselInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 4,
    },
    carouselBadge: {
        fontSize: 9,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 0.5,
    },
    carouselTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: 'white',
        lineHeight: 18,
    },
    carouselSubtitle: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    applyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 4,
        gap: 2,
    },
    applyBtnText: {
        fontSize: 9,
        fontWeight: '900',
        color: ZEPTO_PURPLE,
    },
    carouselImagePlaceholder: {
        width: 40,
        alignItems: 'flex-end',
    },
    viewMapBtn: {
        marginHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewMapContent: {
        alignItems: 'center',
        gap: 4,
    },
    viewMapIconBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    viewMapCross: {
        position: 'absolute',
        width: 20,
        height: 20,
        // Small map icon overlay
    },
    viewMapText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#6B7280',
    },

    floatingHeader: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    floatingBackBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatingHeaderCenter: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    floatingHeaderTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#AAA',
    },
    liveDotOnline: {
        backgroundColor: ZEPTO_GREEN,
    },
    liveText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#888',
        letterSpacing: 0.5,
    },

    errorBanner: {
        position: 'absolute',
        top: 120,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 10,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        color: '#F44336',
        fontWeight: '500',
    },

    preDeliveryContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    preDeliveryContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 200,
    },
    animatedRing: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 3,
        borderStyle: 'dashed',
    },
    preDeliveryIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 6,
    },
    preDeliveryTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    preDeliverySubtitle: {
        fontSize: 14,
        color: '#999',
        marginTop: 6,
        fontWeight: '500',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 20,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});

export default OrderTrackingScreen;
