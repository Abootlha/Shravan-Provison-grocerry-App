/**
 * ConfettiBurst — a small, fire-and-forget particle pop (~16 pieces) in brand colours.
 * Renders nothing interactive (pointerEvents none). Place it over the element that
 * celebrates (e.g. centred on a SuccessCheck) and call ref.fire().
 *
 * Props
 *   count     number of particles (default 16)
 *   spread    max travel radius in px (default 110)
 *   colors    array of colours (default: brand violet + savings green + neutral greys — nothing else)
 *   style     positioning of the burst origin box (default: fills parent, origin at centre)
 *   ref       { fire() }
 *
 * Example
 *   const confetti = useRef(null);
 *   <View>
 *     <SuccessCheck status="success" onDone={() => confetti.current?.fire()} />
 *     <ConfettiBurst ref={confetti} />
 *   </View>
 *
 * Reduced motion: fire() is a no-op.
 */
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { makeThemed } from '../../theme';

// Celebration palette (DESIGN.md): brand violet + savings green + neutral greys. No gold, no rainbow.
const useDefaultColors = makeThemed(({ colors: c, isDark }) => [
    c.brand,
    c.success,
    isDark ? '#5C5C5C' : '#C4C4BF',
    c.brand,
    isDark ? '#8F8F8F' : '#8A8A87',
    c.success,
    isDark ? '#3A3A3A' : '#DADAD6',
]);

function Particle({ p, t }) {
    const anim = useAnimatedStyle(() => {
        const k = t.value;
        const x = p.vx * k;
        const y = p.vy * k + 140 * k * k; // gravity
        return {
            opacity: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3,
            transform: [
                { translateX: x },
                { translateY: y },
                { rotate: `${p.rot * k}deg` },
                { scale: k < 0.12 ? 0.6 + k * 3.3 : 1 },
            ],
        };
    });
    return (
        <Animated.View
            style={[
                styles.p,
                {
                    width: p.w,
                    height: p.h,
                    borderRadius: p.round ? p.w / 2 : 2,
                    backgroundColor: p.color,
                    marginLeft: -p.w / 2,
                    marginTop: -p.h / 2,
                },
                anim,
            ]}
        />
    );
}

export const ConfettiBurst = forwardRef(function ConfettiBurst(
    { count = 16, spread = 110, colors: colorsProp, style },
    ref,
) {
    const defaults = useDefaultColors();
    const colors = colorsProp || defaults;
    const reduce = useReducedMotion();
    const t = useSharedValue(0);
    const [seed, setSeed] = useState(0);

    const particles = useMemo(() => {
        if (!seed) return [];
        return Array.from({ length: count }).map((_, i) => {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = spread * (0.55 + Math.random() * 0.45);
            const round = Math.random() < 0.35;
            const w = round ? 7 : 5 + Math.random() * 4;
            return {
                vx: Math.cos(angle) * dist,
                vy: Math.sin(angle) * dist - spread * 0.35,
                rot: (Math.random() - 0.5) * 720,
                color: colors[i % colors.length],
                w,
                h: round ? w : w * 1.8,
                round,
            };
        });
    }, [seed]);

    useImperativeHandle(
        ref,
        () => ({
            fire() {
                if (reduce) return;
                t.value = 0;
                setSeed((s) => s + 1);
                t.value = withTiming(1, { duration: 950, easing: Easing.bezier(0.15, 0.6, 0.3, 1) });
            },
        }),
        [reduce],
    );

    return (
        <View style={[StyleSheet.absoluteFill, styles.origin, style, { pointerEvents: 'none' }]}>
            <View style={styles.center}>
                {particles.map((p, i) => (
                    <Particle key={`${seed}-${i}`} p={p} t={t} />
                ))}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    origin: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
    center: { width: 0, height: 0, overflow: 'visible' },
    p: { position: 'absolute', left: 0, top: 0 },
});

export default ConfettiBurst;
