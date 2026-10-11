import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ConfettiBurst, ProgressBar, Text, haptic } from '../../components/ui';
import { space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { FREE_DELIVERY_AT } from './bill';

const BAR = 6;

/**
 * Free-delivery meter inside the ETA card: a flat savings-green ProgressBar on the hairline
 * track. The fill springs; the copy swaps on the crossing and — only on the crossing, never on
 * mount — one confetti pop + success haptic. Reduced motion: no confetti.
 */
function FreeDeliveryNudgeBase({ itemTotal, gap, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const unlocked = gap <= 0;
    const wasUnlocked = useRef(unlocked);
    const confetti = useRef(null);

    useEffect(() => {
        const crossed = unlocked && !wasUnlocked.current;
        wasUnlocked.current = unlocked;
        if (!crossed) return;
        haptic.success();
        if (!reduce) confetti.current?.fire();
    }, [unlocked, reduce]);

    return (
        <View style={styles.wrap} accessibilityLiveRegion="polite">
            <View style={styles.row}>
                {unlocked ? (
                    <Animated.View key="t-on" entering={layout.enter} style={styles.text}>
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} />
                        <Text variant="label" color="success">
                            {isHi ? 'मुफ़्त डिलीवरी मिल गई' : 'Free delivery unlocked'}
                        </Text>
                    </Animated.View>
                ) : (
                    <View style={styles.text}>
                        <Text variant="label" color="secondary" weight="medium">
                            {isHi ? (
                                <>मुफ़्त डिलीवरी के लिए <Text variant="label" color="ink">₹{gap}</Text> और जोड़ें</>
                            ) : (
                                <>Add <Text variant="label" color="ink">₹{gap}</Text> more for free delivery</>
                            )}
                        </Text>
                    </View>
                )}
                <ConfettiBurst ref={confetti} count={14} spread={110} />
            </View>
            <ProgressBar
                value={itemTotal / FREE_DELIVERY_AT}
                height={BAR}
                color={colors.success}
                trackColor={colors.hairline}
                accessibilityLabel={isHi ? 'मुफ़्त डिलीवरी प्रगति' : 'Free delivery progress'}
            />
        </View>
    );
}

export const FreeDeliveryNudge = memo(FreeDeliveryNudgeBase);

const useStyles = makeStyles(() => ({
    wrap: { gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    text: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

export default FreeDeliveryNudge;
