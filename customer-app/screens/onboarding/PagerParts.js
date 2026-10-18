/**
 * Small pieces of the onboarding pager.
 *
 *   <SegmentedProgress position count label>  one segment per step after the welcome page; each fills
 *       with the pager position (so it follows the finger and springs with the page). Hidden on the
 *       welcome page, fades in as you leave it.
 *   <DimmedGrid position width tiles>  a soft, loose field of real catalogue cut-outs (no containers)
 *       behind the value-prop cards (steps 1–2). Fades in as you leave the welcome page, drifts slower
 *       than the cards.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { FloatingProduct } from './FloatingProduct';

const SEG_GAP = 6;

function Segment({ position, i, width }) {
    const styles = useStyles();
    const style = useAnimatedStyle(() => {
        const f = Math.max(0, Math.min(1, position.value - i));
        return { transform: [{ translateX: (f - 1) * width }] };
    });
    return (
        <View style={[styles.segment, { width }]}>
            <Animated.View style={[styles.fill, style]} />
        </View>
    );
}

export function SegmentedProgress({ position, count, label }) {
    const styles = useStyles();
    const [w, setW] = useState(0);
    const seg = w ? (w - SEG_GAP * (count - 1)) / count : 0;
    const wrap = useAnimatedStyle(() => ({
        opacity: interpolate(position.value, [0.1, 0.7], [0, 1], Extrapolation.CLAMP),
    }));
    return (
        <Animated.View
            style={[styles.progress, wrap]}
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
            accessibilityRole="progressbar"
            accessibilityLabel={label}
        >
            {seg ? Array.from({ length: count }, (_, i) => <Segment key={i} position={position} i={i} width={seg} />) : null}
        </Animated.View>
    );
}

const COLS = 4;
const ROWS = 5;
export const GRID_TILES = COLS * ROWS;
const FIELD_SIZE = 78;
const FIELD_GAP_X = 16;
const FIELD_GAP_Y = 22;

export function DimmedGrid({ position, width, tiles, offset = 0 }) {
    const styles = useStyles();
    const { isDark } = useTheme();
    const reduce = useReducedMotion();
    const dim = isDark ? 0.1 : 0.09;
    const style = useAnimatedStyle(() => {
        const p = position.value;
        const vis = interpolate(p, [0.15, 1, 2, 2.75], [0, 1, 1, 0], Extrapolation.CLAMP);
        return {
            opacity: vis * dim,
            transform: [{ translateX: reduce ? 0 : -(p - 1.5) * width * 0.16 }],
        };
    });
    const fieldW = COLS * FIELD_SIZE + (COLS - 1) * FIELD_GAP_X;
    return (
        <View style={styles.gridClip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <Animated.View style={[styles.field, { width: fieldW }, style]}>
                {Array.from({ length: COLS }, (_, c) => (
                    // columns sit half a step apart, and every product leans its own way: a loose field, not rows
                    <View key={c} style={[styles.column, { marginTop: c % 2 ? (FIELD_SIZE + FIELD_GAP_Y) / 2 : 0 }]}>
                        {Array.from({ length: ROWS }, (_, r) => {
                            const i = c * ROWS + r;
                            const src = tiles[offset + i] || null;
                            // dark mode: only true cut-outs; faded white-background photos would read as grey boxes
                            const show = src && (!isDark || src.cutout);
                            return (
                                <View key={r} style={{ transform: [{ rotate: `${((i * 37) % 17) - 8}deg` }] }}>
                                    {show ? <FloatingProduct source={src} size={FIELD_SIZE} /> : <View style={{ width: FIELD_SIZE, height: FIELD_SIZE }} />}
                                </View>
                            );
                        })}
                    </View>
                ))}
            </Animated.View>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    progress: { flexDirection: 'row', gap: SEG_GAP, height: 4, marginHorizontal: space.lg, marginTop: space.xs, marginBottom: space.sm },
    segment: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: t.colors.hairline },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.brand },
    gridClip: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '78%',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    field: { flexDirection: 'row', gap: FIELD_GAP_X },
    column: { gap: FIELD_GAP_Y },
}));
