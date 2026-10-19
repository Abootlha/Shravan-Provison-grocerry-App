/**
 * ProductStrip — the Login header: a flat brand-violet card (radius 28, the onboarding hero panel in
 * miniature) with five real catalogue products cropped by its edges. Photos are white stickers, cut-outs
 * stand free (FloatingProduct on="brand"). Reuses the onboarding catalogue answer (no second request);
 * the products drop in from above with a spring, centre first, once on mount.
 *
 * Props: height (default 168), style
 * Reduced motion: products fade in.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { makeStyles } from '../../theme';
import { durations, easings } from '../../theme/motion';
import { FloatingProduct } from './FloatingProduct';
import { useCatalogPreview } from './useCatalogPreview';

// [x offset from centre, y offset, size, rotation°] on a ~358pt card; the outer two bleed off its
// edges. Drawn in this order, so the big centre product sits in front of its neighbours.
const ROW = [
    [-170, 34, 120, -8],
    [168, 30, 118, 7],
    [-86, 10, 116, 6],
    [90, 4, 120, -6],
    [0, 26, 140, -2],
];

const DROP = { damping: 13, stiffness: 150, mass: 1 };

function StripTile({ spec, i, source, reduce, height }) {
    const styles = useStyles();
    const [x, y, size, rot] = spec;
    const a = useSharedValue(0);
    useEffect(() => {
        const delay = 60 + (ROW.length - 1 - i) * 70; // centre first
        a.value = reduce
            ? withDelay(delay, withTiming(1, { duration: durations.base, easing: easings.out }))
            : withDelay(delay, withSpring(1, DROP));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const style = useAnimatedStyle(() => ({
        opacity: reduce ? a.value : a.value > 0.001 ? 1 : 0,
        transform: [
            { translateX: x },
            { translateY: y - (reduce ? 0 : (1 - a.value) * (height + size)) },
            { rotate: `${rot * (reduce ? 1 : 0.5 + 0.5 * a.value)}deg` },
        ],
    }));
    return (
        <Animated.View style={[styles.tileAt, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
            <FloatingProduct source={source} size={size} on="brand" />
        </Animated.View>
    );
}

export function ProductStrip({ height = 168, style }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const { tiles } = useCatalogPreview(ROW.length);
    return (
        <View style={[styles.strip, { height }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <View style={styles.centre}>
                {tiles.length
                    ? ROW.map((spec, i) => (
                        <StripTile key={i} spec={spec} i={i} source={tiles[i] || null} reduce={reduce} height={height} />
                    ))
                    : null}
            </View>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    strip: { overflow: 'hidden', borderRadius: 28, backgroundColor: t.colors.brand },
    centre: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
    tileAt: { position: 'absolute', left: 0, top: 0 },
}));

export default ProductStrip;
