/**
 * ProductStrip — a single, gently staggered row of real catalogue cut-outs for the Login header: the
 * onboarding cluster, condensed. Free-standing products with contact shadows (no containers). It
 * reuses the onboarding catalogue answer (no second request); the products spring in from the centre
 * outwards once on mount.
 *
 * Props: height (default 128), style
 * Reduced motion: tiles fade in.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { makeStyles } from '../../theme';
import { durations, easings } from '../../theme/motion';
import { FloatingProduct } from './FloatingProduct';
import { useCatalogPreview } from './useCatalogPreview';

// [x offset from centre, y offset, size, rotation°] — all inside a 390pt-wide screen; drawn in this
// order, so the big centre product sits in front of its neighbours.
const ROW = [
    [-150, 10, 56, -6],
    [152, 8, 58, -5],
    [-80, -4, 72, 5],
    [82, -6, 74, 6],
    [0, 2, 94, -3],
];

const SPRING = { damping: 15, stiffness: 170, mass: 0.9 };

function StripTile({ spec, i, source, reduce }) {
    const styles = useStyles();
    const [x, y, size, rot] = spec;
    const a = useSharedValue(0);
    useEffect(() => {
        const delay = 40 + (ROW.length - 1 - i) * 45; // centre first
        a.value = reduce
            ? withDelay(delay, withTiming(1, { duration: durations.base, easing: easings.out }))
            : withDelay(delay, withSpring(1, SPRING));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const style = useAnimatedStyle(() => ({
        opacity: Math.min(1, a.value * 1.4),
        transform: [
            { translateX: x * (reduce ? 1 : 0.8 + 0.2 * a.value) },
            { translateY: y + (reduce ? 0 : (1 - a.value) * 14) },
            { rotate: `${rot * (reduce ? 1 : a.value)}deg` },
            { scale: reduce ? 1 : 0.86 + 0.14 * a.value },
        ],
    }));
    return (
        <Animated.View style={[styles.tileAt, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
            <FloatingProduct source={source} size={size} on="canvas" />
        </Animated.View>
    );
}

export function ProductStrip({ height = 128, style }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const { tiles } = useCatalogPreview(ROW.length);
    return (
        <View style={[styles.strip, { height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <View style={styles.centre}>
                {ROW.map((spec, i) => (
                    <StripTile key={i} spec={spec} i={i} source={tiles[i] || null} reduce={reduce} />
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles(() => ({
    strip: { overflow: 'hidden' },
    centre: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
    tileAt: { position: 'absolute', left: 0, top: 0 },
}));

export default ProductStrip;
