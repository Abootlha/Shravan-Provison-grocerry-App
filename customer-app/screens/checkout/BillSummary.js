import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Divider, RollingNumber, Skeleton, Text } from '../../components/ui';
import { fontFamily, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { durations, easings } from '../../theme/motion';
import { GROUP_RADIUS } from './layout';

/** Dims the amounts while the server quote is in flight (opacity only, ≤200ms fade). */
const useUpdatingFade = (updating) => {
    const o = useSharedValue(updating ? 0.5 : 1);
    useEffect(() => {
        o.value = withTiming(updating ? 0.5 : 1, { duration: durations.fast, easing: easings.out });
    }, [updating]);
    return useAnimatedStyle(() => ({ opacity: o.value }));
};

const Row = ({ label, children }) => {
    const styles = useStyles();
    return (
        <Animated.View entering={layout.enter} exiting={layout.exit} layout={layout.list} style={styles.row}>
            <Text variant="body" color="secondary" style={styles.label}>{label}</Text>
            <View style={styles.value}>{children}</View>
        </Animated.View>
    );
};

/** A bill amount that rolls when it changes (semibold, like the static rows used to be). */
const Amount = ({ value, color, minus }) => {
    const styles = useStyles();
    return <RollingNumber value={value} prefix={minus ? '−₹' : '₹'} variant="price" color={color} style={color ? null : styles.semibold} />;
};

/**
 * `bill` is the server quote once it has arrived, or an estimate from the store's fees while it
 * is in flight (`state` 'updating': amounts dim and "Updating" shows). `state` 'error' replaces
 * the total with a retry message: a total the server hasn't confirmed is never shown as final.
 *
 * Bill card ending in the green "You saved ₹X" band (JioMart, Part C §9). Every amount rolls
 * (RollingNumber); the discount row and savings band enter/leave with layout animations so
 * the rows below slide instead of jumping.
 */
function BillSummaryBase({ bill, tip, state = 'ready', isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const updating = state === 'updating';
    const fade = useUpdatingFade(updating);
    const head = (
        <View style={styles.head}>
            <Text variant="title" accessibilityRole="header">{isHi ? 'बिल विवरण' : 'Bill summary'}</Text>
            {updating ? (
                <Animated.View entering={layout.enter} exiting={layout.exit}>
                    <Text variant="caption" color="muted" accessibilityLiveRegion="polite">{isHi ? 'अपडेट हो रहा है…' : 'Updating…'}</Text>
                </Animated.View>
            ) : null}
        </View>
    );

    if (state === 'error') {
        return (
            <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
                <View style={styles.body} accessibilityLiveRegion="polite">
                    {head}
                    <View style={styles.errorRow}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.inkSecondary} />
                        <Text variant="body" color="secondary" style={styles.flex}>
                            {isHi
                                ? 'हम आपकी कुल राशि की पुष्टि नहीं कर सके। भुगतान से पहले नीचे फिर से प्रयास करें।'
                                : 'We couldn’t confirm your total with the store. Use Retry below before paying.'}
                        </Text>
                    </View>
                </View>
            </Card>
        );
    }

    if (!bill) {
        return (
            <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
                <View style={styles.body}>
                    {head}
                    <Skeleton height={14} />
                    <Skeleton height={14} width="70%" />
                    <Skeleton height={22} width="45%" />
                </View>
            </Card>
        );
    }

    const free = bill.deliveryFee === 0;
    const pct = bill.discountRate != null ? Math.round(bill.discountRate * 100) : null;
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <Animated.View style={[styles.body, fade]}>
                {head}

                <Row label={isHi ? 'सामान का कुल' : 'Item total'}>
                    <Amount value={bill.itemTotal} />
                </Row>

                <Row label={isHi ? 'डिलीवरी शुल्क' : 'Delivery fee'}>
                    {free ? (
                        <Animated.View key="free" entering={layout.enter} style={styles.value}>
                            {bill.standardDeliveryFee > 0 ? (
                                <Text variant="priceStrike" color="muted">₹{bill.standardDeliveryFee}</Text>
                            ) : null}
                            <Text variant="price" color="success">{isHi ? 'मुफ़्त' : 'Free'}</Text>
                        </Animated.View>
                    ) : (
                        <Animated.View key="fee" entering={layout.enter}>
                            <Amount value={bill.deliveryFee} />
                        </Animated.View>
                    )}
                </Row>

                <Row label={isHi ? 'पैकेजिंग शुल्क' : 'Packaging fee'}>
                    <Amount value={bill.packagingFee} />
                </Row>

                {bill.discount > 0 ? (
                    <Row label={pct ? (isHi ? `स्टोर छूट (${pct}%)` : `Store discount (${pct}%)`) : (isHi ? 'स्टोर छूट' : 'Store discount')}>
                        <Amount value={bill.discount} color="success" minus />
                    </Row>
                ) : null}

                <Animated.View layout={layout.list}>
                    <Divider variant="dashed" spacing={space.xs} />
                </Animated.View>

                <Animated.View layout={layout.list} style={styles.row}>
                    <View>
                        <Text variant="title">{isHi ? 'कुल देय' : 'To pay'}</Text>
                        <Text variant="caption" color="muted">{isHi ? 'सभी कर शामिल' : 'Incl. all taxes'}</Text>
                    </View>
                    <RollingNumber value={bill.grandTotal} prefix="₹" variant="priceLarge" />
                </Animated.View>

                {tip > 0 ? (
                    <Animated.View entering={layout.enter} exiting={layout.exit}>
                    <Text variant="caption" color="muted">
                        {isHi
                            ? `+ ₹${tip} टिप दरवाज़े पर डिलीवरी पार्टनर को दें`
                            : `+ ₹${tip} tip, paid to your delivery partner at the door`}
                    </Text>
                    </Animated.View>
                ) : null}
            </Animated.View>

            {bill.savings > 0 ? (
                <Animated.View entering={layout.enter} exiting={layout.exit} layout={layout.list} style={styles.savings} accessibilityRole="text">
                    <MaterialCommunityIcons name="tag-outline" size={18} color={colors.successInk} />
                    <Text variant="label" weight="medium" color={colors.successInk} style={styles.savingsText}>
                        {isHi ? (
                            <>इस ऑर्डर पर आपने <Text variant="label" color={colors.successInk}>₹{bill.savings}</Text> बचाए</>
                        ) : (
                            <>You saved <Text variant="label" color={colors.successInk}>₹{bill.savings}</Text> on this order</>
                        )}
                    </Text>
                </Animated.View>
            ) : null}
        </Card>
    );
}

export const BillSummary = memo(BillSummaryBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
    errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
    flex: { flex: 1 },
    body: { padding: space.lg, gap: space.md },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    label: { flexShrink: 1 },
    value: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
    savings: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: t.colors.successTint,
    },
    savingsText: { flex: 1 },
    semibold: { fontFamily: fontFamily.semibold },
}));

export default BillSummary;
