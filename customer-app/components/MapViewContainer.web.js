/**
 * MapViewContainer (web) — OpenStreetMap preview with the chosen address pin (and the
 * store, when it falls inside the view). Tap the map to drop the pin elsewhere.
 * Props: latitude, longitude, addressText, onMapPress(coordinate), storeLocation (optional).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { springs } from '../theme/motion';
import { useTheme } from '../theme';
import { HomeMarker, StoreMarker } from '../screens/address/MapPins';
import { WEB_DARK_MAP_FILTER } from './mapTheme';

// Tap point inside `node` (a DOM element on web), from a Pressable press event.
const pointIn = (node, e) => {
    const ev = e?.nativeEvent || {};
    const x = ev.clientX ?? ev.pageX;
    const y = ev.clientY ?? ev.pageY;
    if (!node?.getBoundingClientRect || x == null || y == null) return null;
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: x - r.left, y: y - r.top, w: r.width, h: r.height };
};

const LNG_SPAN = 0.014;
const LAT_SPAN = 0.008;

export default function MapViewContainer({ latitude, longitude, addressText, onMapPress, storeLocation }) {
    const lat = latitude || 26.6926;
    const lng = longitude || 83.4687;

    const { isDark } = useTheme();
    const [pinPos, setPinPos] = useState({ x: 50, y: 50 });
    const reduce = useReducedMotion();
    const drop = useSharedValue(0);

    // A new address recentres the map, so the pin goes back to the middle.
    useEffect(() => {
        setPinPos({ x: 50, y: 50 });
    }, [lat, lng]);

    useEffect(() => {
        if (reduce) return;
        drop.value = -12;
        drop.value = withSpring(0, springs.bouncy);
    }, [pinPos.x, pinPos.y, addressText, reduce]);

    const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));

    const boxRef = useRef(null);

    const handlePress = (e) => {
        const p = pointIn(boxRef.current, e);
        if (!p) {
            if (onMapPress) onMapPress({ latitude: lat, longitude: lng });
            return;
        }
        const px = Math.max(0, Math.min(100, (p.x / p.w) * 100));
        const py = Math.max(0, Math.min(100, (p.y / p.h) * 100));
        setPinPos({ x: px, y: py });
        if (onMapPress) {
            onMapPress({
                latitude: (lat + LAT_SPAN / 2) - (py / 100) * LAT_SPAN,
                longitude: (lng - LNG_SPAN / 2) + (px / 100) * LNG_SPAN,
            });
        }
    };

    const storePos = storeLocation
        ? {
            x: ((storeLocation.longitude - (lng - LNG_SPAN / 2)) / LNG_SPAN) * 100,
            y: (((lat + LAT_SPAN / 2) - storeLocation.latitude) / LAT_SPAN) * 100,
        }
        : null;
    const showStore = storePos && storePos.x > 4 && storePos.x < 96 && storePos.y > 4 && storePos.y < 96;

    return (
        <View ref={boxRef} style={styles.container}>
            <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - LNG_SPAN / 2}%2C${lat - LAT_SPAN / 2}%2C${lng + LNG_SPAN / 2}%2C${lat + LAT_SPAN / 2}&layer=mapnik`}
                // dark: the OSM embed has no dark layer, so it is re-toned (mapTheme.js)
                style={{ border: 0, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', filter: isDark ? WEB_DARK_MAP_FILTER : undefined }}
                title="Delivery location map"
            />

            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel="Map. Tap to move the delivery pin"
            />

            {showStore ? (
                <View style={[styles.marker, styles.centered, { left: `${storePos.x}%`, top: `${storePos.y}%` }, { pointerEvents: 'none' }]}>
                    <StoreMarker />
                </View>
            ) : null}

            <View style={[styles.marker, styles.anchoredBottom, { left: `${pinPos.x}%`, top: `${pinPos.y}%` }, { pointerEvents: 'none' }]}>
                <Animated.View style={pinStyle}>
                    <HomeMarker label={addressText} />
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' },
    marker: { position: 'absolute' },
    centered: { transform: [{ translateX: '-50%' }, { translateY: '-50%' }] },
    anchoredBottom: { transform: [{ translateX: '-50%' }, { translateY: '-100%' }] },
});
