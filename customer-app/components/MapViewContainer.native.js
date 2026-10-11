/**
 * MapViewContainer (native) — preview map with the chosen address pin (and optionally
 * the store). Props: latitude, longitude, addressText, onMapPress(coordinate),
 * onRegionChangeComplete, storeLocation ({ latitude, longitude }, optional).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { springs } from '../theme/motion';
import { useTheme } from '../theme';
import { HomeMarker, StoreMarker } from '../screens/address/MapPins';
import { mapProps, NATIVE_MAPS_AVAILABLE } from './mapTheme';

export default function MapViewContainer({ latitude, longitude, addressText, onMapPress, onRegionChangeComplete, storeLocation }) {
    const lat = latitude || 26.6926;
    const lng = longitude || 83.4687;

    const { isDark, colors } = useTheme();
    const mapRef = useRef(null);
    const reduce = useReducedMotion();
    const drop = useSharedValue(0);

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.animateToRegion(
                {
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                },
                400
            );
        }
        if (!reduce) {
            drop.value = -12;
            drop.value = withSpring(0, springs.bouncy);
        }
    }, [lat, lng, addressText]);

    const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));

    if (!NATIVE_MAPS_AVAILABLE) {
        // No Google Maps key in this Android build: a plain surface with the pin, never a native crash.
        return (
            <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: colors.surfaceSunken }]}>
                <Animated.View style={pinStyle}>
                    <HomeMarker label={addressText} />
                </Animated.View>
            </View>
        );
    }

    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.006,
                longitudeDelta: 0.006,
            }}
            onPress={(e) => onMapPress && onMapPress(e.nativeEvent.coordinate)}
            onRegionChangeComplete={onRegionChangeComplete}
            zoomEnabled={true}
            zoomTapEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsUserLocation={true}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            {...mapProps(isDark)}
        >
            {storeLocation ? (
                <Marker key={isDark ? 'store-dark' : 'store-light'} coordinate={storeLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <StoreMarker />
                </Marker>
            ) : null}
            <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 1.0 }} tracksViewChanges>
                <Animated.View style={pinStyle}>
                    <HomeMarker label={addressText} />
                </Animated.View>
            </Marker>
        </MapView>
    );
}

const styles = StyleSheet.create({ fallback: { alignItems: 'center', justifyContent: 'center' } });
