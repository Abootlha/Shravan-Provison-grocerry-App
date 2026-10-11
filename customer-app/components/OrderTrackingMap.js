/**
 * OrderTrackingMap (native) — react-native-maps live tracking map.
 *
 * Props
 *   riderLocation, customerLocation, storeLocation   { latitude, longitude } | null
 *   routeCoordinates   [{ latitude, longitude }]
 *   riderHeading       degrees (0 = north)
 *   orderStatus        order status string
 *   onMapReady         () => void
 *   viewportPadding    { top, bottom } — px of the map hidden behind other UI; fitting keeps markers clear of it
 *   fitKey             any value; when it changes the camera re-fits all markers (map expanded/collapsed)
 *
 * The rider glides between socket fixes over the real update interval (constant motion, no
 * stop-and-go) and the marker rotates through the shortest angle. The camera only re-fits on
 * meaningful changes (status, first fix, expand/collapse), not on every animation frame.
 *
 * Theme: the basemap follows the scheme (OrderTrackingMapStyle — a custom JSON style on Android /
 * Google, `userInterfaceStyle` on iOS Apple Maps). Route, pins and rider take theme colours.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { makeStyles, useTheme } from '../theme';
import { trackingMapStyle } from './OrderTrackingMapStyle';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii } from '../constants/theme';
import { snapPointToRoute } from '../services/directionsService';
import { NATIVE_MAPS_AVAILABLE } from './mapTheme';

let MapView;
let Marker;
let Polyline;
let mapsAvailable = false;
try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    mapsAvailable = NATIVE_MAPS_AVAILABLE;
} catch (e) {
    mapsAvailable = false;
}

const valid = (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0);

const straightPath = (start, end, points = 24) => {
    if (!start || !end) return [];
    return Array.from({ length: points + 1 }, (_, i) => ({
        latitude: start.latitude + ((end.latitude - start.latitude) * i) / points,
        longitude: start.longitude + ((end.longitude - start.longitude) * i) / points,
    }));
};

const Pin = ({ bg, fg, icon }) => {
    const styles = useStyles();
    return (
    <View style={styles.pinWrap}>
        <View style={[styles.pin, { backgroundColor: bg }]}>
            <MaterialCommunityIcons name={icon} size={18} color={fg} />
        </View>
        <View style={[styles.pinTail, { backgroundColor: bg }]} />
    </View>
    );
};

const RiderDot = () => {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
    <View style={styles.riderWrap}>
        <View style={styles.rider}>
            <MaterialCommunityIcons name="navigation" size={16} color={colors.onBrand} />
        </View>
    </View>
    );
};

const OrderTrackingMap = ({
    riderLocation,
    customerLocation,
    storeLocation,
    routeCoordinates = [],
    riderHeading = 0,
    orderStatus,
    onMapReady,
    viewportPadding,
    fitKey,
}) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const mapRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [rider, setRider] = useState(null);
    const riderRef = useRef(null);
    const lastFixAt = useRef(0);
    const frame = useRef(null);
    const [heading, setHeading] = useState(Number.isFinite(riderHeading) ? riderHeading : 0);

    // Glide the rider between fixes (linear over the measured interval).
    useEffect(() => {
        if (!valid(riderLocation)) {
            riderRef.current = null;
            setRider(null);
            return undefined;
        }
        const target = routeCoordinates.length > 1 ? snapPointToRoute(riderLocation, routeCoordinates, 90).point : riderLocation;
        const from = riderRef.current;
        const now = Date.now();
        const duration = Math.min(Math.max(now - lastFixAt.current, 500), 2500);
        lastFixAt.current = now;
        if (!from) {
            riderRef.current = target;
            setRider(target);
            return undefined;
        }
        const startedAt = now;
        if (frame.current) cancelAnimationFrame(frame.current);
        const step = () => {
            const p = Math.min(1, (Date.now() - startedAt) / duration);
            const next = {
                latitude: from.latitude + (target.latitude - from.latitude) * p,
                longitude: from.longitude + (target.longitude - from.longitude) * p,
            };
            riderRef.current = next;
            setRider(next);
            if (p < 1) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
        return () => frame.current && cancelAnimationFrame(frame.current);
    }, [riderLocation?.latitude, riderLocation?.longitude, routeCoordinates]);

    // Shortest-angle heading (marker rotation is applied natively).
    useEffect(() => {
        if (!Number.isFinite(riderHeading)) return;
        setHeading((current) => current + ((((riderHeading - current) % 360) + 540) % 360) - 180);
    }, [riderHeading]);

    const hasRider = Boolean(rider);
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;
        const coords = [rider, customerLocation, storeLocation].filter(valid);
        const edgePadding = {
            top: (viewportPadding?.top || 0) + 48,
            bottom: (viewportPadding?.bottom || 0) + 48,
            left: 48,
            right: 48,
        };
        if (coords.length >= 2) {
            mapRef.current.fitToCoordinates(coords, { edgePadding, animated: true });
        } else if (coords.length === 1) {
            mapRef.current.animateToRegion({ ...coords[0], latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady, fitKey, orderStatus, hasRider, customerLocation?.latitude, storeLocation?.latitude, viewportPadding?.top, viewportPadding?.bottom]);

    const initialRegion = useMemo(
        () => ({
            latitude: customerLocation?.latitude ?? 26.7606,
            longitude: customerLocation?.longitude ?? 83.3732,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    if (!mapsAvailable) return <View style={styles.container} />;

    const showPlannedPath = routeCoordinates.length === 0 && ['PENDING', 'CONFIRMED'].includes(orderStatus) && valid(storeLocation) && valid(customerLocation);

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={initialRegion}
                customMapStyle={trackingMapStyle(isDark)}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
                showsPointsOfInterest={false}
                toolbarEnabled={false}
                onMapReady={() => {
                    setIsMapReady(true);
                    onMapReady?.();
                }}
            >
                {showPlannedPath && (
                    <Polyline
                        coordinates={straightPath(storeLocation, customerLocation)}
                        strokeColor={colors.inkMuted}
                        strokeWidth={3}
                        lineDashPattern={[2, 8]}
                        lineCap="round"
                    />
                )}
                {routeCoordinates.length > 1 && (
                    <>
                        <Polyline coordinates={routeCoordinates} strokeColor={colors.surface} strokeWidth={9} lineCap="round" lineJoin="round" />
                        <Polyline coordinates={routeCoordinates} strokeColor={colors.brandText} strokeWidth={5} lineCap="round" lineJoin="round" />
                    </>
                )}
                {valid(storeLocation) && (
                    <Marker coordinate={storeLocation} anchor={{ x: 0.5, y: 1 }}>
                        <Pin bg={colors.brand} fg={colors.onBrand} icon="storefront" />
                    </Marker>
                )}
                {valid(customerLocation) && (
                    <Marker coordinate={customerLocation} anchor={{ x: 0.5, y: 1 }}>
                        <Pin bg={colors.surfaceInverse} fg={colors.inkInverse} icon="home-variant" />
                    </Marker>
                )}
                {rider && (
                    <Marker coordinate={rider} anchor={{ x: 0.5, y: 0.5 }} rotation={heading} flat>
                        <RiderDot />
                    </Marker>
                )}
            </MapView>
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    container: { flex: 1, backgroundColor: t.colors.surfaceSunken },
    pinWrap: { alignItems: 'center', width: 40, height: 48 },
    pin: {
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        borderWidth: 3,
        borderColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...t.shadows.md,
    },
    pinTail: { width: 10, height: 10, marginTop: -6, transform: [{ rotate: '45deg' }] },
    riderWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    rider: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: t.colors.brand,
        borderWidth: 3,
        borderColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...t.shadows.md,
    },
}));

export default OrderTrackingMap;
