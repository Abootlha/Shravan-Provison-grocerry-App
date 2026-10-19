/**
 * Still maps for onboarding, built from OpenStreetMap raster tiles laid out in Web Mercator, so circles,
 * routes and pins sit exactly where they belong on every platform (native and web) without a map SDK.
 * Not interactive. Offline the tiles stay a neutral well; overlays still show.
 *
 *   projectMap({ center, reachKm, w, h, fill })  zoom so `reachKm` around `center` spans `fill` of the
 *        shorter side (fractional zoom: whole-zoom tiles drawn up to 2x larger) →
 *        { tiles, size, toPx({ latitude, longitude }) → { x, y }, kmToPx(km) }
 *   <MapTiles geo={geo} />   the tiles (dark mode: CSS re-tone on web, a canvas dim on native) + credit
 *   <DeliveryAreaMap store radiusKm user label active bare />
 *        the store, its delivery radius drawn in (stroke 0 → 360° once `active` first turns true, fill
 *        fades in) and the user's pin dropping in with a small bounce. A new `user` drops it again.
 *        `bare`: no card frame (fills a panel). Zoom fits the circle and the user.
 * Reduced motion: circle and pin fade in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PixelRatio, Platform, View } from 'react-native';
import Animated, {
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';
import { Text } from '../../components/ui';
import { WEB_DARK_MAP_FILTER } from '../../components/mapTheme';
import { HomeMarker, StoreMarker } from '../address/MapPins';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
// A full circle as a path that starts at 12 o'clock, so the stroke draws in clockwise from the top.
const ring = (cx, cy, r) => `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
const TILE = 256;
const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const EARTH = 156543.03392; // metres per pixel at zoom 0 on the equator

const worldPx = (lat, lng, z, tile) => {
    const n = tile * 2 ** z;
    const r = (lat * Math.PI) / 180;
    return {
        x: ((lng + 180) / 360) * n,
        y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    };
};

/** km between two points (equirectangular; plenty for a city). */
export const kmBetween = (a, b) => {
    const cos = Math.cos((a.latitude * Math.PI) / 180);
    return Math.hypot((b.latitude - a.latitude) * 111.32, (b.longitude - a.longitude) * 111.32 * cos);
};

export function projectMap({ center, reachKm, w, h, fill = 0.4 }) {
    const cos = Math.cos((center.latitude * Math.PI) / 180);
    const target = fill * Math.min(w, h);
    const zf = Math.max(3, Math.min(17, Math.log2((EARTH * cos * target) / (Math.max(0.2, reachKm) * 1000))));
    const z = Math.floor(zf);
    const size = TILE * 2 ** (zf - z); // on-screen size of a zoom-z tile
    const c = worldPx(center.latitude, center.longitude, z, size);
    const x0 = c.x - w / 2;
    const y0 = c.y - h / 2;
    // Retina: fetch one zoom level deeper and draw those tiles at half size, so each 256px tile covers
    // ~128pt and labels stay crisp instead of being upscaled.
    const bump = PixelRatio.get() >= 1.5 && z < 19 ? 1 : 0;
    const tz = z + bump;
    const ts = size / 2 ** bump; // on-screen size of a fetched tile
    const tiles = [];
    const max = 2 ** tz;
    for (let tx = Math.floor(x0 / ts); tx <= Math.floor((x0 + w) / ts); tx += 1) {
        for (let ty = Math.floor(y0 / ts); ty <= Math.floor((y0 + h) / ts); ty += 1) {
            if (ty < 0 || ty >= max) continue;
            const wx = ((tx % max) + max) % max;
            tiles.push({ key: `${tz}/${wx}/${ty}`, uri: TILE_URL(tz, wx, ty), left: tx * ts - x0, top: ty * ts - y0 });
        }
    }
    const pxPerKm = (1000 / ((EARTH * cos) / 2 ** z)) * (size / TILE);
    const toPx = (p) => {
        const q = worldPx(p.latitude, p.longitude, z, size);
        return { x: q.x - x0, y: q.y - y0 };
    };
    return { tiles, size: ts, w, h, toPx, kmToPx: (km) => km * pxPerKm };
}

