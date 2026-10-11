import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale, Text } from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, press, springs } from '../../theme/motion';

const RADIO = 22;

/** Radio that fills violet and springs a white check in when selected. */
export const Radio = ({ selected }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    // stops captured per scheme, so a theme switch mid-session repaints the ring correctly
    const off = colors.borderStrong;
    const on = colors.brand;
    const offFill = colors.surface;
    const reduce = useReducedMotion();
    const s = useSharedValue(selected ? 1 : 0);
    useEffect(() => {
        s.value = reduce
            ? withTiming(selected ? 1 : 0, { duration: durations.fast, easing: easings.out })
            : withSpring(selected ? 1 : 0, springs.snappy);
    }, [selected, reduce]);
    const ring = useAnimatedStyle(() => ({
        borderColor: interpolateColor(Math.min(s.value, 1), [0, 1], [off, on]),
        backgroundColor: interpolateColor(Math.min(s.value, 1), [0, 1], [offFill, on]),
    }));
    const check = useAnimatedStyle(() => ({
        opacity: Math.min(s.value, 1),
        transform: [{ scale: reduce ? 1 : 0.6 + s.value * 0.4 }],
    }));
    return (
        <Animated.View style={[styles.radio, ring]}>
            <Animated.View style={check}>
                <MaterialCommunityIcons name="check-bold" size={13} color={colors.onBrand} />
            </Animated.View>
        </Animated.View>
    );
};

/**
 * Selectable row for the address and payment sheets: sunken icon tile (or a custom
 * `leading` element), title + optional subtitle, and the spring radio.
 */
function RadioRowBase({ icon, leading, title, subtitle, badge, selected, onPress, accessibilityLabel }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <PressableScale
            onPress={onPress}
            haptic="selection"
            scaleTo={press.subtle}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={accessibilityLabel || [title, subtitle].filter(Boolean).join(', ')}
            style={styles.row}
        >
            {leading || (
                <View style={styles.circle}>
                    <MaterialCommunityIcons name={icon} size={20} color={colors.inkSecondary} />
                </View>
            )}
            <View style={styles.texts}>
                <View style={styles.titleRow}>
                    <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>{title}</Text>
                    {badge || null}
                </View>
                {subtitle ? <Text variant="caption" color="muted" numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            <Radio selected={selected} />
        </PressableScale>
    );
}

export const RadioRow = memo(RadioRowBase);

const useStyles = makeStyles((t) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT + space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
    },
    circle: {
        width: 40,
        height: 40,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    title: { flexShrink: 1 },
    radio: {
        width: RADIO,
        height: RADIO,
        borderRadius: radii.pill,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export default RadioRow;
