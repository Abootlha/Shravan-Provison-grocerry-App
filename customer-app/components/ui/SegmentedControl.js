/**
 * SegmentedControl — equal-width segments on a sunken track with a raised thumb that springs to the
 * selected segment (UI thread, transform only). ThemeModeControl — the System / Light / Dark switch
 * built on it, wired to the theme runtime (Profile → Appearance mounts it).
 *
 * <SegmentedControl> props
 *   options     [{ key, label, icon?: MaterialCommunityIcons name, accessibilityLabel? }]  (2–4 items)
 *   value       selected key (controlled)
 *   onChange    (key) => void
 *   size        'md' (44, default) | 'sm' (36)
 *   haptic      default 'selection'
 *   accessibilityLabel  label for the group (e.g. "Theme")
 *   style
 *
 * <ThemeModeControl> props
 *   labels      { system, light, dark, title } — i18n (defaults: 'System' / 'Light' / 'Dark' / 'Theme')
 *   size, style
 *   Reads and writes useTheme().mode / setMode; the choice is persisted by ThemeProvider.
 *
 * Accessibility: radiogroup of radios with checked state; each segment ≥44pt tall at 'md'.
 * Reduced motion: the thumb moves with a short fade-timed slide instead of a spring.
 *
 * Example
 *   <ThemeModeControl labels={{ system: t('system'), light: t('light'), dark: t('dark') }} />
 *   <SegmentedControl options={[{ key: 'veg', label: 'Veg' }, { key: 'all', label: 'All' }]} value={v} onChange={setV} />
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space, type } from '../../constants/theme';
import { springs, durations, easings } from '../../theme/motion';
import { makeStyles, useTheme } from '../../theme';
import { PressableScale } from './PressableScale';

const PAD = 3;
const SIZES = { md: { h: 44, icon: 18 }, sm: { h: 36, icon: 16 } };

export function SegmentedControl({ options = [], value, onChange, size = 'md', haptic = 'selection', accessibilityLabel, style }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const sz = SIZES[size] || SIZES.md;
    const [w, setW] = useState(0);
    const n = Math.max(1, options.length);
    const segW = w ? (w - PAD * 2) / n : 0;
    const index = Math.max(0, options.findIndex((o) => o.key === value));

    const thumb = useAnimatedStyle(() => {
        if (!segW) return { opacity: 0 };
        const x = index * segW;
        return {
            opacity: 1,
            width: segW,
            transform: [{ translateX: reduce ? withTiming(x, { duration: durations.fast, easing: easings.out }) : withSpring(x, springs.snappy) }],
        };
    }, [segW, index, reduce]);

    return (
        <View
            accessibilityRole="radiogroup"
            accessibilityLabel={accessibilityLabel}
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
            style={[styles.track, { height: sz.h }, style]}
        >
            <Animated.View style={[styles.thumb, thumb, { pointerEvents: 'none' }]} />
            {options.map((o) => {
                const on = o.key === value;
                const fg = on ? colors.ink : colors.inkMuted;
                return (
                    <PressableScale
                        key={o.key}
                        onPress={() => !on && onChange && onChange(o.key)}
                        haptic={on ? false : haptic}
                        scaleTo={0.97}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, selected: on }}
                        accessibilityLabel={o.accessibilityLabel || o.label}
                        style={styles.segment}
                    >
                        {o.icon ? <MaterialCommunityIcons name={o.icon} size={sz.icon} color={fg} style={styles.icon} /> : null}
                        <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: fg }]}>
                            {o.label}
                        </Animated.Text>
                    </PressableScale>
                );
            })}
        </View>
    );
}

export function ThemeModeControl({ labels, size, style }) {
    const { mode, setMode } = useTheme();
    const l = { system: 'System', light: 'Light', dark: 'Dark', title: 'Theme', ...labels };
    return (
        <SegmentedControl
            size={size}
            style={style}
            accessibilityLabel={l.title}
            value={mode}
            onChange={setMode}
            options={[
                { key: 'system', label: l.system, icon: 'theme-light-dark' },
                { key: 'light', label: l.light, icon: 'white-balance-sunny' },
                { key: 'dark', label: l.dark, icon: 'weather-night' },
            ]}
        />
    );
}

const useStyles = makeStyles((t) => ({
    track: {
        flexDirection: 'row',
        alignItems: 'stretch',
        padding: PAD,
        borderRadius: radii.button,
        backgroundColor: t.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    thumb: {
        position: 'absolute',
        top: PAD,
        bottom: PAD,
        left: PAD,
        borderRadius: radii.chip,
        backgroundColor: t.colors.surfaceRaised,
        borderWidth: 1,
        borderColor: t.colors.border,
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.sm,
        borderRadius: radii.chip,
    },
    icon: { marginRight: space.xs + 2 },
    label: { ...type.label, fontFamily: type.button.fontFamily },
}));

export default SegmentedControl;
