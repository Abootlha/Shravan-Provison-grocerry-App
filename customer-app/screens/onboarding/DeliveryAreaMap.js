/**
 * DeliveryAreaMap — a still map around the real store with the delivery radius drawn on it.
 * Built from OpenStreetMap raster tiles laid out in Web Mercator, so the radius circle and the pins sit
 * exactly where they belong on every platform (native and web) without a map SDK. Not interactive.
 *
 *   On mount the radius circle draws itself in (stroke 0 → 360°, fill fades in), then the user's pin
 *   drops in with a small bounce. A new `user` point drops the pin again. No loops.
 *   Zoom is chosen so the whole delivery circle (and the user, when they are outside it) fits.
 *   Offline: the tiles stay a neutral well; the circle and pins still show.
 *
 * Props
 *   store     { latitude, longitude } — the store (centre)
 *   radiusKm  delivery radius
 *   user      { latitude, longitude } | null — the user's point
 *   label     accessibility description of what the map shows
 * Reduced motion: circle and pin fade in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
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

const worldPx = (lat, lng, z, tile = TILE) => {
    const n = tile * 2 ** z;
    const r = (lat * Math.PI) / 180;
    return {
        x: ((lng + 180) / 360) * n,
        y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    };
};

function layoutFor({ store, radiusKm, user, w, h }) {
    const cos = Math.cos((store.latitude * Math.PI) / 180);
    let reachKm = radiusKm;
    if (user) {
        const dy = (user.latitude - store.latitude) * 111.32;
        const dx = (user.longitude - store.longitude) * 111.32 * cos;
        reachKm = Math.max(radiusKm, Math.hypot(dx, dy) + 0.4);
    }
    // Fractional zoom: whole-zoom tiles drawn up to 2x larger, so the circle always fills ~80% of
    // the shorter side instead of jumping between half and full size.
    const target = 0.4 * Math.min(w, h);
    const zf = Math.max(3, Math.min(17, Math.log2((EARTH * cos * target) / (reachKm * 1000))));
    const z = Math.floor(zf);
    const size = TILE * 2 ** (zf - z); // on-screen tile size
    const c = worldPx(store.latitude, store.longitude, z, size);
    const x0 = c.x - w / 2;
    const y0 = c.y - h / 2;
    const tiles = [];
    const max = 2 ** z;
    for (let tx = Math.floor(x0 / size); tx <= Math.floor((x0 + w) / size); tx += 1) {
        for (let ty = Math.floor(y0 / size); ty <= Math.floor((y0 + h) / size); ty += 1) {
            if (ty < 0 || ty >= max) continue;
            const wx = ((tx % max) + max) % max;
            tiles.push({ key: `${z}/${wx}/${ty}`, uri: TILE_URL(z, wx, ty), left: tx * size - x0, top: ty * size - y0 });
        }
    }
    const radiusPx = ((radiusKm * 1000) / ((EARTH * cos) / 2 ** z)) * (size / TILE);
    const u = user ? worldPx(user.latitude, user.longitude, z, size) : null;
    return { tiles, size, radiusPx, cx: w / 2, cy: h / 2, user: u ? { x: u.x - x0, y: u.y - y0 } : null };
}

export function DeliveryAreaMap({ store, radiusKm, user, label }) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const reduce = useReducedMotion();
    const [size, setSize] = useState(null);
    const draw = useSharedValue(0);
    const drop = useSharedValue(0);

    const geo = useMemo(
        () => (size ? layoutFor({ store, radiusKm, user, w: size.w, h: size.h }) : null),
        [size, store, radiusKm, user],
    );

    useEffect(() => {
        if (!geo) return;
        draw.value = 0;
        draw.value = withTiming(1, { duration: reduce ? durations.base : 900, easing: easings.out });
    }, [geo?.radiusPx]); // eslint-disable-line react-hooks/exhaustive-deps

    const ux = geo?.user?.x;
    const uy = geo?.user?.y;
    useEffect(() => {
        if (ux == null) return;
        drop.value = 0;
        drop.value = reduce
            ? withDelay(300, withTiming(1, { duration: durations.base }))
            : withDelay(650, withSpring(1, springs.bouncy));
    }, [ux, uy]); // eslint-disable-line react-hooks/exhaustive-deps

    const C = 2 * Math.PI * (geo?.radiusPx || 0);
    const strokeProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - draw.value) }));
    const fillProps = useAnimatedProps(() => ({ fillOpacity: 0.08 * draw.value }));
    const pinStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, drop.value * 2),
        transform: [{ translateY: reduce ? 0 : (1 - drop.value) * -56 }],
    }));

    return (
        <View
            style={styles.map}
            onLayout={(e) => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
        >
            {geo ? (
                <>
                    <View style={[styles.tiles, Platform.OS === 'web' ? { filter: isDark ? WEB_DARK_MAP_FILTER : 'saturate(0.55)' } : null]}>
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
                    <Svg width={size.w} height={size.h} style={styles.overlay}>
                        <AnimatedCircle cx={geo.cx} cy={geo.cy} r={geo.radiusPx} fill={colors.ink} animatedProps={fillProps} />
                        <AnimatedPath
                            d={ring(geo.cx, geo.cy, geo.radiusPx)}
                            fill="none"
                            stroke={colors.ink}
                            strokeOpacity={0.7}
                            strokeWidth={2}
                            strokeDasharray={`${C} ${C}`}
                            strokeLinecap="round"
                            animatedProps={strokeProps}
                        />
                    </Svg>
                    <View style={[styles.storeAt, { left: geo.cx - 20, top: geo.cy - 20 }]}>
                        <StoreMarker />
                    </View>
                    {geo.user ? (
                        <Animated.View style={[styles.userAt, { left: geo.user.x - 60, top: geo.user.y - 120 }, pinStyle]}>
                            <HomeMarker />
                        </Animated.View>
                    ) : null}
                    <View style={styles.attribution}>
                        <Text variant="micro" color="muted">© OpenStreetMap</Text>
                    </View>
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    map: {
        flex: 1,
        borderRadius: radii.card,
        overflow: 'hidden',
        backgroundColor: t.colors.imageWell,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    tiles: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.canvas, opacity: 0.6 },
    overlay: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
    storeAt: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    userAt: { position: 'absolute', width: 120, height: 120, alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none' },
    attribution: {
        position: 'absolute',
        right: space.xs,
        bottom: space.xs,
        paddingHorizontal: space.xs,
        borderRadius: 4,
        backgroundColor: t.colors.surface,
        opacity: 0.85,
    },
}));

export default DeliveryAreaMap;
