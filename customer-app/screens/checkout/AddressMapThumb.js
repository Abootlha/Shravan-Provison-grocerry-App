/**
 * AddressMapThumb — a still, non-interactive map strip with the store and the delivery address,
 * built from OpenStreetMap raster tiles in Web Mercator (same approach as
 * screens/onboarding/DeliveryAreaMap.js), so it needs no map SDK on any platform.
 * Zoom fits both points. Offline / tiles not loaded: the strip stays a neutral well with the
 * pins and a dashed line between them. No animation.
 *
 * Props: store, home ({ latitude, longitude }), height, label (accessibility description)
 */
import React, { memo, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '../../theme';
import { WEB_DARK_MAP_FILTER } from '../../components/mapTheme';

const TILE = 256;
const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const PIN = 26;

const worldPx = (lat, lng, z) => {
    const n = TILE * 2 ** z;
    const r = (lat * Math.PI) / 180;
    return {
        x: ((lng + 180) / 360) * n,
        y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    };
};

function layoutFor(store, home, w, h) {
    const padX = PIN * 1.5;
    const padY = PIN * 1.2;
    let z = 16;
    // largest whole zoom where both points fit inside the padded box
    for (; z > 3; z -= 1) {
        const a = worldPx(store.latitude, store.longitude, z);
        const b = worldPx(home.latitude, home.longitude, z);
        if (Math.abs(a.x - b.x) <= w - padX * 2 && Math.abs(a.y - b.y) <= h - padY * 2) break;
    }
    const a = worldPx(store.latitude, store.longitude, z);
    const b = worldPx(home.latitude, home.longitude, z);
    const x0 = (a.x + b.x) / 2 - w / 2;
    const y0 = (a.y + b.y) / 2 - h / 2;
    const tiles = [];
    const max = 2 ** z;
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + w) / TILE); tx += 1) {
        for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + h) / TILE); ty += 1) {
            if (ty < 0 || ty >= max) continue;
            const wx = ((tx % max) + max) % max;
            tiles.push({ key: `${z}/${wx}/${ty}`, uri: TILE_URL(z, wx, ty), left: tx * TILE - x0, top: ty * TILE - y0 });
        }
    }
    return { tiles, store: { x: a.x - x0, y: a.y - y0 }, home: { x: b.x - x0, y: b.y - y0 } };
}

function AddressMapThumbBase({ store, home, height = 96, label }) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const [w, setW] = useState(0);
    const geo = useMemo(
        () => (w && store && home ? layoutFor(store, home, w, height) : null),
        [w, height, store?.latitude, store?.longitude, home?.latitude, home?.longitude], // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <View
            style={[styles.map, { height }]}
            onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
        >
            {geo ? (
                <>
                    <View style={[styles.fill, Platform.OS === 'web' ? { filter: isDark ? WEB_DARK_MAP_FILTER : 'saturate(0.55)' } : null]}>
                        {geo.tiles.map((t) => (
                            <Image
                                key={t.key}
                                source={{ uri: t.uri }}
                                style={{ position: 'absolute', left: t.left, top: t.top, width: TILE + 0.5, height: TILE + 0.5 }}
                                cachePolicy="memory-disk"
                                accessible={false}
                            />
                        ))}
                    </View>
                    {Platform.OS !== 'web' && isDark ? <View style={styles.dim} /> : null}
                    <Svg width={w} height={height} style={styles.overlay}>
                        <Line
                            x1={geo.store.x}
                            y1={geo.store.y}
                            x2={geo.home.x}
                            y2={geo.home.y - PIN / 2}
                            stroke={colors.ink}
                            strokeOpacity={0.55}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                        />
                    </Svg>
                    <View style={[styles.store, { left: geo.store.x - PIN / 2, top: geo.store.y - PIN / 2 }]}>
                        <MaterialCommunityIcons name="storefront-outline" size={15} color={colors.ink} />
                    </View>
                    <View style={[styles.home, { left: geo.home.x - PIN / 2, top: geo.home.y - PIN }]}>
                        <MaterialCommunityIcons name="map-marker" size={PIN} color={colors.ink} />
                    </View>
                </>
            ) : null}
        </View>
    );
}

export const AddressMapThumb = memo(AddressMapThumbBase);

const useStyles = makeStyles((t) => ({
    map: { width: '100%', overflow: 'hidden', backgroundColor: t.colors.imageWell },
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.canvas, opacity: 0.6 },
    overlay: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
    store: {
        position: 'absolute',
        width: PIN,
        height: PIN,
        borderRadius: PIN / 2,
        backgroundColor: t.colors.surface,
        borderWidth: 1.5,
        borderColor: t.colors.ink,
        alignItems: 'center',
        justifyContent: 'center',
    },
    home: { position: 'absolute', width: PIN, height: PIN, alignItems: 'center', justifyContent: 'flex-end' },
}));

export default AddressMapThumb;
