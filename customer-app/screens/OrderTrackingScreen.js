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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS } from '../constants';
import { OrderService } from '../services';
import socketService from '../services/socketService';
import OrderTrackingMap from '../components/OrderTrackingMap';
import TrackingBottomSheet from '../components/TrackingBottomSheet';
import {
    fetchRoute,
    generateFallbackRoute,
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

const OrderTrackingScreen = ({ navigation, route: navRoute }) => {
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
    } = useSelector((state) => state.orderTracking);

    const { token } = useSelector((state) => state.auth);
    const [mapReady, setMapReady] = useState(false);
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

        if (currentOrder.orderStatus !== 'OUT_FOR_DELIVERY' && currentOrder.orderStatus !== 'ASSIGNED') return;

        const customerCoords = {
            latitude: currentOrder.deliveryAddress.coordinates.coordinates[1],
            longitude: currentOrder.deliveryAddress.coordinates.coordinates[0],
        };

        fetchRouteData(riderLocation, customerCoords);
    }, [riderLocation?.latitude, riderLocation?.longitude, currentOrder?.orderStatus]);

    useEffect(() => {
        if (riderLocation && previousRiderLocation) {
            const bearing = calculateBearing(previousRiderLocation, riderLocation);
            dispatch(setRiderHeading(bearing));
        }
    }, [riderLocation]);

    useEffect(() => {
        dispatch(setStoreLocation({
            latitude: 26.7606,
            longitude: 83.3732,
        }));
    }, []);

    const fetchOrderDetails = async () => {
        try {
            const data = await OrderService.getOrderById(orderId);
            const order = data.order || data;
            dispatch(setCurrentOrder(order));
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
                const fallback = generateFallbackRoute(origin, destination);
                dispatch(setRouteCoordinates(fallback));
            }
        } catch (err) {
            console.warn('Failed to fetch route:', err);
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
        return ['ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(currentOrder.orderStatus);
    };

    if (isLoading || !currentOrder) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
                <View style={styles.loadingContent}>
                    <View style={styles.loadingIconContainer}>
                        <ActivityIndicator size="large" color={COLORS.secondary} />
                    </View>
                    <Text style={styles.loadingTitle}>Finding your order</Text>
                    <Text style={styles.loadingSubtitle}>Setting up live tracking...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!shouldShowMap()) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.secondary} />

                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order Tracking</Text>
                    <View style={styles.headerRight}>
                        <View style={[
                            styles.connectionBadge,
                            connectionStatus === 'connected' && styles.connectionBadgeOnline,
                        ]}>
                            <MaterialCommunityIcons
                                name={connectionStatus === 'connected' ? 'wifi' : 'wifi-off'}
                                size={16}
                                color={connectionStatus === 'connected' ? '#4CAF50' : '#F44336'}
                            />
                        </View>
                    </View>
                </View>

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
                routeCoordinates={routeCoordinates}
                riderHeading={riderHeading}
                orderStatus={currentOrder.orderStatus}
                onMapReady={() => setMapReady(true)}
            />

            <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity }]}>
                <TouchableOpacity
                    style={styles.floatingBackBtn}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.text} />
                </TouchableOpacity>

                <View style={styles.floatingHeaderCenter}>
                    <Text style={styles.floatingHeaderTitle}>Live Tracking</Text>
                    <View style={styles.liveIndicator}>
                        <View style={[
                            styles.liveDot,
                            connectionStatus === 'connected' && styles.liveDotOnline,
                        ]} />
                        <Text style={styles.liveText}>
                            {connectionStatus === 'connected' ? 'LIVE' : 'CONNECTING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.floatingHeaderRight} />
            </Animated.View>

            {error && (
                <View style={styles.errorBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F44336" />
                    <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
                </View>
            )}

            <TrackingBottomSheet
                order={currentOrder}
                riderLocation={riderLocation}
                routeInfo={routeInfo}
                connectionStatus={connectionStatus}
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
                    color: '#0C831F',
                    bgColor: '#E8F5E9',
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
                    color: '#2196F3',
                    bgColor: '#E3F2FD',
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
        backgroundColor: '#E8F5E9',
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
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.white,
    },
    headerRight: {
        width: 36,
        alignItems: 'flex-end',
    },
    connectionBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectionBadgeOnline: {
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
    },

    floatingHeader: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 16,
        paddingHorizontal: 6,
        paddingVertical: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    floatingHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F44336',
    },
    liveDotOnline: {
        backgroundColor: '#4CAF50',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FF9800',
        letterSpacing: 1,
    },
    floatingHeaderRight: {
        width: 40,
    },

    errorBanner: {
        position: 'absolute',
        top: 110,
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
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
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
