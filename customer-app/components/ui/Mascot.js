/**
 * Mascot — "Thaila", a plain paper grocery bag with a brand-violet rim and handle.
 * Flat and calm (DESIGN.md "Icons & illustration"): neutral body + hairline edge, violet rim,
 * violet handle and a small violet leaf, ink face. No gradients, no gold, no specular glints, no glow.
 *
 * Where: ONLY empty / error / unserviceable states (EmptyState, payment failed, no service).
 * Not on login / onboarding / loading spinners.
 *
 * Motion: STATIC. One entrance (fade + settle from 0.94, ~350ms) when it mounts — no bob, no blink,
 * no floating "z"s, no loops. Reduced motion: no entrance, it is simply there.
 *
 * Props
 *   mood      'happy' (default) | 'sad' (alias 'unavailable') | 'sleepy' (alias 'empty') | 'loading'
 *   size      number — width in px (default 120; height ≈ size × 1.08 including the ground line)
 *   animated  boolean — play the single entrance (default true)
 *   style
 *
 * Moods (face only; the bag never moves)
 *   happy    small smile                      → success / welcome
 *   sad      flat brows + small frown, -4° tilt → errors, out of stock, no service
 *   sleepy   closed eyes                       → empty cart / no orders / empty search
 *   loading  eyes up, small "o"                → long waits
 *
 * Example
 *   <Mascot mood="sleepy" size={140} />
 */
import React, { useEffect } from 'react';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';

const BODY = 'M24 40 H96 L101 101 Q102 112 91 112 H29 Q18 112 19 101 Z';
const RIM = 'M21 35 Q21 31 25 31 H95 Q99 31 99 35 V42 Q99 46 95 46 H25 Q21 46 21 42 Z';
const HANDLE = 'M40 33 C40 6 80 6 80 33';
const LEAF = 'M66 33 C68 24 76 18 86 20 C83 29 75 34 66 33 Z';
const MOODS = { unavailable: 'sad', empty: 'sleepy' };

function Face({ mood, ink }) {
    switch (mood) {
        case 'sad':
            return (
                <G>
                    <Path d="M40 60 L50 58" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
                    <Path d="M80 60 L70 58" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
                    <Ellipse cx="46.5" cy="69" rx="3.6" ry="4.6" fill={ink} />
                    <Ellipse cx="73.5" cy="69" rx="3.6" ry="4.6" fill={ink} />
                    <Path d="M53 88 Q60 82.5 67 88" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                </G>
            );
        case 'sleepy':
            return (
                <G>
                    <Path d="M41 70 Q46.5 74.5 52 70" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                    <Path d="M68 70 Q73.5 74.5 79 70" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                    <Path d="M56 86 H64" stroke={ink} strokeWidth="3" strokeLinecap="round" />
                </G>
            );
        case 'loading':
            return (
                <G>
                    <Ellipse cx="46.5" cy="66" rx="3.6" ry="4.6" fill={ink} />
                    <Ellipse cx="73.5" cy="66" rx="3.6" ry="4.6" fill={ink} />
                    <Ellipse cx="60" cy="85" rx="3.6" ry="4.2" fill={ink} />
                </G>
            );
        default:
            return (
                <G>
                    <Ellipse cx="46.5" cy="68" rx="3.6" ry="4.6" fill={ink} />
                    <Ellipse cx="73.5" cy="68" rx="3.6" ry="4.6" fill={ink} />
                    <Path d="M51 82 Q60 90 69 82" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
                </G>
            );
    }
}

export function Mascot({ mood: moodProp = 'happy', size = 120, animated = true, style }) {
    const mood = MOODS[moodProp] || moodProp;
    const { colors, isDark } = useTheme();
    const reduce = useReducedMotion();
    const enter = animated && !reduce;
    const p = useSharedValue(enter ? 0 : 1);
    const scale = useSharedValue(enter ? 0.94 : 1);

    // single entrance on mount — nothing repeats
    useEffect(() => {
        if (!enter) return;
        p.value = withTiming(1, { duration: durations.slow, easing: easings.out });
        scale.value = withSpring(1, springs.gentle);
    }, []);

    const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: scale.value }] }));

    // flat palette: neutral paper body + hairline, brand violet rim / handle / leaf, ink face
    const body = isDark ? '#2C2C2C' : colors.surface;
    const edge = isDark ? 'rgba(255,255,255,0.14)' : colors.borderStrong;
    const violet = colors.brand;
    const ink = colors.ink;
    const ground = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.06)';

    return (
        <Animated.View
            style={[{ width: size, height: size * 1.08 }, anim, style]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Shopping bag illustration, ${mood}`}
        >
            <Svg width={size} height={size * 1.08} viewBox="0 0 120 130">
                {/* flat ground line */}
                <Ellipse cx="60" cy="116" rx="40" ry="4" fill={ground} />
                <G transform={mood === 'sad' ? 'rotate(-4 60 72)' : undefined}>
                    <Path d={HANDLE} stroke={violet} strokeWidth="5" fill="none" strokeLinecap="round" />
                    <Path d={LEAF} fill={violet} />
                    <Path d={BODY} fill={body} stroke={edge} strokeWidth="1.5" strokeLinejoin="round" />
                    <Path d={RIM} fill={violet} />
                    <Face mood={mood} ink={ink} />
                </G>
            </Svg>
        </Animated.View>
    );
}

export default Mascot;
