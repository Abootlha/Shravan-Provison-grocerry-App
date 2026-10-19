/**
 * The scenes inside the violet hero panel of the onboarding pager. Each fills the panel area under the
 * top bar and is positioned by the screen (it slides with the pager); everything here is a reaction to
 * mount, the finger or the pager position — no loops.
 *
 *   <WelcomeScene>  big real products drop in with spring physics and settle at a slight tilt, cropped
 *                   by the panel edges. Each can be grabbed, dragged and flung: on release it springs
 *                   back home with the fling's velocity. Products lag the swipe by depth, and lean with
 *                   the phone's roll (useTilt; static on web).
 *   <PackScene>     a white Shravan bag; 3 real products drop in one by one while a receipt chip rolls
 *                   the item count and the total of their real prices, naming the last item added.
 *   <RideScene>     a real map around the store; a rider travels a curved route from the store to a
 *                   home pin, scrubbed by the swipe (position 1 → 3); the arrival time comes from the
 *                   store settings.
 * Chips on the violet panel are white with fixed ink in both themes (like the product stickers).
 * Reduced motion: no drops, flings, drift or tilt; everything is in place.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
    Extrapolation,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path, Rect } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { makeStyles } from '../../theme';
import { springs } from '../../theme/motion';
import { Logo, RollingNumber, Text, haptic } from '../../components/ui';
import { FloatingProduct } from './FloatingProduct';
import { sourceFor } from './useCatalogPreview';
import { cleanName } from './nameFormat';
import { MapCredit, MapTiles, kmBetween, projectMap } from './DeliveryAreaMap';
import { HomeMarker, StoreMarker } from '../address/MapPins';
import { useTilt } from './useTilt';

const INK = '#151515'; // on the white chips, in both themes
const INK_2 = '#555555';
const DROP = { damping: 13, stiffness: 150, mass: 1.1 };
const THROW = { damping: 12, stiffness: 130, mass: 0.8 };

/* ---------------- Welcome ---------------- */

// Designed on a 390 × 400 scene around its centre: [dx, dy, size, rotation°, depth 0..1]. Big, and
// cropped on purpose by the panel's left, right and bottom edges. Drawn far → near.
const HERO = [
    [80, -140, 132, 8, 0.35],
    [-188, 80, 140, 11, 0.5],
    [-115, -100, 156, -9, 0.55],
    [178, -5, 150, -6, 0.7],
    [128, 140, 146, -8, 0.8],
    [-22, 55, 172, 4, 0.9],
];
export const HERO_COUNT = HERO.length;

function PhysProduct({ spec, i, k, source, position, width, sceneH, pagerPan, tilt, reduce }) {
    const [dx, dy, size, rot, depth] = spec;
    const drop = useSharedValue(reduce ? 1 : 0);
    const ox = useSharedValue(0);
    const oy = useSharedValue(0);
    const sx = useSharedValue(0);
    const sy = useSharedValue(0);
    const spin = useSharedValue(0);
    const lift = useSharedValue(0);

    useEffect(() => {
        if (!reduce) drop.value = withDelay(120 + i * 85, withSpring(1, DROP));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    let pan = Gesture.Pan()
        .enabled(!reduce)
        .minDistance(2)
        .onStart(() => {
            cancelAnimation(ox);
            cancelAnimation(oy);
            sx.value = ox.value;
            sy.value = oy.value;
            lift.value = withSpring(1, springs.snappy);
            scheduleOnRN(haptic, 'light');
        })
        .onUpdate((e) => {
            ox.value = sx.value + e.translationX;
            oy.value = sy.value + e.translationY;
            spin.value = Math.max(-16, Math.min(16, e.velocityX / 90));
        })
        .onFinalize((e) => {
            // flung or dropped: bump back home carrying the release velocity
            ox.value = withSpring(0, { ...THROW, velocity: e.velocityX || 0 });
            oy.value = withSpring(0, { ...THROW, velocity: e.velocityY || 0 });
            spin.value = withSpring(0, THROW);
            lift.value = withSpring(0, springs.gentle);
        });
    if (pagerPan) pan = pan.blocksExternalGesture(pagerPan);

    const s = Math.round(size * k);
    const style = useAnimatedStyle(() => {
        const d = reduce ? 0 : position.value;
        const fall = 1 - drop.value;
        return {
            zIndex: lift.value > 0.01 ? 100 : i,
            transform: [
                { translateX: dx * k + ox.value + d * width * depth * 0.35 + tilt.x.value * depth * 14 },
                { translateY: dy * k + oy.value - fall * (sceneH * 0.9 + s) },
                { rotate: `${rot + spin.value + fall * rot * 1.5}deg` },
                { scale: 1 + lift.value * 0.06 },
            ],
        };
    });

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }, style]}>
                <FloatingProduct source={source} size={s} on="brand" />
            </Animated.View>
        </GestureDetector>
    );
}

