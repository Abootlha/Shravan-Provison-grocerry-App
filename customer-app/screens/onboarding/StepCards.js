/**
 * The value-prop cards (onboarding steps 1 and 2), built from real data where there is some.
 *
 *   <StepCard position index width>   the card frame: follows the pager (the next card springs in from
 *                                     the right while this one slides out left), leans and shrinks a
 *                                     little with the drag. Hands `entered` (0 → 1, once, when the card
 *                                     is mostly on screen) to its content through a render prop.
 *   <PackingCard>  "Packing your order": three real catalogue products tick off one by one.
 *   <RideCard>     "On the way": the scooter (3D) tilts with the drag, the rider slides along the
 *                  store → home line, the arrival time is the store's estimatedDeliveryMinutes.
 * All motion is triggered by the page arriving or by the drag. Reduced motion: fades only.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';
import { ICONS_3D, Text } from '../../components/ui';
import { FloatingProduct } from './FloatingProduct';
import { packLabel, productName, sourceFor } from './useCatalogPreview';

const CARD_MAX_W = 340;

export function StepCard({ position, index, width, children }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const entered = useSharedValue(0);
    useAnimatedReaction(
        () => Math.abs(position.value - index) < 0.55,
        (near, was) => {
            if (near && !was && entered.value === 0) {
                entered.value = reduce
                    ? withTiming(1, { duration: durations.base, easing: easings.out })
                    : withSpring(1, springs.gentle);
            }
        },
    );
    const style = useAnimatedStyle(() => {
        const d = position.value - index; // -1 next card (right) · 0 here · 1 gone left
        if (reduce) return { opacity: interpolate(Math.abs(d), [0, 1], [1, 0], Extrapolation.CLAMP) };
        const ad = Math.min(1, Math.abs(d));
        return {
            transform: [{ translateX: -d * width * 0.08 }, { rotate: `${-d * 5}deg` }, { scale: 1 - ad * 0.07 }],
        };
    });
    return <Animated.View style={[styles.card, style]}>{children(entered)}</Animated.View>;
}

/* ---------- Packing ---------- */

const PACK_FALLBACK = [
    { key: 'tomato', icon: 'tomato', en: 'Tomatoes', hi: 'टमाटर', unit: '500 g' },
    { key: 'milk', icon: 'glass_of_milk', en: 'Milk', hi: 'दूध', unit: '500 ml' },
    { key: 'bread', icon: 'bread', en: 'Bread', hi: 'ब्रेड', unit: '400 g' },
];

function Tick({ entered, i, reduce }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const start = 0.25 + i * 0.22;
    const style = useAnimatedStyle(() => {
        const p = interpolate(entered.value, [start, start + 0.3], [0, 1], Extrapolation.CLAMP);
        return { opacity: p, transform: [{ scale: reduce ? 1 : 0.6 + 0.4 * p }] };
    });
    return (
        <Animated.View style={[styles.tick, style]}>
            <MaterialCommunityIcons name="check" size={14} color={colors.inkInverse} />
        </Animated.View>
    );
}

