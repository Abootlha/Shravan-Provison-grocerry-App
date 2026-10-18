/**
 * WelcomeHero — the first onboarding page's picture: real catalogue cut-outs standing free on the
 * surface (no containers, a soft contact shadow under each) in an asymmetric cluster around a centre
 * product. On mount they spring in, nearest first; then a card forms around the centre product with
 * its real name, pack size, price and the store's delivery time ("Everyday"-style object → card).
 * One-shot: nothing moves after that until the user drags.
 *
 * Drag: three depth layers. While the pager moves (position 0 → 1) the products lag the page by their
 * depth and tilt a little, so the cluster has parallax; the card moves with the page.
 *
 * Props
 *   position   SharedValue<number> — pager position (this page is 0)
 *   width      page width
 *   tiles      catalogue pictures (useCatalogPreview); [] while loading = nothing drawn yet
 *   product    the product shown on the card, or null (the centre product then stays on its own)
 *   etaMinutes the store's estimatedDeliveryMinutes, or null (no time shown)
 *   isHi
 * Reduced motion: products and card fade in; no travel, no parallax.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';
import { Text } from '../../components/ui';
import { FloatingProduct } from './FloatingProduct';
import { packLabel, productName, sourceFor } from './useCatalogPreview';

// Designed on a 390 × 420 box around the centre: [dx, dy, size, rotation°, depth]. An asymmetric
// cluster in three depth layers (small 0.15 · medium 0.3 · large 0.45: larger = nearer = moves more
// with the drag). Every object stays inside the box, so nothing is clipped at the screen edge.
const SCATTER = [
    [-20, -180, 48, 6, 0.15],
    [-152, 4, 54, 5, 0.15],
    [140, 30, 50, -6, 0.15],
    [-48, 172, 52, -8, 0.15],
    [40, 182, 40, 7, 0.15],
    [70, -166, 64, -4, 0.3],
    [146, -96, 76, 8, 0.3],
    [-138, 120, 84, 4, 0.3],
    [-124, -138, 100, -7, 0.45],
    [128, 140, 104, -5, 0.45],
];
export const WELCOME_TILE_COUNT = SCATTER.length;
const BOX_W = 390;
const BOX_H = 420;

const CARD_W = 176;
const PAD = 12; // card padding around the product
const IMAGE_H = 124;
const TILE = 92; // the centre product before the card forms around it
const ASSEMBLE = { damping: 15, stiffness: 170, mass: 0.9 };
const STEP_MS = 36;

// Stagger order: nearest to the centre first.
const ORDER = SCATTER.map(([dx, dy], i) => [i, Math.hypot(dx, dy)])
    .sort((a, b) => a[1] - b[1])
    .reduce((acc, [i], rank) => ({ ...acc, [i]: rank }), {});

function ScatterTile({ spec, index, k, source, position, width, reduce }) {
    const [dx, dy, size, rot, depth] = spec;
    const a = useSharedValue(0);
    useEffect(() => {
        const delay = 60 + ORDER[index] * STEP_MS;
        a.value = reduce
            ? withDelay(delay, withTiming(1, { duration: durations.base, easing: easings.out }))
            : withDelay(delay, withSpring(1, ASSEMBLE));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const style = useAnimatedStyle(() => {
        const p = a.value;
        const d = reduce ? 0 : position.value;
        const from = 1 - p; // 1 at the start of the assembly
        return {
            // lags the page by its depth, and fades so no tile is left behind on the next page
            opacity: Math.min(1, p * 1.4) * Math.max(0, 1 - Math.abs(d) * 1.25),
            transform: [
                { translateX: dx * k * (1 - 0.3 * from) + d * width * depth },
                { translateY: dy * k * (1 - 0.3 * from) + d * dy * 0.12 },
                { rotate: `${rot + from * (rot > 0 ? 14 : -14) + d * depth * 16}deg` },
                { scale: reduce ? 1 : 0.84 + 0.16 * p },
            ],
        };
    });
    const s = Math.round(size * k);
    return (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }, style]}>
            <FloatingProduct source={source} size={s} />
        </Animated.View>
    );
}

function FeatureCard({ k, source, product, etaMinutes, isHi, reduce }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const a = useSharedValue(0); // the centre product lands
    const g = useSharedValue(0); // the card forms around it
    const [gh, setGh] = useState(0);
    useEffect(() => {
        a.value = reduce ? withTiming(1, { duration: durations.base }) : withDelay(40, withSpring(1, ASSEMBLE));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!product) return;
        // once the scatter has landed (or as soon as a late catalogue answer arrives)
        g.value = reduce
            ? withDelay(300, withTiming(1, { duration: durations.slow, easing: easings.out }))
            : withDelay(560, withSpring(1, springs.gentle));
    }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

    const w = Math.round(CARD_W * k);
    const ih = Math.round(IMAGE_H * k);
    const pad = Math.round(PAD * k);
    const startScale = Math.min(1, (TILE * k) / ih);
    const lift = gh ? gh / 2 - (pad + ih / 2) : 0; // image centre → group centre

    const groupStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, a.value * 1.4),
        transform: [{ scale: reduce ? 1 : 0.84 + 0.16 * a.value }],
    }));
    const imageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: reduce ? 0 : (1 - g.value) * lift },
            { scale: reduce ? 1 : startScale + (1 - startScale) * g.value },
        ],
    }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: interpolate(g.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
        transform: [{ scale: reduce ? 1 : 0.9 + 0.1 * g.value }],
    }));
    const textStyle = useAnimatedStyle(() => ({
        opacity: interpolate(g.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: reduce ? 0 : (1 - g.value) * 6 }],
    }));

    const name = productName(product, isHi);
    const mrp = product?.originalPrice > product?.price ? product.originalPrice : null;

    return (
        <Animated.View
            style={[styles.cardGroup, { width: w, marginLeft: -w / 2, marginTop: -gh / 2 }, groupStyle]}
            onLayout={(e) => setGh(e.nativeEvent.layout.height)}
        >
            <Animated.View style={[styles.card, { padding: pad }, cardStyle]}>
                <View style={{ height: ih }} />
                {product ? (
                    <Animated.View style={[styles.cardBody, textStyle]}>
                        <Text variant="label" numberOfLines={2}>{name}</Text>
                        {packLabel(product) ? <Text variant="caption" color="muted" numberOfLines={1}>{packLabel(product)}</Text> : null}
                        <View style={styles.priceRow}>
                            <Text variant="price">₹{Math.round(product.price)}</Text>
                            {mrp ? <Text variant="priceStrike" color="muted">₹{Math.round(mrp)}</Text> : null}
                            <View style={styles.flex} />
                            {etaMinutes ? (
                                <View style={styles.eta}>
                                    <MaterialCommunityIcons name="clock-outline" size={12} color={colors.inkSecondary} />
                                    <Text variant="micro" color="secondary">{isHi ? `${etaMinutes} मिनट` : `${etaMinutes} min`}</Text>
                                </View>
                            ) : null}
                        </View>
                    </Animated.View>
                ) : null}
            </Animated.View>
            <Animated.View style={[styles.cardImage, { top: pad, left: (w - ih) / 2, width: ih, height: ih }, imageStyle]}>
                <FloatingProduct source={source} size={ih} />
            </Animated.View>
        </Animated.View>
    );
}

export function WelcomeHero({ position, width, tiles, product, etaMinutes, isHi }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const [h, setH] = useState(0);
    const k = h ? Math.min(width / BOX_W, h / BOX_H, 1.15) : 0;
    const featureSource = (product && sourceFor(product)) || tiles[WELCOME_TILE_COUNT] || null;

    return (
        <View
            style={styles.hero}
            onLayout={(e) => setH(e.nativeEvent.layout.height)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
        >
            {k ? (
                <View style={styles.centre}>
                    {SCATTER.map((spec, i) => (
                        <ScatterTile
                            key={i}
                            spec={spec}
                            index={i}
                            k={k}
                            source={tiles[i] || null}
                            position={position}
                            width={width}
                            reduce={reduce}
                        />
                    ))}
                    <FeatureCard k={k} source={featureSource} product={product} etaMinutes={etaMinutes} isHi={isHi} reduce={reduce} />
                </View>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    hero: { flex: 1, overflow: 'hidden' },
    centre: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
    flex: { flex: 1 },
    cardGroup: { position: 'absolute', left: 0, top: 0 },
    cardImage: { position: 'absolute' },
    card: {
        width: '100%',
        backgroundColor: t.colors.surface,
        borderRadius: radii.sheet,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        ...t.shadows.floating,
    },
    cardBody: { paddingTop: space.sm, gap: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
    eta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: space.xs + 2,
        height: 22,
        borderRadius: radii.chip,
        backgroundColor: t.colors.imageWell,
    },
}));

export default WelcomeHero;