/**
 * While the catalogue answers (at most a couple of seconds) the panel is never an empty block: soft
 * light spots sit where the products will land, and fade out as the products drop onto them.
 */
function LandingSpots({ k, shown }) {
    const styles = useStyles();
    const o = useSharedValue(shown ? 1 : 0);
    useEffect(() => {
        o.value = withTiming(shown ? 1 : 0, { duration: shown ? 160 : 420 });
    }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
    const fade = useAnimatedStyle(() => ({ opacity: o.value }));
    return (
        <Animated.View style={[styles.abs, fade, { pointerEvents: 'none' }]}>
            {HERO.map(([dx, dy, size], i) => {
                const s = Math.round(size * k * 0.78);
                return (
                    <View
                        key={i}
                        style={[styles.spot, { width: s, height: s, borderRadius: s / 2, left: dx * k - s / 2, top: dy * k - s / 2 }]}
                    />
                );
            })}
        </Animated.View>
    );
}

export function WelcomeScene({ position, width, height, tiles, pagerPan }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const tilt = useTilt();
    const k = Math.min(width / 390, height / 400);
    if (!height) return null;
    return (
        <View style={styles.scene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <View style={styles.centre}>
                <LandingSpots k={k} shown={!tiles.length} />
                {tiles.length > 0 && HERO.map((spec, i) => (
                    <PhysProduct
                        key={i}
                        spec={spec}
                        i={i}
                        k={k}
                        source={tiles[i] || null}
                        position={position}
                        width={width}
                        sceneH={height}
                        pagerPan={pagerPan}
                        tilt={tilt}
                        reduce={reduce}
                    />
                ))}
            </View>
        </View>
    );
}

/* ---------------- Pack ---------------- */

// Where each product lands, relative to the bag mouth centre: [dx, dy, size, rotation°]. A fan of
// three: the outer two land first and lean out, the centre one lands last, in front and upright, so
// every silhouette reads as it lands. The bag's front face hides their lower halves: they are inside.
const SLOTS = [
    [-66, -34, 112, -13],
    [66, -36, 112, 12],
    [0, -58, 128, -2],
];
const STEP_MS = 520;
const BAG_INNER = '#E7E2F6'; // the bag's inside, a touch darker than its white face

function Dropped({ slot, i, k, source, bagTop, sceneH, started, reduce }) {
    const [dx, dy, size, rot] = slot;
    const p = useSharedValue(reduce ? 1 : 0);
    useEffect(() => {
        if (started && !reduce) p.value = withDelay(220 + i * STEP_MS, withSpring(1, DROP));
    }, [started]); // eslint-disable-line react-hooks/exhaustive-deps
    const s = Math.round(size * k);
    const style = useAnimatedStyle(() => ({
        opacity: p.value > 0.001 ? 1 : 0,
        transform: [
            { translateX: dx * k },
            { translateY: bagTop + dy * k - (1 - p.value) * (sceneH + s) },
            { rotate: `${rot * (0.4 + 0.6 * p.value)}deg` },
        ],
    }));
    return (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }, style]}>
            <FloatingProduct source={source} size={s} on="brand" />
        </Animated.View>
    );
}

/** The bag's back: the handle loop and the inner back lip that shows above the front face. */
function BagBack({ w, k }) {
    const lip = Math.round(20 * k);
    const loop = Math.round(54 * k);
    const h = lip + loop + 8;
    return (
        <Svg width={w} height={h}>
            <Path
                d={`M ${w * 0.34} ${h - lip + 4} C ${w * 0.34} ${h - lip - loop}, ${w * 0.66} ${h - lip - loop}, ${w * 0.66} ${h - lip + 4}`}
                stroke="#FFFFFF"
                strokeWidth={6 * k}
                fill="none"
                strokeLinecap="round"
            />
            <Path
                d={`M 6 ${h} L 6 ${h - lip + 6} Q 6 ${h - lip} 12 ${h - lip} L ${w - 12} ${h - lip} Q ${w - 6} ${h - lip} ${w - 6} ${h - lip + 6} L ${w - 6} ${h} Z`}
                fill={BAG_INNER}
            />
        </Svg>
    );
}

