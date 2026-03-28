import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { COLORS } from '../constants';

// Conditionally load react-native-maps
let MapView, Marker, Polyline, PROVIDER_GOOGLE, AnimatedRegion;
const isExpoGo = Constants.executionEnvironment === 'storeClient';
let mapsAvailable = false;

if (!isExpoGo) {
    try {
        const maps = require('react-native-maps');
        MapView = maps.default;
        Marker = maps.Marker;
        Polyline = maps.Polyline;
        PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
        AnimatedRegion = maps.AnimatedRegion;
        mapsAvailable = true;
    } catch (e) {
        // react-native-maps not available
    }
}

// ─── Custom Marker Components ─────────────────────────
const RiderMarkerView = () => (
    <View style={styles.riderMarkerOuter}>
        <View style={styles.riderMarkerInner}>
            <MaterialCommunityIcons name="bike-fast" size={18} color={COLORS.white} />
        </View>
        <View style={styles.riderMarkerPulse} />
    </View>
);

const StoreMarkerView = () => (
    <View style={styles.storeMarker}>
        <MaterialCommunityIcons name="store" size={18} color={COLORS.white} />
    </View>
);

const CustomerMarkerView = () => (
    <View style={styles.customerMarkerOuter}>
        <View style={styles.customerMarkerInner}>
            <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.white} />
        </View>
        <View style={styles.customerMarkerPin} />
    </View>
);

