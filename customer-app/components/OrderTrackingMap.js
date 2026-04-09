import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

let MapView, Marker, Polyline;
let mapsAvailable = false;

try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    mapsAvailable = true;
} catch (e) {
    mapsAvailable = false;
}

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

const RiderMarkerView = () => (
    <View style={styles.riderMarkerContainer}>
        <View style={styles.scooterIconBox}>
            <MaterialCommunityIcons name="moped" size={20} color="white" />
        </View>
        <View style={styles.scooterPointer} />
    </View>
);

const StoreMarkerView = () => (
    <View style={styles.storeMarkerContainer}>
        <View style={styles.storePin}>
            <MaterialCommunityIcons name="storefront" size={16} color="white" />
        </View>
        <View style={styles.storePinTail} />
    </View>
);

const CustomerMarkerView = () => (
    <View style={styles.customerMarkerContainer}>
        <View style={styles.customerPin}>
            <MaterialCommunityIcons name="home-variant" size={16} color="white" />
        </View>
        <View style={styles.customerPinTail} />
    </View>
);

const OrderTrackingMap = ({
    riderLocation,
    customerLocation,
    storeLocation,
    routeCoordinates = [],
    riderHeading = 0,
    orderStatus,
    activeLeg,
    onMapReady,
    showFullMap,
}) => {
    const mapRef = useRef(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;

        const coordinates = [];
        if (riderLocation && riderLocation.latitude !== 0 && riderLocation.longitude !== 0) coordinates.push(riderLocation);
        if (customerLocation && customerLocation.latitude !== 0 && customerLocation.longitude !== 0) coordinates.push(customerLocation);
        if (storeLocation && storeLocation.latitude !== 0 && storeLocation.longitude !== 0) coordinates.push(storeLocation);

        if (showFullMap && coordinates.length >= 2) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 56, right: 32, bottom: 160, left: 32 },
                animated: true,
            });
        } else if (riderLocation) {
            mapRef.current.animateToRegion({
                ...riderLocation,
                latitudeDelta: 0.0035,
                longitudeDelta: 0.0035,
            }, 1000);
        } else if (coordinates.length >= 2) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 56, right: 32, bottom: 160, left: 32 },
                animated: true,
            });
        }
    }, [
        isMapReady,
        showFullMap,
        orderStatus,
        riderLocation?.latitude,
        riderLocation?.longitude,
        customerLocation?.latitude,
        customerLocation?.longitude,
        storeLocation?.latitude,
        storeLocation?.longitude,
    ]);

    const handleMapReady = () => {
        setIsMapReady(true);
        onMapReady?.();
    };

    const initialRegion = customerLocation
        ? {
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
        }
        : {
            latitude: 26.7606,
            longitude: 83.3732,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };

    const mapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
        { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
        { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    ];

    if (!mapsAvailable) return <View style={styles.container} />;

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
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
                {routeCoordinates.length > 1 && (
                    <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={ZEPTO_PURPLE}
                        strokeWidth={4}
                        lineDashPattern={[0]}
                        lineCap="round"
                    />
                )}

                {storeLocation && (
                    <Marker coordinate={storeLocation} anchor={{ x: 0.5, y: 1 }}>
                        <StoreMarkerView />
                    </Marker>
                )}

                {customerLocation && (
                    <Marker coordinate={customerLocation} anchor={{ x: 0.5, y: 1 }}>
                        <CustomerMarkerView />
                    </Marker>
                )}

                {riderLocation && (
                    <Marker
                        coordinate={riderLocation}
                        anchor={{ x: 0.5, y: 0.5 }}
                        rotation={riderHeading}
                        flat={true}
                    >
                        <RiderMarkerView />
                    </Marker>
                )}
            </MapView>

            <TouchableOpacity
                style={styles.fitButton}
                onPress={() => {
                    const coords = [];
                    if (riderLocation) coords.push(riderLocation);
                    if (customerLocation) coords.push(customerLocation);
                    if (storeLocation) coords.push(storeLocation);
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 56, right: 32, bottom: 160, left: 32 },
                        animated: true,
                    });
                }}
            >
                <MaterialCommunityIcons name="arrow-expand-all" size={24} color="#333" />
            </TouchableOpacity>
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
    fitButton: {
        position: 'absolute',
        right: 16,
        bottom: 320,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },

    // Rider Marker
    riderMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    scooterIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: ZEPTO_PURPLE,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    scooterPointer: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: ZEPTO_PURPLE,
        marginTop: -2,
    },

    // Store Marker
    storeMarkerContainer: {
        alignItems: 'center',
    },
    storePin: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    storePinTail: {
        width: 2,
        height: 8,
        backgroundColor: '#1F2937',
    },

    // Customer Marker
    customerMarkerContainer: {
        alignItems: 'center',
    },
    customerPin: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: ZEPTO_GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    customerPinTail: {
        width: 2,
        height: 8,
        backgroundColor: ZEPTO_GREEN,
    },
});

export default OrderTrackingMap;
