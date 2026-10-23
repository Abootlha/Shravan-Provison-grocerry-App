/**
 * OrderTrackingScreen — live order tracking (quick-commerce layout).
 *
 * Layout: full-bleed map (~42% of the screen) with a round back button and, on the right, expand /
 * collapse and re-centre (MapControls), then a r16 sheet (the one floating shadow) holding the
 * StatusCard ("Arriving in / **13 mins** / Your order is on the way", "On time" tag, delivery
 * partner with call, "2 Items · ₹78 saved / Delivering to …"), then the delivery OTP and help
 * (TrackingBottomSheet compact). Delivered / cancelled orders drop the map and keep their hero cards.
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
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings } from '../theme/motion';
import { AnimatedScreen, ContentSwap, EmptyState, IconButton, Screen, Text, haptic } from '../components/ui';
import { describeError, friendlyError, UnexpectedResponseError } from '../services/normalize';
import { OrderService, SettingsService } from '../services';
import socketService from '../services/socketService';
import OrderTrackingMap from '../components/OrderTrackingMap';
import TrackingBottomSheet from '../components/TrackingBottomSheet';
import { MapControls, TrackingBar } from './tracking/TrackingHeader';
import StatusCard from './tracking/StatusCard';
import { TrackingSkeleton } from './tracking/TrackingStates';
import { getHeaderCopy } from './tracking/trackingCopy';
import { getRider, shortOrderCode } from './orders/orderUtils';
import { useDeliveryEta } from './tracking/useDeliveryEta';
import { contactStore, useStoreContact } from './tracking/storeContact';
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
        error,
        isLoading,
        activeLeg,
        durationRemaining,
    } = useSelector((state) => state.orderTracking);

    const { token } = useSelector((state) => state.auth);
    const { isHi } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    // Bumped by the re-centre button: the map re-fits store, rider and home.
    const [recenterTick, setRecenterTick] = useState(0);
    const [storePhone, setStorePhone] = useState(null);
    const [loadError, setLoadError] = useState(null);
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

    // Heading: the device compass/GPS course when the rider app sends it, otherwise the bearing
    // between fixes. A rider standing still keeps the last heading instead of snapping north.
    useEffect(() => {
        if (!riderLocation) return;
        if (Number.isFinite(riderLocation.heading)) {
            dispatch(setRiderHeading(riderLocation.heading));
            return;
        }
        if (!previousRiderLocation) return;
        const moved = Math.abs(riderLocation.latitude - previousRiderLocation.latitude)
            + Math.abs(riderLocation.longitude - previousRiderLocation.longitude);
        if (moved < 0.00003) return; // ~3 m: GPS jitter, not movement
        dispatch(setRiderHeading(calculateBearing(previousRiderLocation, riderLocation)));
    }, [riderLocation]);

    // Re-render every 10 s while the order is live so "location delayed" / "On time" stay honest
    // even when no socket event arrives.
    const [, setClock] = useState(0);
    const isLiveOrder = Boolean(currentOrder) && !['DELIVERED', 'CANCELLED'].includes(String(currentOrder?.orderStatus || '').toUpperCase());
    useEffect(() => {
        if (!isLiveOrder) return undefined;
        const id = setInterval(() => setClock((n) => n + 1), 10000);
        return () => clearInterval(id);
    }, [isLiveOrder]);

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
        setLoadError(null);
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
            throw new UnexpectedResponseError(`GET /orders/${orderId}`, data);
        } catch (err) {
            // Never invent an order: show what failed and let the customer retry.
            if (__DEV__) console.warn('[tracking] order fetch failed', describeError(err));
            setLoadError(err);
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

    const expand = () => {
        haptic.light();
        setExpanded(true);
    };
    const collapse = () => setExpanded(false);
    const onBack = () => (expanded ? collapse() : handleSafeBack());

    // Status change → a haptic beat (the headline crossfades itself, see StatusCard). Not on first load.
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

    // Headline minutes: from the server's delivery time only, never counting up without a reason.
    const eta = useDeliveryEta(currentOrder, liveStatus, isHi);

    // Help: call the store (contactPhone), else email it (contactEmail) — both from /settings/store.
    const storeContact = useStoreContact();
    const onHelp = useCallback(() => {
        contactStore(
            { phone: storePhone || storeContact.phone, email: storeContact.email },
            { orderCode: currentOrder ? shortOrderCode(currentOrder) : '', isHi },
        );
    }, [storePhone, storeContact.phone, storeContact.email, currentOrder, isHi]);

    if (loadError && !currentOrder) {
        return (
            <Screen edges={['top']} wash={false}>
                <View style={styles.errorBar}>
                    <IconButton name="arrow-left" variant="surface" accessibilityLabel={isHi ? 'वापस जाएँ' : 'Go back'} onPress={handleSafeBack} />
                </View>
                <AnimatedScreen>
                    <EmptyState
                        mood="sad"
                        title={isHi ? 'ऑर्डर की जानकारी लोड नहीं हुई' : 'Couldn’t load this order'}
                        subtitle={friendlyError(loadError, isHi)}
                        actionLabel={isHi ? 'फिर से कोशिश करें' : 'Try again'}
                        onAction={fetchOrderDetails}
                        secondaryLabel={isHi ? 'मेरे ऑर्डर' : 'My orders'}
                        onSecondary={() => navigation.navigate('OrdersHistory')}
                        style={styles.errorState}
                    />
                </AnimatedScreen>
            </Screen>
        );
    }

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
    const { minutes: etaMinutes, delayNote } = eta;
    const canonicalId = currentOrder?._id || currentOrder?.id || orderId;
    const orderCode = shortOrderCode(currentOrder);
    const terminal = ['DELIVERED', 'CANCELLED'].includes(status);

    // "On time": the live ETA still lands inside the promised window (+2 min grace) and the
    // rider's location isn't stale. Without a promised time we only claim it while live.
    const lastFix = currentOrder?.tracking?.lastLocationUpdateAt || riderLocation?.timestamp || null;
    const stale = lastFix != null && Date.now() - new Date(lastFix).getTime() > 30000;
    const onTime = Boolean(copy?.eta) && Number.isFinite(etaMinutes) && !stale && !delayNote;

    const viewportPadding = expanded
        ? { top: chromeH, bottom: radii.xl + 56 }
        : { top: diff / 2 + chromeH, bottom: diff / 2 + radii.xl };

    const onViewDetails = canonicalId ? () => navigation.navigate('OrderDetails', { orderId: canonicalId }) : undefined;
    const sheetBody = (
        <>
            {showMap ? <View style={styles.handle} /> : null}
            <View style={styles.cards}>
                {!terminal ? (
                    <StatusCard
                        copy={copy}
                        status={status}
                        etaMinutes={etaMinutes}
                        onTime={onTime}
                        delayNote={delayNote}
                        rider={rider}
                        stale={stale && Boolean(legNow)}
                        order={currentOrder}
                        isHi={isHi}
                        onViewDetails={onViewDetails}
                    />
                ) : null}
                <TrackingBottomSheet
                    compact={!terminal}
                    order={currentOrder}
                    riderLocation={riderLocation}
                    activeLeg={legNow}
                    isHi={isHi}
                    onHelp={onHelp}
                    onViewDetails={onViewDetails}
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
                        fitKey={`${expanded ? 'expanded' : 'collapsed'}-${recenterTick}`}
                    />
                </Animated.View>

                {!expanded ? (
                    <Pressable
                        onPress={expand}
                        style={[styles.mapHit, { top: chromeH, height: mapCollapsed - radii.xl - chromeH }]}
                        accessibilityRole="button"
                        accessibilityLabel={isHi ? 'नक्शा बड़ा करें' : 'Expand map'}
                    />
                ) : null}

                {error ? (
                    <View style={[styles.errorPill, { top: chromeH + space.sm }, { pointerEvents: 'none' }]}>
                        <MaterialCommunityIcons name="wifi-strength-alert-outline" size={14} color={colors.errorInk} />
                        <Text variant="caption" color="error" numberOfLines={1}>{error}</Text>
                    </View>
                ) : null}

                <MapControls
                    expanded={expanded}
                    onBack={onBack}
                    onToggle={expanded ? collapse : expand}
                    onRecenter={() => setRecenterTick((n) => n + 1)}
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
    errorBar: { paddingHorizontal: space.gutter, paddingTop: space.sm },
    errorState: { paddingTop: space['3xl'], paddingHorizontal: space.lg },
    body: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.canvas },
    mapLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
    mapHit: { position: 'absolute', left: 0, right: 0, justifyContent: 'flex-end', alignItems: 'flex-end', padding: space.md },
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
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: radii.pill,
        backgroundColor: t.colors.border,
        marginTop: space.sm,
    },
    cards: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
}));

export default OrderTrackingScreen;
