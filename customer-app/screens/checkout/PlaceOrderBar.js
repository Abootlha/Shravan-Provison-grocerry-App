import React, { forwardRef, memo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, PressableScale, SlideToConfirm, Text } from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { addressIcon, formatAddressLine } from '../address/addressUtils';
import { ICON_CIRCLE } from './layout';

const IconCircle = ({ name, tone = 'tint' }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={[styles.circle, tone === 'white' ? styles.circleWhite : styles.circleTint]}>
            <MaterialCommunityIcons name={name} size={18} color={colors.inkSecondary} />
        </View>
    );
};

/**
 * Sticky checkout footer (Part C §9): a sunken address strip, the payment row with the
 * total, and the violet slide-to-pay. `bottomPad` lets the sheet run under the floating
 * dock on the Cart tab so nothing shows through below it.
 */
const PlaceOrderBarBase = forwardRef(function PlaceOrderBar(
    { address, onChangeAddress, paymentOption, onChangePayment, amount, isCod, onConfirm, bottomPad = 0, isHi },
    sliderRef,
) {
    const styles = useStyles();
    const { colors } = useTheme();
    const changeLabel = isHi ? 'बदलें' : 'Change';
    const addressLine = address ? formatAddressLine(address, { pincode: false }) : '';
    const type = address?.type || 'Home';

    return (
        <View style={[styles.bar, { paddingBottom: space.md + bottomPad }]}>
            <PressableScale
                onPress={onChangeAddress}
                haptic="light"
                scaleTo={press.subtle}
                accessibilityLabel={address
                    ? `${isHi ? 'डिलीवरी पता' : 'Delivering to'} ${type}, ${addressLine}. ${changeLabel}`
                    : (isHi ? 'डिलीवरी पता जोड़ें' : 'Add a delivery address')}
                accessibilityHint={isHi ? 'सहेजे गए पते खोलता है' : 'Opens your saved addresses'}
                style={styles.strip}
            >
                <IconCircle name={address ? addressIcon(address.type) : 'map-marker-plus-outline'} tone="white" />
                <Animated.View key={address ? `${type}|${addressLine}` : 'none'} entering={layout.enter} style={styles.flex}>
                    {address ? (
                        <>
                            <Text variant="label" weight="medium" color="secondary" numberOfLines={1}>
                                {isHi ? 'डिलीवरी: ' : 'Delivering to '}
                                <Text variant="label" weight="bold" color="ink">{type}</Text>
                            </Text>
                            <Text variant="caption" color="muted" numberOfLines={1}>{addressLine}</Text>
                        </>
                    ) : (
                        <Text variant="label" numberOfLines={1}>{isHi ? 'डिलीवरी पता जोड़ें' : 'Add a delivery address'}</Text>
                    )}
                </Animated.View>
                <Text variant="label" color={colors.brandStrong}>{address ? changeLabel : (isHi ? 'जोड़ें' : 'Add')}</Text>
            </PressableScale>

            <View style={styles.payRow}>
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
            </View>

            {address ? (
                <SlideToConfirm
                    ref={sliderRef}
                    label={isCod
                        ? (isHi ? `ऑर्डर के लिए स्लाइड करें · ₹${amount}` : `Slide to place order · ₹${amount}`)
                        : (isHi ? `₹${amount} भुगतान के लिए स्लाइड करें` : `Slide to pay ₹${amount}`)}
                    confirmedLabel={isCod
                        ? (isHi ? 'ऑर्डर दिया जा रहा है…' : 'Placing your order…')
                        : (isHi ? 'भुगतान शुरू हो रहा है…' : 'Starting secure payment…')}
                    onConfirm={onConfirm}
                />
            ) : (
                <Button
                    label={isHi ? 'डिलीवरी पता चुनें' : 'Select delivery address'}
                    size="lg"
                    fullWidth
                    onPress={onChangeAddress}
                />
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
        paddingTop: space.md,
        gap: space.md,
        ...t.shadows.floating,
    },
    strip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT + space.sm,
        paddingVertical: space.sm,
        paddingLeft: space.sm,
        paddingRight: space.md,
        borderRadius: radii.card,
        backgroundColor: t.colors.surfaceSunken,
    },
    circle: { width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: radii.well, alignItems: 'center', justifyContent: 'center' },
    circleTint: { backgroundColor: t.colors.surfaceSunken },
    circleWhite: { backgroundColor: t.colors.surface },
    payRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.sm },
    payPick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: HIT },
    payChange: { paddingRight: space.md },
}));

export default PlaceOrderBar;