/** The bag's front face: flat white, a fold under the mouth, side gussets and the die-cut handle. */
function BagFront({ w, h, k }) {
    const r = 22 * k;
    const fold = h * 0.2;
    const cutW = w * 0.24;
    const cutH = 12 * k;
    return (
        <Svg width={w} height={h}>
            <Path
                d={`M 0 4 Q 0 0 4 0 L ${w - 4} 0 Q ${w} 0 ${w} 4 L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} Z`}
                fill="#FFFFFF"
            />
            {/* the die-cut handle shows the inside of the bag */}
            <Rect x={(w - cutW) / 2} y={fold * 0.38} width={cutW} height={cutH} rx={cutH / 2} fill={BAG_INNER} />
            {/* fold under the mouth and the two side gussets */}
            <Path d={`M 0 ${fold} L ${w} ${fold}`} stroke="rgba(21,21,21,0.07)" strokeWidth={1.5} />
            <Path d={`M ${14 * k} ${fold} L ${10 * k} ${h - r * 0.6}`} stroke="rgba(21,21,21,0.06)" strokeWidth={1.5} />
            <Path d={`M ${w - 14 * k} ${fold} L ${w - 10 * k} ${h - r * 0.6}`} stroke="rgba(21,21,21,0.06)" strokeWidth={1.5} />
        </Svg>
    );
}

