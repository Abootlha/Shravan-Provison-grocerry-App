import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target01Icon } from 'hugeicons-react-native';

export default function MapViewContainer({ latitude, longitude, addressText, onMapPress }) {
    const lat = latitude || 26.6926;
    const lng = longitude || 83.4687;

    const [pinPos, setPinPos] = useState({ x: 50, y: 50 });

    const handleWebClick = (e) => {
        try {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
            setPinPos({ x: px, y: py });

            if (onMapPress) {
                const lngDelta = 0.014;
                const latDelta = 0.008;
                const newLng = (lng - lngDelta / 2) + (px / 100) * lngDelta;
                const newLat = (lat + latDelta / 2) - (py / 100) * latDelta;

                onMapPress({
                    latitude: newLat,
                    longitude: newLng,
                });
            }
        } catch (err) {
            if (onMapPress) onMapPress({ latitude: lat, longitude: lng });
        }
    };

    return (
        <View style={styles.container}>
            {/* OpenStreetMap Preview */}
            <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.007}%2C${lat - 0.004}%2C${lng + 0.007}%2C${lat + 0.004}&layer=mapnik`}
                style={{
                    border: 0,
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    borderRadius: 20,
                    pointerEvents: 'none',
                }}
                title="Real Delivery Location Map"
            />

            {/* Tap Listener over Map Zone */}
            <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFillObject}
                onPress={handleWebClick}
            />

            {/* Target Pin */}
            <View
                style={[
                    styles.webMarkerOverlay,
                    { left: `${pinPos.x}%`, top: `${pinPos.y}%` }
                ]}
                pointerEvents="none"
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
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    webMarkerOverlay: {
        position: 'absolute',
        transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    plainAddressText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
        maxWidth: 240,
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
