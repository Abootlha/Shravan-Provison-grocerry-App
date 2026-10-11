/**
 * RotatingPlaceholder — cycling hint text: a static prefix plus an item that slides up
 * and fades to the next one ("Search for 'milk'" → "Search for 'atta'").
 * Render it absolutely over an empty TextInput and hide it once the user types.
 *
 * Props
 *   items      string[] (required)
 *   prefix     string (default 'Search for ')
 *   quote      boolean — wrap item in quotes (default true)
 *   interval   ms between changes (default durations.rotate = 3000 — functional hint, kept calm)
 *   paused     boolean — stop cycling (e.g. while the input is focused)
 *   variant    Text variant (default 'body')
 *   color      Text colour token (default 'muted')
 *   style      container style
 *
 * Example
 *   <View style={styles.search}>
 *     <TextInput value={q} onChangeText={setQ} style={StyleSheet.absoluteFill} />
 *     {!q && <RotatingPlaceholder items={['milk', 'bread', 'eggs']} paused={focused} pointerEvents="none" />}
 *   </View>
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { type } from '../../constants/theme';
import { springs, durations } from '../../theme/motion';
import { Text, resolveTextColor } from './Text';
import { useTheme } from '../../theme';

function Line({ text, mode, h, textStyle, reduce }) {
    const t = useSharedValue(mode === 'static' ? 1 : 0);
    useEffect(() => {
        if (mode !== 'static') t.value = reduce ? withTiming(1, { duration: durations.base }) : withSpring(1, springs.gentle);
    }, []);
    const anim = useAnimatedStyle(() => {
        const dy = reduce ? 0 : h * 0.9;
        if (mode === 'out') return { opacity: 1 - t.value, transform: [{ translateY: -t.value * dy }] };
        if (mode === 'in') return { opacity: t.value, transform: [{ translateY: (1 - t.value) * dy }] };
        return { opacity: 1 };
    });
    return (
        <Animated.Text numberOfLines={1} style={[textStyle, styles.abs, anim]}>
            {text}
        </Animated.Text>
    );
}

export function RotatingPlaceholder({
    items = [],
    prefix = 'Search for ',
    quote = true,
    interval = durations.rotate,
    paused = false,
    variant = 'body',
    color = 'muted',
    style,
    ...rest
}) {
    const reduce = useReducedMotion();
    const { colors: palette } = useTheme();
    const [st, setSt] = useState({ i: 0, prev: null, v: 0 });

    useEffect(() => {
        if (paused || items.length < 2) return undefined;
        const id = setInterval(() => {
            setSt((s) => ({ i: (s.i + 1) % items.length, prev: s.i, v: s.v + 1 }));
        }, interval);
        return () => clearInterval(id);
    }, [paused, items.length, interval]);

    const base = type[variant] || type.body;
    const textStyle = [base, { color: resolveTextColor(color, palette) }];
    const h = base.lineHeight;
    const fmt = (i) => (items[i] == null ? '' : quote ? `'${items[i]}'` : items[i]);

    return (
        <View style={[styles.row, style]} accessibilityLabel={`${prefix}${fmt(st.i)}`} {...rest}>
            {/* trailing spaces collapse at a flex boundary on web, so the gap is a margin */}
            <Text variant={variant} color={color} numberOfLines={1}>
                {prefix.trimEnd()}
            </Text>
            <View style={[styles.slot, { height: h, marginLeft: /\s$/.test(prefix) ? 4 : 0 }]}>
                {st.prev != null ? <Line key={`o${st.v}`} text={fmt(st.prev)} mode="out" h={h} textStyle={textStyle} reduce={reduce} /> : null}
                <Line key={`i${st.v}`} text={fmt(st.i)} mode={st.v === 0 ? 'static' : 'in'} h={h} textStyle={textStyle} reduce={reduce} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    slot: { flex: 1, overflow: 'hidden' },
    abs: { position: 'absolute', left: 0, right: 0, top: 0 },
});

export default RotatingPlaceholder;