export function PackScene({ width, height, products, active, isHi, T }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const [started, setStarted] = useState(false);
    const [count, setCount] = useState(0);
    const timers = useRef([]);
    const items = useMemo(() => products.filter((p) => sourceFor(p)).slice(0, SLOTS.length), [products]);

    useEffect(() => {
        if (!active || started || !items.length) return;
        setStarted(true);
        if (reduce) {
            setCount(items.length);
            return;
        }
        // the receipt ticks as each product lands
        items.forEach((_, i) => {
            timers.current.push(setTimeout(() => setCount(i + 1), 220 + i * STEP_MS + 320));
        });
    }, [active, started, items, reduce]);
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    if (!height || !items.length) return null;
    const k = Math.min(width / 390, height / 400, 1.1);
    const bagW = Math.round(244 * k);
    const bagH = Math.round(176 * k);
    const bagLeft = (width - bagW) / 2;
    const bagBottom = height - Math.round(30 * k);
    const mouth = bagBottom - bagH; // y of the bag's open top
    const backH = Math.round(20 * k) + Math.round(54 * k) + 8;
    const total = items.slice(0, count).reduce((sum, p) => sum + (Number(p.price) || 0), 0);
    const last = count ? cleanName(items[count - 1].name, 30) : '';

    return (
        <View style={styles.scene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <View style={[styles.abs, { left: bagLeft, top: mouth - backH + 6 }]}>
                <BagBack w={bagW} k={k} />
            </View>
            <View style={[styles.abs, { left: width / 2, top: 0 }]}>
                {items.map((p, i) => (
                    <Dropped
                        key={p.id || p._id || i}
                        slot={SLOTS[i]}
                        i={i}
                        k={k}
                        source={sourceFor(p)}
                        bagTop={mouth}
                        sceneH={height}
                        started={started}
                        reduce={reduce}
                    />
                ))}
            </View>
            <View style={[styles.bagFront, { left: bagLeft, top: mouth, width: bagW, height: bagH, borderBottomLeftRadius: 22 * k, borderBottomRightRadius: 22 * k }]}>
                <BagFront w={bagW} h={bagH} k={k} />
                <View style={[styles.bagLogo, { top: bagH * 0.5 }]}>
                    <Logo tone="light" size={Math.round(24 * k)} />
                </View>
            </View>

            {count ? (
                <View style={styles.receipt}>
                    <Text style={[T.meta, styles.receiptName]} numberOfLines={1}>+ {last}</Text>
                    <View style={styles.receiptRow}>
                        <RollingNumber value={count} variant="label" color={INK} suffix={isHi ? ' सामान' : count === 1 ? ' item' : ' items'} />
                        <Text style={[T.meta, { color: INK_2 }]}> · </Text>
                        <RollingNumber value={Math.round(total * 100) / 100} currency variant="label" color={INK} />
                    </View>
                </View>
            ) : null}
        </View>
    );
}

/* ---------------- Ride ---------------- */

const toward = (from, km, bearingDeg) => {
    const b = (bearingDeg * Math.PI) / 180;
    const cos = Math.cos((from.latitude * Math.PI) / 180);
    return {
        latitude: from.latitude + (km * Math.cos(b)) / 111.32,
        longitude: from.longitude + (km * Math.sin(b)) / (111.32 * cos),
    };
};

export function RideScene({ position, width, height, store, radiusKm, etaMinutes, isHi, T, label }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    // an illustrative home a short ride north-east of the real store
    const home = useMemo(() => toward(store, Math.max(1.2, Math.min(3, radiusKm * 0.3)), 52), [store, radiusKm]);
    const geo = useMemo(() => {
        if (!height) return null;
        const mid = { latitude: (store.latitude + home.latitude) / 2, longitude: (store.longitude + home.longitude) / 2 };
        const g = projectMap({ center: mid, reachKm: kmBetween(store, home) / 2 + 0.25, w: width, h: height, fill: 0.36 });
        const a = g.toPx(store);
        const b = g.toPx(home);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        // control point: bowed to one side, like a road that is not a straight line
        const c = { x: mx + ((b.y - a.y) / len) * len * 0.32, y: my - ((b.x - a.x) / len) * len * 0.32 };
        return { ...g, a, b, c };
    }, [store, home, width, height]);

    const riderStyle = useAnimatedStyle(() => {
        if (!geo) return {};
        const t = reduce ? 0.55 : interpolate(position.value, [1, 2, 3], [0.04, 0.55, 0.96], Extrapolation.CLAMP);
        const u = 1 - t;
        const x = u * u * geo.a.x + 2 * u * t * geo.c.x + t * t * geo.b.x;
        const y = u * u * geo.a.y + 2 * u * t * geo.c.y + t * t * geo.b.y;
        return { transform: [{ translateX: x - 17 }, { translateY: y - 17 }] };
    });

    if (!geo) return null;
    const d = `M ${geo.a.x} ${geo.a.y} Q ${geo.c.x} ${geo.c.y} ${geo.b.x} ${geo.b.y}`;
    return (
        <View style={styles.scene} accessible accessibilityRole="image" accessibilityLabel={label}>
            <MapTiles geo={geo} />
            <Svg width={width} height={height} style={styles.abs}>
                <Path d={d} stroke="#FFFFFF" strokeWidth={9} fill="none" strokeLinecap="round" />
                <Path d={d} stroke="#6C3CF4" strokeWidth={4.5} fill="none" strokeLinecap="round" />
            </Svg>
            <View style={[styles.abs, { left: geo.a.x - 20, top: geo.a.y - 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }]}>
                <StoreMarker />
            </View>
            <View style={[styles.abs, styles.homeAt, { left: geo.b.x - 60, top: geo.b.y - 120 }]}>
                <HomeMarker />
            </View>
            <Animated.View style={[styles.abs, styles.rider, riderStyle]}>
                <MaterialCommunityIcons name="moped" size={18} color="#FFFFFF" />
            </Animated.View>
            <View style={styles.etaChip}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={INK} />
                <Text style={[T.strong, { color: INK }]}>
                    {etaMinutes
                        ? isHi ? `लगभग ${etaMinutes} मिनट में` : `Arriving in ~${etaMinutes} min`
                        : isHi ? 'रास्ते में' : 'On the way'}
                </Text>
            </View>
            <MapCredit />
        </View>
    );
}

const useStyles = makeStyles(() => ({
    scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
    centre: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
    abs: { position: 'absolute', left: 0, top: 0 },
    spot: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.09)' },
    bagFront: {
        position: 'absolute',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        boxShadow: '0px 10px 24px rgba(24,8,80,0.28)',
    },
    bagLogo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    receipt: {
        position: 'absolute',
        left: 20,
        top: 16,
        maxWidth: 270,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 2,
        boxShadow: '0px 8px 18px rgba(24,8,80,0.25)',
    },
    receiptName: { color: INK_2 },
    receiptRow: { flexDirection: 'row', alignItems: 'center' },
    homeAt: { width: 120, height: 120, alignItems: 'center', justifyContent: 'flex-end' },
    rider: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#6C3CF4',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.25)',
    },
    etaChip: {
        position: 'absolute',
        left: 20,
        top: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 36,
        boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
    },
}));
