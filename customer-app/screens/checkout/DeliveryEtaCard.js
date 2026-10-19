import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
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
const Scooter = ({ pulseKey, icon = 'moped' }) => {
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
                <MaterialCommunityIcons name={icon} size={18} color={colors.ink} />
            </Animated.View>
        </View>
    );
};

/**
 * Slim delivery line at the top of checkout: "Delivering in 10 mins" (or the closed line), with
 * the free-delivery meter as `children`. The item count lives on the items card, not here.
 *
 * minutes     store settings estimatedDeliveryMinutes, or null (then no time is promised)
 * closedLine  "Closed · opens at 8 AM" when the store is closed (replaces the delivery line)
 */
function DeliveryEtaCardBase({ minutes = null, closedLine = null, itemCount = 0, isHi, children }) {
    const styles = useStyles();
    let title;
    if (closedLine) {
        title = <Text variant="bodyStrong" accessibilityRole="header">{closedLine}</Text>;
    } else if (minutes) {
        title = (
            <Text variant="bodyStrong" weight="medium" accessibilityRole="header">
                {isHi ? 'डिलीवरी ' : 'Delivering in '}
                <Text variant="bodyStrong">{isHi ? `${minutes} मिनट में` : `${minutes} mins`}</Text>
            </Text>
        );
    } else {
        title = <Text variant="bodyStrong" accessibilityRole="header">{isHi ? 'आपकी डिलीवरी' : 'Your delivery'}</Text>;
    }
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.row} accessibilityLiveRegion={closedLine ? 'polite' : undefined}>
                <Scooter pulseKey={itemCount} icon={closedLine ? 'store-clock-outline' : 'moped'} />
                <View style={styles.texts}>
                    {title}
                    {closedLine ? (
                        <Text variant="caption" color="muted">
                            {isHi ? 'आपकी कार्ट सहेजी हुई है। स्टोर खुलने पर ऑर्डर करें।' : 'Your cart is saved. You can order when the store opens.'}
                        </Text>
                    ) : null}
                </View>
            </View>
            {children ? <View style={styles.footer}>{children}</View> : null}
        </Card>
    );
}

export const DeliveryEtaCard = memo(DeliveryEtaCardBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
    footer: {
        paddingHorizontal: space.lg,
        paddingTop: 0,
        paddingBottom: space.md,
    },
    tile: {
        width: 32,
        height: 32,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
}));

export default DeliveryEtaCard;
