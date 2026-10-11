/**
 * AccordionSection — a PDP detail section. The chevron rotates on a spring; the body
 * fades + rises in, and sibling sections spring into place via a layout transition
 * (no height animation on the JS thread).
 *
 * Props: title, expanded, onToggle, children, last (hide the divider),
 *        animateLayout (false for the section being toggled: its own size change is not
 *        animated — that would scale its content on web — only the siblings it pushes move)
 */
import React, { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale, Text, Divider } from '../ui';
import { space, HIT } from '../../constants/theme';
import { useTheme, makeStyles } from '../../theme';
import { springs, durations, press } from '../../theme/motion';

export const sectionLayout = LinearTransition.springify()
    .damping(springs.gentle.damping)
    .stiffness(springs.gentle.stiffness)
    .mass(springs.gentle.mass);

const bodyEnter = () => {
    'worklet';
    return {
        initialValues: { opacity: 0, transform: [{ translateY: -8 }] },
        animations: {
            opacity: withTiming(1, { duration: durations.base }),
            transform: [{ translateY: withSpring(0, springs.gentle) }],
        },
    };
};

// Custom layout-animation worklets are native-only; Reanimated web supports only the presets.
const BODY_ENTER = Platform.OS === 'web' ? FadeIn.duration(durations.base) : bodyEnter;

function AccordionSection({ title, expanded, onToggle, children, last = false, animateLayout = true }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const rot = useSharedValue(expanded ? 1 : 0);
    useEffect(() => {
        rot.value = reduce ? (expanded ? 1 : 0) : withSpring(expanded ? 1 : 0, springs.snappy);
    }, [expanded, reduce]);
    const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));

    return (
        <Animated.View layout={animateLayout ? sectionLayout : undefined}>
            <PressableScale
                onPress={onToggle}
                scaleTo={press.subtle}
                haptic="selection"
                style={styles.header}
                accessibilityState={{ expanded }}
                accessibilityLabel={title}
                accessibilityHint={expanded ? 'Collapses section' : 'Expands section'}
            >
                <Text variant="title" style={styles.title} accessibilityRole="header">
                    {title}
                </Text>
                <Animated.View style={chevron}>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={colors.inkSecondary} />
                </Animated.View>
            </PressableScale>
            {expanded ? (
                <Animated.View entering={BODY_ENTER} exiting={FadeOut.duration(durations.instant)} style={styles.body}>
                    {children}
                </Animated.View>
            ) : null}
            {last ? null : <Divider />}
        </Animated.View>
    );
}

const useStyles = makeStyles(() => ({
    header: {
        minHeight: HIT + space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: { flex: 1 },
    body: { paddingBottom: space.lg },
}));

export default memo(AccordionSection);

/** Key/value row used inside sections. */
export const InfoRow = memo(function InfoRow({ label, value, last }) {
    const infoStyles = useInfoStyles();
    return (
    <View style={[infoStyles.row, !last && infoStyles.rule]}>
        {label ? (
            <Text variant="body" color="secondary" style={infoStyles.label}>
                {label}
            </Text>
        ) : null}
        <Text variant="bodyStrong" style={[infoStyles.value, !label && infoStyles.full]}>
            {value}
        </Text>
    </View>
    );
});

const useInfoStyles = makeStyles((t) => ({
    row: { flexDirection: 'row', paddingVertical: space.sm + 2, gap: space.lg },
    rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.hairline },
    label: { flex: 0.45 },
    value: { flex: 0.55, textAlign: 'right' },
    full: { flex: 1, textAlign: 'left' },
}));
