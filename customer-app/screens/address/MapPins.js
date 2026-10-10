/**
 * Map markers shared by components/MapComponent.* and components/MapViewContainer.*.
 *
 *   <DeliveryPin lifted={dragging} title="Your order will be delivered here" hint="Move pin to adjust" />
 *     Centre pin for picking a spot. Lifts (springs up, shadow shrinks) while the map
 *     moves and drops back with a small bounce when it settles.
 *   <HomeMarker label="…" />   compact green pin for a chosen address
 *   <StoreMarker />            violet store badge
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, springs } from '../../theme/motion';

const HEAD = 40;
const LIFT = 14;

const Pin = ({ size = HEAD, icon = 'home-variant', color }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const fill = color || colors.accent;
    return (
        <View style={styles.pin}>
            <View style={[styles.head, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}>
                <MaterialCommunityIcons name={icon} size={size * 0.5} color={colors.onAccent} />
            </View>
            <View style={[styles.stem, { backgroundColor: fill }]} />
        </View>
    );
};

export function DeliveryPin({ lifted = false, title, hint }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const up = useSharedValue(0);

    useEffect(() => {
        if (reduce) {
            up.value = withTiming(lifted ? 1 : 0, { duration: durations.fast });
        } else {
            up.value = lifted ? withSpring(1, springs.snappy) : withSpring(0, springs.bouncy);
        }
    }, [lifted, reduce]);

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: reduce ? 0 : -LIFT * up.value }, { scale: 1 + 0.06 * up.value }],
    }));
    const shadowStyle = useAnimatedStyle(() => ({
        opacity: 0.35 - 0.2 * up.value,
        transform: [{ scaleX: 1 - 0.4 * up.value }],
    }));
    const tipStyle = useAnimatedStyle(() => ({
        opacity: 1 - up.value,
        transform: [{ translateY: reduce ? 0 : -LIFT * up.value }],
    }));

    return (
        <View style={[styles.deliveryWrap, { pointerEvents: 'none' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {title || hint ? (
                <Animated.View style={[styles.tipWrap, tipStyle]}>
                    <GlassSurface tone="night" radius="md" style={styles.tip}>
                        {title ? <Text variant="label" color="onNight" align="center" numberOfLines={1}>{title}</Text> : null}
                        {hint ? (
                            <View style={styles.hintRow}>
                                <MaterialCommunityIcons name="gesture-swipe" size={13} color={colors.onNightSecondary} />
                                <Text variant="caption" color="onNightSecondary" numberOfLines={1}>{hint}</Text>
                            </View>
                        ) : null}
                    </GlassSurface>
                    <View style={styles.tipArrow} />
                </Animated.View>
            ) : null}
            <Animated.View style={pinStyle}>
                <Pin />
            </Animated.View>
            <Animated.View style={[styles.ground, shadowStyle]} />
        </View>
    );
}

export function HomeMarker({ label }) {
    const styles = useStyles();
    return (
        <View style={styles.markerWrap}>
            {label ? (
                <View style={styles.label}>
                    <Text variant="caption" numberOfLines={2} align="center">{label}</Text>
                </View>
            ) : null}
            <Pin size={32} />
        </View>
    );
}

export function StoreMarker() {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.store} accessibilityLabel="Store">
            <MaterialCommunityIcons name="storefront-outline" size={18} color={colors.onBrand} />
        </View>
    );
}

/** Pixel offset from the bottom of a centred DeliveryPin wrapper to its tip. */
export const DELIVERY_PIN_TIP = 8;

// Pin rings stay white (onBrand) in both themes so pins pop off light and night maps alike.
const useStyles = makeStyles((t) => ({
    pin: { alignItems: 'center' },
    head: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: t.colors.onBrand,
        ...t.shadows.md,
    },
    stem: { width: 3, height: 12, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: -2 },
    deliveryWrap: { alignItems: 'center' },
    ground: { width: 18, height: 6, borderRadius: radii.pill, backgroundColor: t.isDark ? t.colors.imageWellShadow : t.colors.ink, marginTop: 2 },
    tipWrap: { alignItems: 'center', marginBottom: space.sm, maxWidth: 280 },
    tip: {
        alignItems: 'center',
        gap: space.xxs,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm + space.xxs,
        ...t.shadows.lg,
    },
    hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    // Downward triangle (borders), so the translucent glass never overlaps it.
    tipArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: t.colors.glassFillNight,
    },
    markerWrap: { alignItems: 'center', maxWidth: 220 },
    label: {
        backgroundColor: t.colors.surface,
        borderRadius: radii.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        marginBottom: space.xs,
        ...t.shadows.sm,
    },
    store: {
        width: 34,
        height: 34,
        borderRadius: radii.pill,
        backgroundColor: t.colors.brand,
        borderWidth: 3,
        borderColor: t.colors.onBrand,
        alignItems: 'center',
        justifyContent: 'center',
        ...t.shadows.md,
    },
}));
