import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { easings, springs } from '../../theme/motion';
import { GROUP_RADIUS } from './layout';

/** Scooter tile. Trigger-based only: when the shipment changes (`pulseKey`) the scooter hops once, then rests. */
const Scooter = ({ pulseKey }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const hop = useSharedValue(0);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (reduce) return;
        hop.value = withSequence(withTiming(-3, { duration: 90, easing: easings.out }), withSpring(0, springs.bouncy));
    }, [pulseKey, reduce]);

    const bikeStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));

    return (
        <View style={styles.tile}>
            <Animated.View style={bikeStyle}>
                <MaterialCommunityIcons name="moped" size={22} color={colors.ink} />
            </Animated.View>
        </View>
    );
};

function DeliveryEtaCardBase({ minutes = 10, itemCount = 0, isHi, children }) {
    const styles = useStyles();
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.row}>
                <Scooter pulseKey={itemCount} />
                <View style={styles.texts}>
                    <Text variant="title" weight="medium" accessibilityRole="header">
                        {isHi ? 'डिलीवरी ' : 'Delivering in '}
                        <Text variant="title">{isHi ? `${minutes} मिनट में` : `${minutes} mins`}</Text>
                    </Text>
                    <Text variant="caption" color="muted">
                        {isHi ? `${itemCount} सामान की शिपमेंट` : `Shipment of ${itemCount} item${itemCount === 1 ? '' : 's'}`}
                    </Text>
                </View>
            </View>
            {children ? <View style={styles.footer}>{children}</View> : null}
        </Card>
    );
}

export const DeliveryEtaCard = memo(DeliveryEtaCardBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
    footer: {
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.lg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.colors.hairline,
    },
    tile: {
        width: 44,
        height: 44,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
}));

export default DeliveryEtaCard;
