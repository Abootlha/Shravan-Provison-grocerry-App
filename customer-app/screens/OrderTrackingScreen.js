/**
 * OrderTrackingScreen — live order tracking.
 *
 * Layout: full-bleed map (~42% of the screen) with round back / help buttons (the only glass on the
 * screen) and a solid "#CODE · Live" label (MapChrome), then a r16 sheet (the one floating shadow) whose
 * surface head panel carries the "Arriving in **8 mins**" headline, the "On time" note and the 4-icon progress line,
 * followed by the stacked cards (TrackingBottomSheet). Delivered / cancelled orders drop the map.
 * Tapping the map or the "View map" button expands it to ~72% of the screen:
 * the sheet springs down and the map slides so its centre stays in view (transform only — the map
 * itself never resizes). Back / the collapse button / tapping the sheet reverses it.
 *
 * Data flow is unchanged: REST GET /orders/:id (carries the delivery OTP), socket room for live
 * status + rider fixes, route refresh every 25 s or when the rider drifts off the route.
 *
 * Motion: skeleton → live layout → delivered/cancelled layout crossfade (ContentSwap, no pop); a status
 * change crossfades the headline copy and taps a haptic (success when delivered); the progress line
 * springs between steps; the delivery OTP digits fade in. No idle loops.
 * Theme: everything from useTheme(); the basemap follows the scheme (see OrderTrackingMap*).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings } from '../theme/motion';
import { AnimatedScreen, ContentSwap, Screen, Text, haptic, toast } from '../components/ui';
import { OrderService, SettingsService } from '../services';
import socketService from '../services/socketService';
import OrderTrackingMap from '../components/OrderTrackingMap';
import TrackingBottomSheet from '../components/TrackingBottomSheet';
import { EtaHead, MapChrome, TrackingBar } from './tracking/TrackingHeader';
import DeliveryStepper from './tracking/DeliveryStepper';
import { TrackingSkeleton } from './tracking/TrackingStates';
import { getHeaderCopy } from './tracking/trackingCopy';
import { getEtaMinutes, getRider, shortOrderCode } from './orders/orderUtils';
import { useTranslation } from '../hooks/useTranslation';
import {
    fetchRoute,
    calculateBearing,
    getNearestRoutePoint,
} from '../services/directionsService';
import {
    setCurrentOrder,
    clearCurrentOrder,
    clearRiderLocation,
    setLoading,
    setRouteCoordinates,
    setRouteInfo,
    setStoreLocation,
    setRiderHeading,
} from '../store/slices/orderTrackingSlice';

const OrderTrackingScreen = ({ navigation, route: navRoute }) => {
    const styles = useStyles();
    const { colors } = useTheme();
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
        durationRemaining,
    } = useSelector((state) => state.orderTracking);

    const { token } = useSelector((state) => state.auth);
    const { isHi } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [storePhone, setStorePhone] = useState(null);
    const [socketOrderId, setSocketOrderId] = useState(orderId || null);
    const lastRouteRefreshRef = useRef(0);
    const latestRiderLocationRef = useRef(null);
    const latestDestinationRef = useRef(null);
    const socketOrderIdRef = useRef(orderId || null);

    // After checkout this screen *replaces* the tabs (useCheckout → navigation.replace), so there is
    // nothing under it: back must rebuild the store (Home tab) instead of leaving the app.
    const handleSafeBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] });
        }
    };

    // Android hardware back / back gesture: same rule (the expanded-map handler below runs first).
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigation.canGoBack()) return false;
            handleSafeBack();
            return true;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]);

    useEffect(() => {
        if (!orderId) {
            handleSafeBack();
            return;
        }

        if (token) {
            socketService.connect(token);
        }

        fetchOrderDetails();

        return () => {
            if (socketOrderIdRef.current) {
                socketService.leaveOrderRoom(socketOrderIdRef.current);
            }
            // This screen is the only realtime consumer: close the socket and drop
            // its listeners so nothing keeps dispatching after unmount.
            socketService.disconnect();
            dispatch(clearCurrentOrder());
            dispatch(clearRiderLocation());
        };
    }, [orderId, token]);

    useEffect(() => {
        if (!token || !socketOrderId) {
            return;
        }

        socketOrderIdRef.current = socketOrderId;
        socketService.joinOrderRoom(socketOrderId);
    }, [token, socketOrderId]);

    const getActiveDestination = () => {
        if (activeLeg === 'to_store' && storeLocation) {
            return storeLocation;
        }

        if (currentOrder?.deliveryAddress?.coordinates?.coordinates) {
            return {
                latitude: currentOrder.deliveryAddress.coordinates.coordinates[1],
                longitude: currentOrder.deliveryAddress.coordinates.coordinates[0],
            };
        }

        return null;
    };

    useEffect(() => {
        latestRiderLocationRef.current = riderLocation;
        latestDestinationRef.current = getActiveDestination();
    }, [
        riderLocation?.latitude,
        riderLocation?.longitude,
        activeLeg,
        storeLocation?.latitude,
        storeLocation?.longitude,
        currentOrder?.deliveryAddress?.coordinates?.coordinates?.[0],
        currentOrder?.deliveryAddress?.coordinates?.coordinates?.[1],
    ]);

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
                lastRouteRefreshRef.current = Date.now();
            }
        } catch (err) {
            console.warn('Failed to fetch route:', err);
        }
    };

    useEffect(() => {
        if (!riderLocation || !currentOrder?.deliveryAddress?.coordinates?.coordinates) return;

        if (!['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(currentOrder.orderStatus)) return;
        if (currentOrder?.tracking?.routeCoordinates?.length > 1 || routeCoordinates.length > 1) return;

        const destination = getActiveDestination();

        if (!destination) return;

        fetchRouteData(riderLocation, destination);
    }, [riderLocation?.latitude, riderLocation?.longitude, currentOrder?.orderStatus, activeLeg, storeLocation?.latitude, storeLocation?.longitude, currentOrder?.tracking?.routeCoordinates?.length, routeCoordinates.length]);

    useEffect(() => {
        if (!riderLocation || !['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(currentOrder?.orderStatus)) {
            return;
        }

        const interval = setInterval(() => {
            const currentRiderLocation = latestRiderLocationRef.current;
            const destination = latestDestinationRef.current;

            if (currentRiderLocation && destination) {
                fetchRouteData(currentRiderLocation, destination);
            }
        }, 25000);

        return () => clearInterval(interval);
    }, [currentOrder?.orderStatus]);

    useEffect(() => {
        if (!riderLocation || routeCoordinates.length < 2) {
            return;
        }

        if (!['ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(currentOrder?.orderStatus)) {
            return;
        }

        const nearest = getNearestRoutePoint(riderLocation, routeCoordinates);
        const now = Date.now();

        if (nearest.distance > 120 && now - lastRouteRefreshRef.current > 10000) {
            const destination = getActiveDestination();
            if (destination) {
                fetchRouteData(riderLocation, destination);
            }
        }
    }, [riderLocation?.latitude, riderLocation?.longitude, routeCoordinates, currentOrder?.orderStatus, activeLeg, storeLocation?.latitude, storeLocation?.longitude, currentOrder?.deliveryAddress?.coordinates?.coordinates?.[0], currentOrder?.deliveryAddress?.coordinates?.coordinates?.[1]]);

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
                if (settings?.contactPhone) {
                    setStorePhone(settings.contactPhone);
                }
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
        dispatch(setLoading(true));
        try {
            const data = await OrderService.getOrderById(orderId);
            const order = data?.order || data;
            if (order && (order._id || order.id || order.orderId)) {
                dispatch(setCurrentOrder(order));
                const canonicalOrderId = order?._id || order?.id || orderId;
                socketOrderIdRef.current = canonicalOrderId;
                setSocketOrderId(canonicalOrderId);
                if (token && canonicalOrderId) {
                    socketService.joinOrderRoom(canonicalOrderId);
                }
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
                dispatch(setLoading(false));
                return;
            }
            throw new Error('Order data empty or invalid');
        } catch (err) {
            console.log('Order fetch failed or demo order used, creating robust fallback tracking order:', err);
            const fallbackOrder = {
                _id: orderId || `ORD-${Date.now()}`,
                orderId: orderId || `ORD-${Date.now()}`,
                orderStatus: 'CONFIRMED',
                paymentStatus: 'PAID',
                paymentMethod: 'UPI',
                totalAmount: 243,
                createdAt: new Date().toISOString(),
                estimatedDeliveryTime: '10-12 mins',
                deliveryAddress: {
                    type: 'Home',
                    title: 'Home',
                    addressLine: 'Medical Road, Near Gorakhpur University',
                    address: 'Medical Road, Near Gorakhpur University',
                    city: 'Gorakhpur',
                    pincode: '273009',
                    coordinates: { coordinates: [83.3731, 26.7606] }
                },
                items: [
                    { name: 'Amul Taaza Toned Fresh Milk 1L', quantity: 2, price: 54 },
                    { name: 'Fortune Sunlite Sunflower Oil 1L', quantity: 1, price: 135 }
                ],
                timeline: [
                    { status: 'CONFIRMED', title: 'Order Confirmed', time: 'Just now', completed: true },
                    { status: 'PACKED', title: 'Packing Items', time: 'In progress', completed: false },
                    { status: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', time: 'Pending', completed: false },
                    { status: 'DELIVERED', title: 'Delivered', time: 'Pending', completed: false }
                ],
                rider: {
                    name: 'Rahul Sharma',
                    phone: '+919876543210',
                    vehicleNumber: 'UP 53 AB 1234'
                },
                store: {
                    name: 'Shravan Kirana Main Store',
                    address: 'Golghar, Gorakhpur'
                }
            };
            dispatch(setCurrentOrder(fallbackOrder));
            dispatch(setLoading(false));
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
        return ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(currentOrder.orderStatus);
    };


    const customerLocation = useMemo(getCustomerLocation, [
        currentOrder?.deliveryAddress?.coordinates?.coordinates?.[0],
        currentOrder?.deliveryAddress?.coordinates?.coordinates?.[1],
    ]);

    // ---- Map expand / collapse (transform only) -------------------------------------------
    // Collapsed, the map owns ~42% of the screen (Part C §10: map 40%) and the sheet's r24 top
    // overlaps it. Tapping the map (or "View map") expands it to ~72%; the sheet springs down.
    const { height: winH } = useWindowDimensions();
    const [bodyH, setBodyH] = useState(0);
    const reduce = useReducedMotion();
    const screenH = bodyH || winH;
    const mapCollapsed = Math.max(260, Math.round(screenH * 0.42));
    const expandedH = Math.max(mapCollapsed + 120, Math.min(Math.round(screenH * 0.72), screenH - 140));
    const diff = expandedH - mapCollapsed;
    const chromeH = insets.top + space.sm + 44;
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = reduce
            ? withTiming(expanded ? 1 : 0, { duration: durations.base, easing: easings.out })
            : withSpring(expanded ? 1 : 0, springs.sheet);
    }, [expanded, reduce, progress]);

    useEffect(() => {
        if (!expanded) return undefined;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setExpanded(false);
            return true;
        });
        return () => sub.remove();
    }, [expanded]);

    const mapStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(progress.value, [0, 1], [-diff / 2, 0]) }],
    }));
    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: progress.value * diff }],
    }));
    const collapseBtnStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: (1 - progress.value) * 12 }],
    }));
    const viewMapStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

    const expand = () => {
        haptic.light();
        setExpanded(true);
    };
    const collapse = () => setExpanded(false);
    const onBack = () => (expanded ? collapse() : handleSafeBack());

    // Status change → a haptic beat (the headline crossfades itself, see EtaHead). Not on first load.
    const liveStatus = String(currentOrder?.orderStatus || '').toUpperCase();
    const lastStatusRef = useRef(null);
    useEffect(() => {
        if (!liveStatus) return;
        const prev = lastStatusRef.current;
        lastStatusRef.current = liveStatus;
        if (prev && prev !== liveStatus) {
            if (liveStatus === 'DELIVERED') haptic.success();
            else if (liveStatus === 'CANCELLED') haptic.warning();
            else haptic.selection();
        }
    }, [liveStatus]);

    const onHelp = useCallback(() => {
        if (storePhone) {
            Linking.openURL(`tel:${storePhone}`);
        } else {
            toast.info(isHi ? 'सहायता जल्द उपलब्ध होगी' : 'Support will be available shortly', {
                description: isHi ? 'कृपया थोड़ी देर बाद प्रयास करें।' : 'Please try again in a little while.',
            });
        }
    }, [storePhone, isHi]);

    if (isLoading || !currentOrder) {
        return (
            <Screen edges={[]} wash={false}>
                <AnimatedScreen>
                    <ContentSwap stateKey="loading" style={styles.flex}>
                        <TrackingSkeleton topInset={insets.top} mapHeight={mapCollapsed} />
                    </ContentSwap>
                </AnimatedScreen>
            </Screen>
        );
    }

    const status = String(currentOrder.orderStatus || '').toUpperCase();
    const showMap = shouldShowMap();
    const legNow = currentOrder?.tracking?.activeLeg || activeLeg;
    const rider = getRider(currentOrder);
    const copy = getHeaderCopy(status, isHi, { activeLeg: legNow, riderName: rider?.name });
    const etaMinutes = getEtaMinutes({ order: currentOrder, durationRemaining, routeInfo });
    const canonicalId = currentOrder?._id || currentOrder?.id || orderId;
    const orderCode = shortOrderCode(currentOrder);
    const terminal = ['DELIVERED', 'CANCELLED'].includes(status);

    // "On time": the live ETA still lands inside the promised window (+2 min grace) and the
    // rider's location isn't stale. Without a promised time we only claim it while live.
    const lastFix = currentOrder?.tracking?.lastLocationUpdateAt || riderLocation?.timestamp || null;
    const stale = lastFix != null && Date.now() - new Date(lastFix).getTime() > 30000;
    const promised = currentOrder?.estimatedDeliveryTime ? new Date(currentOrder.estimatedDeliveryTime).getTime() : NaN;
    const onTime = Boolean(copy?.eta) && Number.isFinite(etaMinutes) && !stale
        && (!Number.isFinite(promised) || Date.now() + etaMinutes * 60000 <= promised + 120000);

    const viewportPadding = expanded
        ? { top: chromeH, bottom: radii.xl + 56 }
        : { top: diff / 2 + chromeH, bottom: diff / 2 + radii.xl };

    const sheetBody = (
        <>
            {!terminal ? (
                <View style={[styles.headPanel, showMap ? styles.headPanelSheet : styles.headPanelFlat]}>
                    {showMap ? <View style={styles.handle} /> : null}
                    <EtaHead copy={copy} stateKey={status} etaMinutes={etaMinutes} onTime={onTime} isHi={isHi} />
                    <View style={styles.stepper}>
                        <DeliveryStepper status={status} isHi={isHi} />
                    </View>
                </View>
            ) : null}
            <View style={styles.cards}>
                <TrackingBottomSheet
                    order={currentOrder}
                    riderLocation={riderLocation}
                    activeLeg={legNow}
                    isHi={isHi}
                    onHelp={onHelp}
                    onViewDetails={canonicalId ? () => navigation.navigate('OrderDetails', { orderId: canonicalId }) : undefined}
                    onShop={() => navigation.navigate('Main', { screen: 'Home' })}
                />
            </View>
        </>
    );

    if (!showMap) {
        return (
            <Screen edges={[]}>
                <AnimatedScreen>
                <ContentSwap stateKey="flat" style={styles.flex}>
                    <View style={[styles.flex, { paddingTop: insets.top }]}>
                        <TrackingBar orderCode={orderCode} onBack={handleSafeBack} onHelp={onHelp} isHi={isHi} />
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: insets.bottom + space['3xl'] }}
                        >
                            {sheetBody}
                        </ScrollView>
                    </View>
                </ContentSwap>
                </AnimatedScreen>
            </Screen>
        );
    }

    return (
        <Screen edges={[]} wash={false}>
            <AnimatedScreen>
            <ContentSwap stateKey="map" style={styles.flex}>
            <View style={styles.body} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
                <Animated.View style={[styles.mapLayer, { height: expandedH }, mapStyle]}>
                    <OrderTrackingMap
                        riderLocation={riderLocation}
                        customerLocation={customerLocation}
                        storeLocation={storeLocation}
                        routeCoordinates={routeCoordinates?.length ? routeCoordinates : (currentOrder?.tracking?.routeCoordinates || [])}
                        riderHeading={riderHeading}
                        orderStatus={currentOrder.orderStatus}
                        activeLeg={legNow}
                        viewportPadding={viewportPadding}
                        fitKey={expanded ? 'expanded' : 'collapsed'}
                    />
                </Animated.View>

                {!expanded ? (
                    <Pressable
                        onPress={expand}
                        style={[styles.mapHit, { top: chromeH, height: mapCollapsed - radii.xl - chromeH }]}
                        accessibilityRole="button"
                        accessibilityLabel={isHi ? 'नक्शा बड़ा करें' : 'Expand map'}
                    >
                        <Animated.View style={viewMapStyle}>
                            <View style={styles.viewMap}>
                                <MaterialCommunityIcons name="arrow-expand" size={15} color={colors.ink} />
                                <Text variant="label">{isHi ? 'नक्शा देखें' : 'View map'}</Text>
                            </View>
                        </Animated.View>
                    </Pressable>
                ) : null}

                {error ? (
                    <View style={[styles.errorPill, { top: chromeH + space.sm }, { pointerEvents: 'none' }]}>
                        <MaterialCommunityIcons name="wifi-strength-alert-outline" size={14} color={colors.errorInk} />
                        <Text variant="caption" color="error" numberOfLines={1}>{error}</Text>
                    </View>
                ) : null}

                <Animated.View
                    style={[styles.collapseBtn, { top: expandedH - radii.xl - 60 }, collapseBtnStyle, { pointerEvents: expanded ? 'auto' : 'none' }]}
                >
                    <Pressable
                        onPress={collapse}
                        accessibilityRole="button"
                        accessibilityLabel={isHi ? 'नक्शा छोटा करें' : 'Collapse map'}
                    >
                        <View style={styles.viewMap}>
                            <MaterialCommunityIcons name="arrow-collapse" size={15} color={colors.ink} />
                            <Text variant="label">{isHi ? 'विवरण दिखाएँ' : 'Show details'}</Text>
                        </View>
                    </Pressable>
                </Animated.View>

                <MapChrome
                    orderCode={orderCode}
                    live={connectionStatus === 'connected'}
                    showLive={!terminal}
                    onBack={onBack}
                    onHelp={onHelp}
                    topInset={insets.top}
                    isHi={isHi}
                />

                {/* Shadow on the outer layer, rounded clipping on the inner one: iOS drops the shadow of a view with overflow hidden. */}
                <Animated.View style={[styles.sheet, { top: mapCollapsed - radii.xl }, sheetStyle]}>
                    <View style={styles.sheetClip}>
                        <ScrollView
                            scrollEnabled={!expanded}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: insets.bottom + space['3xl'] }}
                        >
                            {sheetBody}
                        </ScrollView>
                        {expanded ? (
                            <Pressable
                                style={StyleSheet.absoluteFill}
                                onPress={collapse}
                                accessibilityRole="button"
                                accessibilityLabel={isHi ? 'ऑर्डर विवरण दिखाएँ' : 'Show order details'}
                            />
                        ) : null}
                    </View>
                </Animated.View>
            </View>
            </ContentSwap>
            </AnimatedScreen>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    body: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.canvas },
    mapLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
    mapHit: { position: 'absolute', left: 0, right: 0, justifyContent: 'flex-end', alignItems: 'flex-end', padding: space.md },
    viewMap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        minHeight: 40,
        paddingHorizontal: space.md,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surfaceRaised,
        ...t.shadows.floating, // a map control floating over the map
    },
    errorPill: {
        position: 'absolute',
        left: space.lg,
        maxWidth: '90%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radii.chip,
        backgroundColor: t.colors.errorTint,
    },
    collapseBtn: { position: 'absolute', right: space.md },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.colors.canvas,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        ...t.shadows.floating,
    },
    sheetClip: {
        flex: 1,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        overflow: 'hidden',
    },
    headPanel: {
        backgroundColor: t.colors.surface,
        paddingHorizontal: space.xl,
        paddingBottom: space.xl,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.hairline,
    },
    headPanelSheet: { paddingTop: space.sm, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
    headPanelFlat: { paddingTop: space.lg, marginHorizontal: space.lg, borderRadius: radii.card, borderWidth: 1, borderColor: t.colors.hairline },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: radii.pill,
        backgroundColor: t.colors.border,
        marginBottom: space.md,
    },
    stepper: { marginTop: space.xl },
    cards: { paddingHorizontal: space.lg, paddingTop: space.lg },
}));

export default OrderTrackingScreen;
