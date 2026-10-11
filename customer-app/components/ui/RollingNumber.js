/**
 * RollingNumber — odometer-style number. Only the characters that change roll:
 * on increase the old glyph slides up and out while the new one rises from below;
 * on decrease the motion reverses. Uses tabular numerals so width never jitters.
 *
 * Props
 *   value       number | string (required)
 *   format      (value) => string  — default: Indian grouping for numbers ("1,24,999")
 *   currency    boolean | 'INR' — money mode: "₹" prefix (unless you pass one), Indian grouping and up to
 *               2 decimals ("₹1,249.50"; whole rupees stay "₹1,249"); negative values render "₹−40"
 *   decimals    fixed decimals in currency mode (e.g. 2 → "₹48.00"); default: 0–2 as needed
 *   prefix      string rendered before (e.g. "₹") — does not roll
 *   suffix      string rendered after (e.g. " items")
 *   variant     Text variant for size/weight (default 'counter')
 *   color       colour string or Text colour token
 *   direction   'auto' (compare numerically) | 'up' | 'down'
 *   style       extra TextStyle (lineHeight here controls the roll distance)
 *
 * Example
 *   <RollingNumber value={quantity} variant="counter" color="inverse" />
 *   <RollingNumber value={total} currency variant="priceLarge" />      // totals, bills, savings
 *   (AnimatedNumber is an alias of RollingNumber.)
 *
 * Notes: each roll layer mounts fresh, so the first frame is always correct (no flash
 * of the new digit in place). Reduced motion swaps glyphs instantly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { type } from '../../constants/theme';
import { springs } from '../../theme/motion';
import { resolveTextColor } from './Text';
import { useTheme } from '../../theme';

const defaultFormat = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));
const moneyFormat = (decimals) => (v) => {
    const n = Number(v) || 0;
    const s = Math.abs(n).toLocaleString('en-IN', {
        minimumFractionDigits: decimals ?? (Number.isInteger(n) ? 0 : 2),
        maximumFractionDigits: decimals ?? 2,
    });
    return n < 0 ? `−${s}` : s;
};

function RollLayer({ char, mode, dir, height, textStyle }) {
    // mode: 'static' | 'in' | 'out'
    const t = useSharedValue(mode === 'static' ? 1 : 0);
    useEffect(() => {
        if (mode !== 'static') t.value = withSpring(1, springs.snappy);
    }, []);
    const anim = useAnimatedStyle(() => {
        if (mode === 'in') {
            return { opacity: Math.min(1, t.value * 1.4), transform: [{ translateY: (1 - t.value) * height * dir }] };
        }
        if (mode === 'out') {
            return { opacity: 1 - Math.min(1, t.value * 1.4), transform: [{ translateY: -t.value * height * dir }] };
        }
        return { opacity: 1 };
    });
    return (
        <Animated.Text allowFontScaling={false} style={[textStyle, styles.layer, anim]}>
            {char}
        </Animated.Text>
    );
}

function RollingChar({ char, dir, height, textStyle, enterOnMount, reduce }) {
    const [st, setSt] = useState(() => ({ char, prev: null, v: 0, dir, entering: enterOnMount }));
    if (st.char !== char) {
        setSt({ char, prev: st.char, v: st.v + 1, dir, entering: false });
    }
    const animate = !reduce;
    const inMode = animate && (st.v > 0 || st.entering) ? 'in' : 'static';
    return (
        <View style={[styles.charBox, { height }]}>
            {/* sizer: defines width from the current glyph */}
            <RNText allowFontScaling={false} style={[textStyle, styles.sizer]}>
                {st.char}
            </RNText>
            {animate && st.prev != null ? (
                <RollLayer key={`o${st.v}`} char={st.prev} mode="out" dir={st.dir} height={height} textStyle={textStyle} />
            ) : null}
            <RollLayer key={`i${st.v}`} char={st.char} mode={inMode} dir={st.dir} height={height} textStyle={textStyle} />
        </View>
    );
}

export function RollingNumber({
    value,
    format: formatProp,
    currency = false,
    decimals,
    prefix: prefixProp,
    suffix = '',
    variant = 'counter',
    color = 'ink',
    direction = 'auto',
    style,
    accessibilityLabel,
}) {
    const format = formatProp || (currency ? moneyFormat(decimals) : defaultFormat);
    const prefix = prefixProp ?? (currency ? '₹' : '');
    const reduce = useReducedMotion();
    const { colors: palette } = useTheme();
    const base = type[variant] || type.counter;
    const flat = StyleSheet.flatten([base, { color: resolveTextColor(color, palette), fontVariant: ['tabular-nums'] }, style]);
    const height = flat.lineHeight || Math.round((flat.fontSize || 14) * 1.3);
    const textStyle = { ...flat, lineHeight: height };

    const [track, setTrack] = useState({ value, dir: 1 });
    if (track.value !== value) {
        const a = Number(value);
        const b = Number(track.value);
        let dir = 1;
        if (direction === 'down') dir = -1;
        else if (direction === 'auto' && !Number.isNaN(a) && !Number.isNaN(b)) dir = a >= b ? 1 : -1;
        setTrack({ value, dir });
    }

    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
    }, []);

    const str = format(value);
    const chars = str.split('');
    const len = chars.length;

    return (
        <View
            style={styles.row}
            accessible
            accessibilityRole="text"
            accessibilityLabel={accessibilityLabel || `${prefix}${str}${suffix}`}
        >
            {prefix ? (
                <RNText allowFontScaling={false} style={textStyle}>
                    {prefix}
                </RNText>
            ) : null}
            {chars.map((c, i) => (
                <RollingChar
                    // key by position from the right so units stay units when length changes
                    key={`p${len - 1 - i}`}
                    char={c}
                    dir={track.dir}
                    height={height}
                    textStyle={textStyle}
                    enterOnMount={mounted.current}
                    reduce={reduce}
                />
            ))}
            {suffix ? (
                <RNText allowFontScaling={false} style={textStyle}>
                    {suffix}
                </RNText>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    charBox: { overflow: 'hidden', justifyContent: 'center' },
    sizer: { opacity: 0 },
    layer: { position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center' },
});

export default RollingNumber;

/** Alias — same component (motion-spec name). */
export const AnimatedNumber = RollingNumber;
