/**
 * Skeleton — neutral "bone" placeholders with a soft sweep (UI thread). The ONLY repeating motion in
 * the app, and it runs only while data loads (DESIGN.md "Motion").
 * Wrap related bones in <SkeletonGroup> so they share ONE clock and sweep in sync.
 *
 * <Skeleton> props
 *   width        number | '%' string (default '100%')
 *   height       number (default 14)
 *   radius       number | radii key (default 'xs')
 *   circle       boolean — width=height, fully round (avatars)
 *   tint         bone colour override (e.g. colors.haloOnBrand on a violet header)
 *   style
 *
 * <SkeletonGroup> props
 *   children, style, gap (number, default 0)
 *
 * Helpers
 *   <SkeletonText lines={3} lastLineWidth="60%" lineHeight={12} gap={8} />
 *   <SkeletonProductTile width={156} />   — matches a grid product card (image, 2 lines, price + ADD)
 *   <SkeletonListRow />                    — avatar/thumb + two lines (orders, addresses)
 *
 * Example
 *   <SkeletonGroup style={{ flexDirection: 'row', gap: 12 }}>
 *     <SkeletonProductTile /><SkeletonProductTile />
 *   </SkeletonGroup>
 *
 * Reduced motion: bones are static (no sweep).
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { radii, space } from '../../constants/theme';
import { useTheme } from '../../theme';
import { durations, easings } from '../../theme/motion';

const ClockContext = createContext(null);

function useShimmerClock() {
    const reduce = useReducedMotion();
    const t = useSharedValue(0);
    useEffect(() => {
        if (reduce) return undefined;
        t.value = withRepeat(withTiming(1, { duration: durations.shimmer, easing: easings.linear }), -1, false);
        return () => cancelAnimation(t);
    }, [reduce]);
    return { t, reduce };
}

export function SkeletonGroup({ children, style, gap = 0, ...rest }) {
    const clock = useShimmerClock();
    return (
        <ClockContext.Provider value={clock}>
            <View style={[gap ? { gap } : null, style]} accessibilityLabel="Loading" accessibilityRole="progressbar" {...rest}>
                {children}
            </View>
        </ClockContext.Provider>
    );
}

function Bone({ width, height, radius, tint, style, clock }) {
    const { colors } = useTheme();
    const [w, setW] = useState(typeof width === 'number' ? width : 0);
    const r = typeof radius === 'number' ? radius : radii[radius] ?? radii.xs;
    const sweep = Math.max(80, w * 0.6);
    const anim = useAnimatedStyle(() => ({
        transform: [{ translateX: -sweep + clock.t.value * (w + sweep * 2) }],
    }));
    return (
        <View
            onLayout={typeof width === 'number' ? undefined : (e) => setW(e.nativeEvent.layout.width)}
            style={[{ width, height, borderRadius: r, backgroundColor: tint || colors.hairline /* light: neutral #E6E6E3 · dark: white 8% */, overflow: 'hidden' }, style]}
        >
            {!clock.reduce && w > 0 ? (
                <Animated.View style={[styles.sweep, { width: sweep }, anim]}>
                    <LinearGradient
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        colors={['rgba(255,255,255,0)', colors.shimmer, 'rgba(255,255,255,0)']}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            ) : null}
        </View>
    );
}

function StandaloneBone(props) {
    const clock = useShimmerClock();
    return <Bone {...props} clock={clock} />;
}

export function Skeleton({ width = '100%', height = 14, radius = 'xs', circle = false, tint, style }) {
    const clock = useContext(ClockContext);
    const w = circle ? height : width;
    const r = circle ? height / 2 : radius;
    if (clock) return <Bone width={w} height={height} radius={r} tint={tint} style={style} clock={clock} />;
    return <StandaloneBone width={w} height={height} radius={r} tint={tint} style={style} />;
}

export function SkeletonText({ lines = 2, lastLineWidth = '60%', lineHeight = 12, gap = space.sm, style }) {
    return (
        <View style={[{ gap }, style]}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} height={lineHeight} width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'} />
            ))}
        </View>
    );
}

export function SkeletonProductTile({ width = 156, style }) {
    return (
        <View style={[styles.tile, { width }, style]}>
            <Skeleton height={width * 0.86} radius="md" />
            <View style={{ height: space.md }} />
            <Skeleton height={10} width="40%" />
            <View style={{ height: space.sm }} />
            <SkeletonText lines={2} lineHeight={12} lastLineWidth="70%" gap={6} />
            <View style={styles.tileFooter}>
                <Skeleton height={16} width={48} />
                <Skeleton height={32} width={64} radius="sm" />
            </View>
        </View>
    );
}

export function SkeletonListRow({ style }) {
    return (
        <View style={[styles.row, style]}>
            <Skeleton height={48} width={48} radius="sm" />
            <View style={{ flex: 1, marginLeft: space.md }}>
                <SkeletonText lines={2} lineHeight={12} lastLineWidth="45%" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    tile: {},
    sweep: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    tileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
});

export default Skeleton;
