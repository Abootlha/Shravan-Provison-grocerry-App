/**
 * HeartBurst — the wishlist "pop": a ring of six small particles that shoot out from the heart's
 * centre, shrink and fade (≈520 ms, drawer ease-out, UI thread). Paired with IconButton's own spring pop
 * on the glyph, it reads as one moment. Rare by nature (saving a product), so it may delight.
 *
 *   const burst = useRef(null);
 *   <View>
 *     <IconButton … />
 *     <HeartBurst ref={burst} />      // absolute, centred on the parent, never touchable
 *   </View>
 *   burst.current?.fire();
 *
 * Props: size (particle travel radius, default 20), style.
 * Reduced motion: fire() is a no-op (the glyph's colour change still shows the state).
 */
import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { easings } from '../../theme/motion';

const COUNT = 6;
const DOT = 5;
const DURATION = 520;

const Particle = memo(function Particle({ t, angle, dist, color }) {
    const style = useAnimatedStyle(() => {
        const k = t.value;
        return {
            opacity: k === 0 ? 0 : k < 0.6 ? 1 : (1 - k) / 0.4,
            transform: [
                { translateX: Math.cos(angle) * dist * (0.55 + 0.45 * k) },
                { translateY: Math.sin(angle) * dist * (0.55 + 0.45 * k) },
                { scale: 1.2 - 0.7 * k },
            ],
        };
    });
    return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
});

export const HeartBurst = forwardRef(function HeartBurst({ size = 20, style }, ref) {
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const t = useSharedValue(0);
    // Particles mount on the first fire only: every ProductCard carries a HeartBurst, and six idle
    // animated dots per card were a large share of each card's views when lists mount new cells.
    const [armed, setArmed] = useState(false);
    const pending = useRef(false);

    const play = () => {
        t.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: DURATION, easing: easings.drawer }));
    };

    useImperativeHandle(
        ref,
        () => ({
            fire() {
                if (reduce) return;
                if (!armed) {
                    pending.current = true;
                    setArmed(true);
                    return;
                }
                play();
            },
        }),
        [reduce, armed]
    );

    // First fire: start once the particles exist, so their styles see the whole run.
    useEffect(() => {
        if (armed && pending.current) {
            pending.current = false;
            play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [armed]);

    if (!armed) return null;

    return (
        <View style={[styles.origin, style, { pointerEvents: 'none' }]}>
            {Array.from({ length: COUNT }).map((_, i) => (
                <Particle
                    key={i}
                    t={t}
                    angle={(i / COUNT) * Math.PI * 2 - Math.PI / 2}
                    dist={i % 2 ? size * 0.8 : size}
                    color={i % 2 ? colors.brand : colors.error}
                />
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    origin: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        position: 'absolute',
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
    },
});

export default HeartBurst;
