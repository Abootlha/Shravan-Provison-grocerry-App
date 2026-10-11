/**
 * MapComponent (native) — location picker map with a fixed centre pin.
 * Drag the map to move the pin; it lifts while the map moves and drops when it settles.
 *
 * Props (unchanged API, plus optional copy):
 *   region, selectedLocation, addressDetails, isLoading,
 *   onMapPress(event)                       — event.nativeEvent.coordinate
 *   onRegionChangeComplete(region, details) — details.isGesture when the user dragged
 *   onCurrentLocationPress()
 *   title, hint                              — tooltip copy above the pin
 */
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';
import { IconButton } from './ui';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { DeliveryPin, DELIVERY_PIN_TIP } from '../screens/address/MapPins';
import { mapProps, NATIVE_MAPS_AVAILABLE } from './mapTheme';

const DEFAULT_REGION = {
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
};

const MapComponent = ({
    region,
    selectedLocation,
    isLoading,
    onMapPress,
    onRegionChangeComplete,
    onCurrentLocationPress,
    title,
    hint,
}) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const [moving, setMoving] = useState(false);
    const activeRegion = region || {
        ...DEFAULT_REGION,
        ...(selectedLocation
            ? {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
            }
            : {}),
    };

    return (
        <View style={styles.container}>
            {NATIVE_MAPS_AVAILABLE ? (
            <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={activeRegion}
                region={activeRegion}
                onPress={onMapPress}
                onPanDrag={() => !moving && setMoving(true)}
                onRegionChangeComplete={(r, details) => {
                    setMoving(false);
                    onRegionChangeComplete?.(r, details);
                }}
                showsUserLocation
                showsMyLocationButton={false}
                toolbarEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                {...mapProps(isDark)}
            />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSunken }]} />
            )}

            <View style={[styles.pinLayer, { pointerEvents: 'none' }]}>
                <DeliveryPin lifted={moving} title={title} hint={hint} />
            </View>

            <View style={styles.gps}>
                {isLoading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="small" color={colors.brandText} />
                    </View>
                ) : (
                    <IconButton
                        name="crosshairs-gps"
                        variant="floating"
                        size="lg"
                        color={colors.brandText}
                        accessibilityLabel="Use current location"
                        onPress={onCurrentLocationPress}
                    />
                )}
            </View>
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    container: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.surfaceSunken },
    pinLayer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '50%',
        marginBottom: -DELIVERY_PIN_TIP,
        alignItems: 'center',
    },
    gps: { position: 'absolute', right: space.lg, bottom: space['3xl'] + space.lg },
    loading: {
        width: 48,
        height: 48,
        borderRadius: radii.pill,
        backgroundColor: t.colors.surface,
        ...t.shadows.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export default MapComponent;
