import React, { forwardRef, memo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, PressableScale, RollingNumber, SlideToConfirm, Text } from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { ICON_CIRCLE } from './layout';

const IconCircle = ({ name }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.circle}>
            <MaterialCommunityIcons name={name} size={18} color={colors.inkSecondary} />
        </View>
    );
};

/**
 * Sticky checkout footer (Part C §9): the payment row, then the total ("View bill" scrolls to the
 * bill summary) beside the violet slide-to-pay. The delivery address lives in the "Delivering to"
 * card in the checkout content.
 *
 * `amount` is the server quote's totalAmount (null until confirmed: the estimate shows dimmed as
 * `estimate`). When the order can't be placed yet, `blockedReason` says why in one line above the
 * locked slider (no address, outside the delivery area, store closed, total updating, unavailable
 * items). `billState` 'error' swaps the slider for a Retry button, so nobody pays a guess.
 * `bottomPad` lets the sheet clear the home indicator.
 */
const PlaceOrderBarBase = forwardRef(function PlaceOrderBar(
    {
        paymentOption, onChangePayment, amount, estimate = null, isCod, onConfirm, onViewBill,
        billState = 'ready', onRetryQuote, bottomPad = 0, blockedReason = null, isHi,
    },
    sliderRef,
) {
    const styles = useStyles();
    const { colors } = useTheme();
    const changeLabel = isHi ? 'बदलें' : 'Change';
    const ready = billState === 'ready' && amount != null;
    const shown = amount ?? estimate;
    const blocked = blockedReason || (!ready
        ? (billState === 'refused'
            ? (isHi ? 'ऑर्डर से पहले अनुपलब्ध सामान हटाएं' : 'Remove unavailable items to continue')
            : (isHi ? 'कुल राशि अपडेट हो रही है…' : 'Updating your total…'))
        : null);

    return (
        <View style={[styles.bar, { paddingBottom: space.md + bottomPad }]}>
            <PressableScale
                onPress={onChangePayment}
                haptic="light"
                scaleTo={press.subtle}
                accessibilityLabel={`${isHi ? 'भुगतान का तरीका' : 'Pay using'} ${paymentOption.name}. ${changeLabel}`}
                accessibilityHint={isHi ? 'भुगतान के तरीके खोलता है' : 'Opens payment methods'}
                style={styles.payPick}
            >
                <IconCircle name={paymentOption.icon} />
                <Animated.View key={paymentOption.id || paymentOption.name} entering={layout.enter} style={styles.flex}>
                    <Text variant="caption" color="muted">{isHi ? 'भुगतान' : 'Pay using'}</Text>
                    <Text variant="bodyStrong" numberOfLines={1}>{paymentOption.name}</Text>
                </Animated.View>
                <Text variant="label" color={colors.brandStrong} style={styles.payChange}>{changeLabel}</Text>
            </PressableScale>

            {billState === 'error' && !blockedReason ? (
                <View style={styles.errorBlock} accessibilityLiveRegion="polite">
                    <Text variant="caption" color="secondary" align="center">
                        {isHi ? 'कुल राशि की पुष्टि नहीं हो सकी, भुगतान रोका गया है।' : 'We couldn’t confirm your total, so payment is paused.'}
                    </Text>
                    <Button label={isHi ? 'फिर से प्रयास करें' : 'Retry'} size="lg" fullWidth onPress={onRetryQuote} />
                </View>
            ) : (
                <>
                    {blocked ? (
                        <Animated.View key={blocked} entering={layout.enter} style={styles.blocked} accessibilityLiveRegion="polite">
                            <MaterialCommunityIcons name="information-outline" size={14} color={colors.inkMuted} />
                            <Text variant="caption" color="secondary" numberOfLines={1} style={styles.flex}>{blocked}</Text>
                        </Animated.View>
                    ) : null}
                    <View style={styles.payRow}>
                        <PressableScale
                            onPress={onViewBill}
                            haptic="light"
                            scaleTo={press.subtle}
                            accessibilityLabel={shown != null
                                ? (isHi ? `कुल ₹${shown}. बिल देखें` : `Total ₹${shown}. View bill`)
                                : (isHi ? 'बिल देखें' : 'View bill')}
                            style={styles.total}
                        >
                            {shown != null ? (
                                <RollingNumber value={shown} prefix="₹" variant="priceLarge" style={ready ? null : styles.dim} />
                            ) : (
                                <Text variant="priceLarge" color="muted">₹—</Text>
                            )}
                            <View style={styles.viewBill}>
                                <Text variant="caption" color={colors.brandStrong}>{isHi ? 'बिल देखें' : 'View bill'}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={14} color={colors.brandStrong} />
                            </View>
                        </PressableScale>
                        <SlideToConfirm
                            ref={sliderRef}
                            style={styles.flex}
                            disabled={!!blocked}
                            label={isCod ? (isHi ? 'ऑर्डर के लिए स्लाइड करें' : 'Slide to order') : (isHi ? 'भुगतान के लिए स्लाइड करें' : 'Slide to pay')}
                            hintLabel={isHi ? 'पुष्टि के लिए स्लाइड करें' : 'Slide to confirm'}
                            confirmedLabel={isCod
                                ? (isHi ? 'ऑर्डर दिया जा रहा है…' : 'Placing order…')
                                : (isHi ? 'भुगतान शुरू…' : 'Starting payment…')}
                            onConfirm={onConfirm}
                        />
                    </View>
                </>
            )}
        </View>
    );
});

export const PlaceOrderBar = memo(PlaceOrderBarBase);

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    bar: {
        backgroundColor: t.colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        gap: space.sm,
        ...t.shadows.floating,
    },
    circle: {
        width: ICON_CIRCLE,
        height: ICON_CIRCLE,
        borderRadius: radii.well,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.colors.surfaceSunken,
    },
    payPick: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: HIT, paddingLeft: space.xxs },
    payChange: { paddingRight: space.xs },
    blocked: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    total: { minWidth: 84, justifyContent: 'center' },
    viewBill: { flexDirection: 'row', alignItems: 'center' },
    dim: { opacity: 0.5 },
    errorBlock: { gap: space.sm },
}));

export default PlaceOrderBar;
