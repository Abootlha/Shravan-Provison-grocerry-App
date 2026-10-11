/**
 * DeliveryOtpCard — the delivery OTP, shown only to the customer while the rider is on the way.
 * A neutral surface card (hairline, radius 12): title + one line of copy, a copy (web) / share
 * (native, no clipboard module installed) text button, and the code as large ink tabular digits
 * on sunken tiles.
 *
 * Motion: when the card appears or the code changes the digits fade in, 50 ms apart (data change only).
 *
 * Props: otp (string), isHi
 */
import React, { useEffect } from 'react';
import { Platform, Share, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { radii, space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { durations, easings } from '../../theme/motion';
import { Button, Card, Text, toast } from '../../components/ui';

const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;
const DIGIT_TYPE = { fontSize: 30, lineHeight: 36, letterSpacing: 0 };

function Digit({ digit, index }) {
    const styles = useStyles();
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = 0;
        p.value = withDelay(index * 50, withTiming(1, { duration: durations.base, easing: easings.out }));
    }, [digit, index, p]);
    const style = useAnimatedStyle(() => ({ opacity: p.value }));
    return (
        <Animated.View style={[styles.digit, style]}>
            <Text variant="priceHero" tabular selectable style={DIGIT_TYPE}>{digit}</Text>
        </Animated.View>
    );
}

export function DeliveryOtpCard({ otp, isHi }) {
    const styles = useStyles();
    const digits = String(otp).split('');

    const onCopy = async () => {
        try {
            if (canCopy) {
                await navigator.clipboard.writeText(String(otp));
                toast.success(isHi ? 'OTP कॉपी हो गया' : 'OTP copied');
            } else {
                await Share.share({ message: String(otp) });
            }
        } catch (e) {
            // user dismissed / clipboard blocked — nothing to do
        }
    };

    return (
        <Card padding="lg">
            <View style={styles.row}>
                <View style={styles.text}>
                    <Text variant="title">{isHi ? 'डिलीवरी OTP' : 'Delivery OTP'}</Text>
                    <Text variant="caption" color="muted">
                        {isHi ? 'ऑर्डर मिलने पर ही पार्टनर को बताएँ' : 'Share only when your order arrives'}
                    </Text>
                </View>
                <Button
                    variant="ghost"
                    size="sm"
                    label={canCopy ? (isHi ? 'कॉपी' : 'Copy') : isHi ? 'शेयर' : 'Share'}
                    onPress={onCopy}
                    accessibilityLabel={canCopy ? (isHi ? 'OTP कॉपी करें' : 'Copy OTP') : isHi ? 'OTP शेयर करें' : 'Share OTP'}
                />
            </View>
            <View style={styles.digits} accessible accessibilityLabel={`${isHi ? 'डिलीवरी OTP' : 'Delivery OTP'} ${digits.join(' ')}`}>
                {digits.map((d, i) => (
                    <Digit key={`${i}-${d}`} digit={d} index={i} />
                ))}
            </View>
        </Card>
    );
}

const useStyles = makeStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    text: { flex: 1, gap: space.xxs },
    digits: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
    digit: {
        flex: 1,
        height: 60,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export default DeliveryOtpCard;