// ─── Fallback Component (for Expo Go) ─────────────────
const FallbackMap = ({ riderLocation, customerLocation, storeLocation, orderStatus, onMapReady }) => {
    const pulseAnim = useRef(new RNAnimated.Value(1)).current;

    useEffect(() => {
        onMapReady?.();
        RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
                RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const getStatusText = () => {
        switch (orderStatus) {
            case 'OUT_FOR_DELIVERY': return '🛵 Your rider is on the way!';
            case 'ASSIGNED': return '📦 Rider assigned, picking up your order';
            case 'PACKED': return '✅ Order packed, assigning a rider';
            default: return '🗺️ Map will appear when order is out for delivery';
        }
    };

    return (
        <View style={styles.fallbackContainer}>
            {/* Animated map pattern background */}
            <View style={styles.fallbackBg}>
                {[...Array(6)].map((_, i) => (
                    <View key={`h${i}`} style={[styles.fallbackGridLine, { top: `${(i + 1) * 14}%`, left: 0, right: 0, height: 1 }]} />
                ))}
                {[...Array(6)].map((_, i) => (
                    <View key={`v${i}`} style={[styles.fallbackGridLine, { left: `${(i + 1) * 14}%`, top: 0, bottom: 0, width: 1 }]} />
                ))}
            </View>

            {/* Animated center icon */}
            <RNAnimated.View style={[styles.fallbackIcon, { transform: [{ scale: pulseAnim }] }]}>
                <MaterialCommunityIcons
                    name={orderStatus === 'OUT_FOR_DELIVERY' ? 'bike-fast' : 'map-marker-radius'}
                    size={40}
                    color={COLORS.secondary}
                />
            </RNAnimated.View>

            <Text style={styles.fallbackTitle}>{getStatusText()}</Text>

            {riderLocation && (
                <View style={styles.fallbackCoordRow}>
                    <View style={styles.fallbackDot} />
                    <MaterialCommunityIcons name="bike-fast" size={14} color="#4CAF50" />
                    <Text style={styles.fallbackCoordText}>
                        Rider: {riderLocation.latitude.toFixed(5)}, {riderLocation.longitude.toFixed(5)}
                    </Text>
                </View>
            )}

            <Text style={styles.fallbackNote}>
                📱 Full map requires a development build
            </Text>
        </View>
    );
};

// ─── Main Map Component ───────────────────────────────
const OrderTrackingMap = ({
    riderLocation,
    customerLocation,
    storeLocation,
    routeCoordinates = [],
    riderHeading = 0,
    orderStatus,
    onMapReady,
}) => {
    const mapRef = useRef(null);
    const riderMarkerRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Use fallback in Expo Go or if maps aren't available
    if (!mapsAvailable) {
        return (
            <FallbackMap
                riderLocation={riderLocation}
                customerLocation={customerLocation}
                storeLocation={storeLocation}
                orderStatus={orderStatus}
                onMapReady={onMapReady}
            />
        );
    }

    // Fit map to show all markers + route
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;

        const coordinates = [];

        if (riderLocation) {
            coordinates.push({
                latitude: riderLocation.latitude,
                longitude: riderLocation.longitude,
            });
        }

        if (customerLocation) {
            coordinates.push({
                latitude: customerLocation.latitude,
                longitude: customerLocation.longitude,
            });
        }

        if (storeLocation) {
            coordinates.push({
                latitude: storeLocation.latitude,
                longitude: storeLocation.longitude,
            });
        }

        if (coordinates.length >= 2) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: {
                    top: 80,
                    right: 60,
                    bottom: 320, // Extra space for bottom sheet
                    left: 60,
                },
                animated: true,
            });
        } else if (coordinates.length === 1) {
            mapRef.current.animateToRegion({
                ...coordinates[0],
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
    }, [isMapReady, riderLocation, customerLocation, storeLocation]);

    // Smoothly animate rider marker
    useEffect(() => {
        if (riderMarkerRef.current && riderLocation && Platform.OS === 'android') {
            riderMarkerRef.current.animateMarkerToCoordinate(
                {
                    latitude: riderLocation.latitude,
                    longitude: riderLocation.longitude,
                },
                800 // Smooth 800ms transition
            );
        }
    }, [riderLocation]);

    const handleMapReady = () => {
        setIsMapReady(true);
        onMapReady?.();
    };

    const initialRegion = customerLocation
        ? {
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
        }
        : {
            latitude: 26.7606,
            longitude: 83.3732,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        };

    // Custom map style — clean & modern
    const mapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
        { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    ];

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={initialRegion}
                customMapStyle={mapStyle}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
                showsPointsOfInterest={false}
                mapPadding={{ top: 0, right: 0, bottom: 300, left: 0 }}
                onMapReady={handleMapReady}
            >
                {/* Route Polyline (road-following) */}
                {routeCoordinates.length > 1 && (
                    <>
                        {/* Shadow polyline */}
                        <Polyline
                            coordinates={routeCoordinates}
                            strokeColor="rgba(12, 131, 31, 0.15)"
                            strokeWidth={8}
                        />
                        {/* Main polyline */}
                        <Polyline
                            coordinates={routeCoordinates}
                            strokeColor={COLORS.secondary}
                            strokeWidth={4}
                            lineCap="round"
                            lineJoin="round"
                        />
                    </>
                )}

                {/* Straight line fallback when no route coordinates */}
                {routeCoordinates.length === 0 && riderLocation && customerLocation && (
                    <Polyline
                        coordinates={[
                            { latitude: riderLocation.latitude, longitude: riderLocation.longitude },
                            { latitude: customerLocation.latitude, longitude: customerLocation.longitude },
                        ]}
                        strokeColor={COLORS.secondary}
                        strokeWidth={3}
                        lineDashPattern={[10, 8]}
                    />
                )}

                {/* Store Marker */}
                {storeLocation && (
                    <Marker
                        coordinate={{
                            latitude: storeLocation.latitude,
                            longitude: storeLocation.longitude,
                        }}
                        title="Store"
                        description="Pickup location"
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <StoreMarkerView />
                    </Marker>
                )}

                {/* Customer/Destination Marker */}
                {customerLocation && (
                    <Marker
                        coordinate={{
                            latitude: customerLocation.latitude,
                            longitude: customerLocation.longitude,
                        }}
                        title="Your Location"
                        description="Delivery address"
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <CustomerMarkerView />
                    </Marker>
                )}

                {/* Rider Marker (animated) */}
                {riderLocation && (
                    <Marker
                        ref={riderMarkerRef}
                        coordinate={{
                            latitude: riderLocation.latitude,
                            longitude: riderLocation.longitude,
                        }}
                        title="Delivery Partner"
                        description="Your rider is here"
                        anchor={{ x: 0.5, y: 0.5 }}
                        rotation={riderHeading}
                        flat={true}
                    >
                        <RiderMarkerView />
                    </Marker>
                )}
            </MapView>

            {/* Gradient overlay at bottom (for smooth blend with bottom sheet) */}
            <View style={styles.bottomGradient} pointerEvents="none" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },

    // Bottom gradient overlay
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'transparent',
    },

    // ─── Rider Marker ─────────────────
    riderMarkerOuter: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    riderMarkerInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: COLORS.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
        zIndex: 10,
    },
    riderMarkerPulse: {
        position: 'absolute',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },

    // ─── Store Marker ─────────────────
    storeMarker: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FF9800',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: COLORS.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 5,
    },

    // ─── Customer Marker ──────────────
    customerMarkerOuter: {
        alignItems: 'center',
    },
    customerMarkerInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: COLORS.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    },
    customerMarkerPin: {
        width: 3,
        height: 10,
        backgroundColor: COLORS.secondary,
        marginTop: -1,
    },

    // ─── Fallback Styles ──────────────
    fallbackContainer: {
        flex: 1,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
    },
    fallbackBg: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.2,
    },
    fallbackGridLine: {
        position: 'absolute',
        backgroundColor: '#81C784',
    },
    fallbackIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fallbackTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2E7D32',
        textAlign: 'center',
        marginBottom: 16,
    },
    fallbackCoordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.85)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginVertical: 4,
    },
    fallbackDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
    },
    fallbackCoordText: {
        fontSize: 12,
        color: '#555',
        fontWeight: '500',
    },
    fallbackNote: {
        fontSize: 12,
        color: '#888',
        marginTop: 20,
        fontStyle: 'italic',
    },
});

export default OrderTrackingMap;
