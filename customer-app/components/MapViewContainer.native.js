import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Location01Icon } from 'hugeicons-react-native';

export default function MapViewContainer({ latitude, longitude, addressText, onMapPress, onRegionChangeComplete }) {
    const lat = latitude || 26.6926;
    const lng = longitude || 83.4687;

    const mapRef = useRef(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.5)).current;

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

        scaleAnim.setValue(0.7);
        opacityAnim.setValue(0.3);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 100,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    }, [lat, lng, addressText]);

    return (
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
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
        >
            <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 1.0 }}
                tracksViewChanges={true}
            >
                <Animated.View
                    style={[
                        styles.markerWrapper,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                        },
                    ]}
                >
                    {addressText ? (
                        <Text style={styles.plainAddressText} numberOfLines={2}>
                            {addressText}
                        </Text>
                    ) : null}
                    <View style={styles.pinWrapper}>
                        <View style={styles.pinHead}>
                            <View style={styles.pinInnerDot} />
                        </View>
                        <View style={styles.pinArrow} />
                    </View>
                </Animated.View>
            </Marker>
        </MapView>
    );
}

const styles = StyleSheet.create({
    markerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 220,
        padding: 4,
    },
    plainAddressText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
        textShadowColor: 'rgba(255, 255, 255, 0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    pinWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinHead: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E11D48',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 6,
    },
    pinInnerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
    pinArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#E11D48',
        marginTop: -1,
    },
});