export function MapTiles({ geo }) {
    const styles = useStyles();
    const { isDark } = useTheme();
    return (
        <>
            <View style={[styles.fill, Platform.OS === 'web' ? { filter: isDark ? WEB_DARK_MAP_FILTER : 'saturate(0.55)' } : null]}>
                {geo.tiles.map((t) => (
                    <Image
                        key={t.key}
                        source={{ uri: t.uri }}
                        style={{ position: 'absolute', left: t.left, top: t.top, width: geo.size + 0.5, height: geo.size + 0.5 }}
                        transition={200}
                        cachePolicy="memory-disk"
                        accessible={false}
                    />
                ))}
            </View>
            {/* native has no CSS filter: tone the light tiles down to the dark canvas */}
            {Platform.OS !== 'web' && isDark ? <View style={styles.dim} /> : null}
        </>
    );
}

export function MapCredit() {
    const styles = useStyles();
    return (
        <View style={styles.attribution}>
            <Text variant="micro" color="muted" style={styles.creditText}>© OpenStreetMap</Text>
        </View>
    );
}

export function DeliveryAreaMap({ store, radiusKm, user, label, active = true, bare = false, fill = 0.4 }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const [size, setSize] = useState(null);
    const draw = useSharedValue(0);
    const drop = useSharedValue(0);

    const geo = useMemo(() => {
        if (!size) return null;
        const reachKm = user ? Math.max(radiusKm, kmBetween(store, user) + 0.4) : radiusKm;
        const g = projectMap({ center: store, reachKm, w: size.w, h: size.h, fill });
        return { ...g, c: g.toPx(store), r: g.kmToPx(radiusKm), u: user ? g.toPx(user) : null };
    }, [size, store, radiusKm, user, fill]);

    const shown = Boolean(geo && active);
    useEffect(() => {
        if (!shown) return;
        draw.value = 0;
        draw.value = withTiming(1, { duration: reduce ? durations.base : 900, easing: easings.out });
    }, [shown, geo?.r]); // eslint-disable-line react-hooks/exhaustive-deps

    const ux = geo?.u?.x;
    const uy = geo?.u?.y;
    useEffect(() => {
        if (ux == null) return;
        drop.value = 0;
        drop.value = reduce
            ? withDelay(300, withTiming(1, { duration: durations.base }))
            : withDelay(450, withSpring(1, springs.bouncy));
    }, [ux, uy]); // eslint-disable-line react-hooks/exhaustive-deps

    const C = 2 * Math.PI * (geo?.r || 0);
    const strokeProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - draw.value) }));
    const fillProps = useAnimatedProps(() => ({ fillOpacity: 0.1 * draw.value }));
    const pinStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, drop.value * 2),
        transform: [{ translateY: reduce ? 0 : (1 - drop.value) * -56 }],
    }));

    return (
        <View
            style={bare ? styles.bare : styles.card}
            onLayout={(e) => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
        >
            {geo ? (
                <>
                    <MapTiles geo={geo} />
                    <Svg width={size.w} height={size.h} style={styles.overlay}>
                        <AnimatedCircle cx={geo.c.x} cy={geo.c.y} r={geo.r} fill={colors.brand} animatedProps={fillProps} />
                        <AnimatedPath
                            d={ring(geo.c.x, geo.c.y, geo.r)}
                            fill="none"
                            stroke={colors.brand}
                            strokeWidth={2.5}
                            strokeDasharray={`${C} ${C}`}
                            strokeLinecap="round"
                            animatedProps={strokeProps}
                        />
                    </Svg>
                    <View style={[styles.storeAt, { left: geo.c.x - 20, top: geo.c.y - 20 }]}>
                        <StoreMarker />
                    </View>
                    {geo.u ? (
                        <Animated.View style={[styles.userAt, { left: geo.u.x - 60, top: geo.u.y - 120 }, pinStyle]}>
                            <HomeMarker />
                        </Animated.View>
                    ) : null}
                    <MapCredit />
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    card: {
        flex: 1,
        borderRadius: radii.card,
        overflow: 'hidden',
        backgroundColor: t.colors.imageWell,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    bare: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.imageWell },
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.canvas, opacity: 0.6 },
    overlay: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
    storeAt: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    userAt: { position: 'absolute', width: 120, height: 120, alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none' },
    creditText: { fontSize: 11, lineHeight: 14 },
    attribution: {
        position: 'absolute',
        right: space['2xl'],
        bottom: space.sm + 2,
        paddingHorizontal: space.xs,
        borderRadius: 4,
        backgroundColor: t.colors.surface, // opaque: the credit must stay readable over any tile
    },
}));

export default DeliveryAreaMap;