export function PackingCard({ entered, products, storeName, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const rows = products.length >= 3
        ? products.slice(0, 3).map((p) => ({ key: p.id || p.image, source: sourceFor(p), name: productName(p, isHi), unit: packLabel(p) }))
        : PACK_FALLBACK.map((f) => ({ key: f.key, source: { key: f.key, asset: ICONS_3D[f.icon], icon: true, cutout: true }, name: isHi ? f.hi : f.en, unit: f.unit }));
    return (
        <View style={styles.cardBody}>
            <View style={styles.cardHead}>
                <View style={styles.flex}>
                    <Text variant="title">{isHi ? 'आपका ऑर्डर पैक हो रहा है' : 'Packing your order'}</Text>
                    {storeName ? <Text variant="caption" color="muted" numberOfLines={1}>{storeName}</Text> : null}
                </View>
                <MaterialCommunityIcons name="shopping-outline" size={22} color={colors.inkSecondary} />
            </View>
            {rows.map((r, i) => (
                <View key={r.key} style={styles.row}>
                    <FloatingProduct source={r.source} size={44} />
                    <View style={styles.flex}>
                        <Text variant="label" numberOfLines={1}>{r.name}</Text>
                        {r.unit ? <Text variant="caption" color="muted" numberOfLines={1}>{r.unit}</Text> : null}
                    </View>
                    <Tick entered={entered} i={i} reduce={reduce} />
                </View>
            ))}
        </View>
    );
}

/* ---------- Ride ---------- */

export function RideCard({ entered, position, index, etaMinutes, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const [trackW, setTrackW] = useState(0);
    const RIDER = 30;
    const AT = 0.62; // the rider is a little past half way

    const scooterStyle = useAnimatedStyle(() => {
        if (reduce) return {};
        const d = position.value - index;
        return {
            transform: [
                { translateX: (1 - entered.value) * 24 + d * 14 },
                { rotate: `${(1 - entered.value) * -18 + d * 14}deg` },
            ],
        };
    });
    const fillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: (entered.value * AT - 1) * trackW }],
    }));
    const riderStyle = useAnimatedStyle(() => {
        const d = reduce ? 0 : position.value - index;
        const t = Math.max(0, Math.min(1, entered.value * AT - d * 0.12));
        return { transform: [{ translateX: t * trackW - RIDER / 2 }] };
    });

    const steps = isHi ? ['पैक हुआ', 'राइडर निकला', 'पहुँच रहा है'] : ['Packed', 'Picked up', 'Arriving'];
    return (
        <View style={styles.cardBody}>
            <View style={styles.rideHead}>
                <View style={styles.scooterWell}>
                    <Animated.View style={scooterStyle}>
                        <Image source={ICONS_3D.motor_scooter} style={styles.scooter} contentFit="contain" accessible={false} />
                    </Animated.View>
                </View>
                <View style={styles.flex}>
                    <Text variant="title">{isHi ? 'रास्ते में' : 'On the way'}</Text>
                    <Text variant="caption" color="secondary">
                        {etaMinutes
                            ? isHi ? `लगभग ${etaMinutes} मिनट में पहुँचेगा` : `Arriving in about ${etaMinutes} min`
                            : isHi ? 'जल्द पहुँच रहा है' : 'Arriving soon'}
                    </Text>
                </View>
            </View>

            <View style={styles.route}>
                <View style={styles.stop}>
                    <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.inkSecondary} />
                </View>
                <View style={styles.trackWrap} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
                    <View style={styles.track}>
                        <Animated.View style={[styles.trackFill, fillStyle]} />
                    </View>
                    {trackW ? (
                        <Animated.View style={[styles.rider, riderStyle]}>
                            <MaterialCommunityIcons name="moped" size={16} color={colors.onBrand} />
                        </Animated.View>
                    ) : null}
                </View>
                <View style={styles.stop}>
                    <MaterialCommunityIcons name="home-variant-outline" size={16} color={colors.inkSecondary} />
                </View>
            </View>
            <View style={styles.stepsRow}>
                {steps.map((s, i) => (
                    <Text key={s} variant="micro" color={i === 2 ? 'ink' : 'muted'} style={styles.stepLabel} align={i === 0 ? 'left' : i === 2 ? 'right' : 'center'}>
                        {s}
                    </Text>
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    flex: { flex: 1, minWidth: 0 },
    card: {
        width: '100%',
        maxWidth: CARD_MAX_W,
        alignSelf: 'center',
        backgroundColor: t.colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        ...t.shadows.floating,
    },
    cardBody: { padding: space.lg, gap: space.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    tick: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: t.colors.surfaceInverse,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rideHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    scooterWell: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
    scooter: { width: 64, height: 64 },
    route: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
    stop: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackWrap: { flex: 1, height: 32, justifyContent: 'center' },
    track: { height: 4, borderRadius: 2, backgroundColor: t.colors.hairline, overflow: 'hidden' },
    trackFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.ink },
    rider: {
        position: 'absolute',
        left: 0,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: t.colors.brand,
        borderWidth: 2,
        borderColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    stepLabel: { flex: 1 },
}));
