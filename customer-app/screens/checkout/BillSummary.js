import React, { memo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Divider, RollingNumber, Text } from '../../components/ui';
import { fontFamily, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { DELIVERY_FEE } from './bill';
import { GROUP_RADIUS } from './layout';

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
 * Bill card ending in the green "You saved ₹X" band (JioMart, Part C §9). Every amount rolls
 * (RollingNumber); the discount row and savings band enter/leave with layout animations so
 * the rows below slide instead of jumping.
 */
function BillSummaryBase({ bill, tip, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const free = bill.deliveryFee === 0;
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.body}>
                <Text variant="title" accessibilityRole="header">{isHi ? 'बिल विवरण' : 'Bill summary'}</Text>

                <Row label={isHi ? 'सामान का कुल' : 'Item total'}>
                    <Amount value={bill.itemTotal} />
                </Row>

                <Row label={isHi ? 'डिलीवरी शुल्क' : 'Delivery fee'}>
                    {free ? (
                        <Animated.View key="free" entering={layout.enter} style={styles.value}>
                            <Text variant="priceStrike" color="muted">₹{DELIVERY_FEE}</Text>
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
                    <Row label={isHi ? 'स्टोर छूट (5%)' : 'Store discount (5%)'}>
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
            </View>

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
