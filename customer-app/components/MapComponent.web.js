/**
 * MapComponent (web) — embedded map with a fixed centre pin. Tap anywhere on the map
 * to move the pin there: the pin lifts, the map recentres and the pin drops back.
 * Same props as MapComponent.native.js; onMapPress receives { nativeEvent: { coordinate } }.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from './ui';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { getMapmyIndiaMapUrl, isMapMyIndiaConfigured } from '../services/mapService';
import { DeliveryPin, DELIVERY_PIN_TIP } from '../screens/address/MapPins';
import { WEB_DARK_MAP_FILTER } from './mapTheme';

const DEFAULT_CENTER = { latitude: 26.6926, longitude: 83.4687 };
const DEG_PER_PX = 0.0000175; // ≈ zoom 16

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

const iframeStyle = { border: 0, width: '100%', height: '100%', pointerEvents: 'none' };
// Dark: the embeds have no dark layer, so re-tone them (see mapTheme.js).
const iframeDarkStyle = { ...iframeStyle, filter: WEB_DARK_MAP_FILTER };

const MapComponent = ({
    region,
    selectedLocation,
    isLoading,
    onMapPress,
    onCurrentLocationPress,
    title,
    hint,
}) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const center = selectedLocation || region || DEFAULT_CENTER;
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [lifted, setLifted] = useState(false);
    const dropTimer = useRef(null);
    const boxRef = useRef(null);
    useEffect(() => () => clearTimeout(dropTimer.current), []);

    const cosLat = Math.cos((center.latitude * Math.PI) / 180);
    const halfLng = (size.w / 2) * DEG_PER_PX;
    const halfLat = (size.h / 2) * DEG_PER_PX * cosLat;

    const url = isMapMyIndiaConfigured()
        ? getMapmyIndiaMapUrl(center, 16, Math.round(size.w) || 600, Math.round(size.h) || 360)
        : size.w
            ? `https://www.openstreetmap.org/export/embed.html?bbox=${center.longitude - halfLng}%2C${center.latitude - halfLat}%2C${center.longitude + halfLng}%2C${center.latitude + halfLat}&layer=mapnik`
            : null;

    const handlePress = (e) => {
        const p = pointIn(boxRef.current, e);
        if (!onMapPress || !p) return;
        const longitude = center.longitude + (p.x - p.w / 2) * DEG_PER_PX;
        const latitude = center.latitude - (p.y - p.h / 2) * DEG_PER_PX * cosLat;
        setLifted(true);
        clearTimeout(dropTimer.current);
        dropTimer.current = setTimeout(() => setLifted(false), 160);
        onMapPress({ nativeEvent: { coordinate: { latitude, longitude } } });
    };

    return (
        <View ref={boxRef} style={styles.container} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {url ? (
                <iframe
                    key={`${center.latitude.toFixed(5)}-${center.longitude.toFixed(5)}-${Math.round(size.w)}`}
                    src={url}
                    title="Delivery location map"
                    style={isDark ? iframeDarkStyle : iframeStyle}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                />
            ) : null}

            <Pressable
                onPress={handlePress}
                style={StyleSheet.absoluteFill}
                accessibilityRole="button"
                accessibilityLabel="Map. Tap to move the delivery pin"
            />

            <View style={[styles.pinLayer, { pointerEvents: 'none' }]}>
                <DeliveryPin lifted={lifted} title={title} hint={hint} />
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
