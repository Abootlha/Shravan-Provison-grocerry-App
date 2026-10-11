/**
 * DeliveryStepper — Placed → Packed → On the way → Delivered.
 * The connecting line fills with a spring (ProgressBar = translateX, never width); each node
 * cross-fades to brand violet and pops once when it is reached (trigger-based, no idle loop).
 * Pending nodes: surface with a hairline border. The current step label is violet.
 *
 * Props: status, isHi
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { springs, easings } from '../../theme/motion';
import { ProgressBar, Text } from '../../components/ui';
import { getStepIndex } from '../orders/orderUtils';
import { STEP_LABELS } from './trackingCopy';

const NODE = 36;
const ICONS = ['receipt-text-check-outline', 'package-variant-closed', 'moped', 'home-variant'];

function StepNode({ index, reached, current, label }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const on = useSharedValue(reached ? 1 : 0);
    const scale = useSharedValue(1);

    // First paint: nodes light left → right (60 ms apart). A live step change: the node waits for the
    // springing line to arrive (~260 ms), then lights and pops once.
    const mounted = useRef(false);
    useEffect(() => {
        const wasOn = on.value >= 0.5;
        const delay = mounted.current ? (reached && !wasOn ? 260 : 0) : index * 60;
        mounted.current = true;
        on.value = withDelay(delay, withTiming(reached ? 1 : 0, { duration: 220, easing: easings.out }));
        if (reached && !wasOn && !reduce) {
            scale.value = withDelay(delay, withSequence(withSpring(1.12, springs.bouncy), withSpring(1, springs.snappy)));
        }
    }, [reached, index, reduce, on, scale]);

    const nodeStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(on.value, [0, 1], [colors.surface, colors.brand]),
        borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.brand]),
        transform: [{ scale: scale.value }],
    }));

    return (
        <View style={styles.step}>
            <Animated.View style={[styles.node, nodeStyle]}>
                <MaterialCommunityIcons name={ICONS[index]} size={18} color={reached ? colors.onBrand : colors.inkMuted} />
            </Animated.View>
            <Text
                variant="caption"
                weight={current ? 'bold' : 'medium'}
                color={current ? 'brand' : reached ? 'ink' : 'muted'}
                align="center"
                numberOfLines={1}
            >
                {label}
            </Text>
        </View>
    );
}

export function DeliveryStepper({ status, isHi }) {
    const styles = useStyles();
    const idx = getStepIndex(status);
    const labels = isHi ? STEP_LABELS.hi : STEP_LABELS.en;
    return (
        <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${isHi ? 'डिलीवरी प्रगति' : 'Delivery progress'}: ${labels[Math.max(0, idx)]}`}
            accessibilityValue={{ min: 0, max: 3, now: Math.max(0, idx) }}
        >
            <View style={[styles.track, { pointerEvents: 'none' }]}>
                <ProgressBar value={Math.max(0, idx) / 3} height={2} />
            </View>
            <View style={styles.row}>
                {labels.map((label, i) => (
                    <StepNode key={label} index={i} label={label} reached={i <= idx} current={i === idx && idx < 3} />
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles(() => ({
    // Line runs from the centre of the first node to the centre of the last (each step is 1/4 wide).
    track: { position: 'absolute', top: NODE / 2 - 1, left: '12.5%', right: '12.5%' },
    row: { flexDirection: 'row' },
    step: { flex: 1, alignItems: 'center', gap: space.sm },
    node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
}));

export default DeliveryStepper;
