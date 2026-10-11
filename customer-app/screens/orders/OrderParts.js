/**
 * Small building blocks shared by tracking, order history and order details.
 *   <OrderItemRow item index />      ProductImage thumbnail + name + qty + line total
 *   <BillRows order isHi gst? />     receipt-style bill breakdown with the grand total
 *   <ThumbStack items max size />    overlapping product thumbnails with a "+N" chip
 *   <StatusChip status isHi size />  small status label (icon + text, radius 8) — tones from getStatusMeta
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import ProductImage from '../../components/product/ProductImage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, makeThemed, useTheme } from '../../theme';
import { Divider, Text } from '../../components/ui';
import { formatMoney, getBill, getStatusMeta } from './orderUtils';

export const OrderItemRow = memo(function OrderItemRow({ item, index = 0 }) {
    const styles = useStyles();
    const line = (item.price || 0) * (item.quantity || 0);
    return (
        <View style={styles.itemRow}>
            <ProductImage uri={item.image} variant="thumb" size={52} radius={radii.well} />
            <View style={styles.itemText}>
                <Text variant="label" numberOfLines={2}>{item.name}</Text>
                <Text variant="caption" color="muted">
                    {item.quantity} × {formatMoney(item.price)}
                </Text>
            </View>
            <Text variant="price">{formatMoney(line)}</Text>
        </View>
    );
});

const Row = ({ label, value, strong, tone }) => {
    const styles = useStyles();
    return (
        <View style={styles.billRow}>
            <Text variant={strong ? 'title' : 'body'} color={strong ? 'ink' : 'secondary'}>{label}</Text>
            <Text variant={strong ? 'priceLarge' : 'price'} color={tone || 'ink'}>{value}</Text>
        </View>
    );
};

export function BillRows({ order, isHi, showGst = false }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const bill = getBill(order);
    const gst = Number((bill.itemTotal * 0.05).toFixed(2));
    const free = isHi ? 'मुफ़्त' : 'Free';
    return (
        <View style={styles.bill}>
            <Row label={isHi ? 'सामान का कुल' : 'Item total'} value={formatMoney(bill.itemTotal)} />
            <Row label={isHi ? 'डिलीवरी शुल्क' : 'Delivery fee'} value={bill.deliveryFee ? formatMoney(bill.deliveryFee) : free} tone={bill.deliveryFee ? undefined : 'success'} />
            {bill.packagingFee ? <Row label={isHi ? 'पैकेजिंग शुल्क' : 'Packaging fee'} value={formatMoney(bill.packagingFee)} /> : null}
            {showGst ? <Row label={isHi ? 'अनुमानित GST (शामिल)' : 'Estimated GST (incl.)'} value={formatMoney(gst, 2)} /> : null}
            {bill.discount ? <Row label={isHi ? 'छूट' : 'Discount'} value={`− ${formatMoney(bill.discount)}`} tone="success" /> : null}
            <Divider variant="dashed" spacing={space.sm} />
            <Row label={isHi ? 'कुल भुगतान' : 'Grand total'} value={formatMoney(bill.totalAmount)} strong />
            {bill.discount > 0 ? (
                <View style={styles.saved}>
                    <MaterialCommunityIcons name="tag-outline" size={16} color={colors.successInk} />
                    <Text variant="label" color={colors.successInk} style={styles.flex}>
                        {isHi ? 'इस ऑर्डर पर आपकी बचत' : 'You saved on this order'}
                    </Text>
                    <Text variant="price" color={colors.successInk}>{formatMoney(bill.discount)}</Text>
                </View>
            ) : null}
        </View>
    );
}

export const ThumbStack = memo(function ThumbStack({ items = [], max = 4, size = 40 }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const shown = items.slice(0, max);
    const extra = items.length - shown.length;
    return (
        <View style={styles.stack}>
            {shown.map((item, i) => {
                return (
                    <View
                        key={`${item.productId || item.name}-${i}`}
                        style={[styles.stackItem, { width: size, height: size, borderRadius: size * 0.3, marginLeft: i === 0 ? 0 : -size * 0.22, zIndex: max - i }]}
                    >
                        <ProductImage uri={item.image} variant="thumb" radius={size * 0.3 - 2} style={StyleSheet.absoluteFill} />
                    </View>
                );
            })}
            {extra > 0 ? (
                <View style={[styles.stackItem, styles.more, { width: size, height: size, borderRadius: size * 0.3, marginLeft: -size * 0.22 }]}>
                    <Text variant="label" color="secondary" tabular>+{extra}</Text>
                </View>
            ) : null}
        </View>
    );
});

/** Section break inside a receipt card: a plain dashed rule (`notchColor` is accepted and ignored). */
export function Perforation() {
    const styles = useStyles();
    return (
        <View style={styles.perf} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.perfLine} />
        </View>
    );
}

const useChipTones = makeThemed(({ colors }) => ({
    pending: { bg: colors.surfaceSunken, fg: colors.inkSecondary },
    live: { bg: colors.surfaceSunken, fg: colors.ink },
    night: { bg: colors.surfaceSunken, fg: colors.ink },
    success: { bg: colors.successTint, fg: colors.successInk },
    muted: { bg: colors.surfaceSunken, fg: colors.inkMuted },
}));

/** Status label: icon + text on a flat tone, radius 8 (no pill, no dot). */
export const StatusChip = memo(function StatusChip({ status, isHi, size = 'md' }) {
    const styles = useStyles();
    const tones = useChipTones();
    const meta = getStatusMeta(status, isHi);
    const t = tones[meta.tone] || tones.pending;
    return (
        <View style={[styles.chip, size === 'sm' && styles.chipSm, { backgroundColor: t.bg }]}>
            <MaterialCommunityIcons name={meta.icon} size={13} color={t.fg} />
            <Text variant="caption" weight="semibold" color={t.fg} numberOfLines={1}>{meta.label}</Text>
        </View>
    );
});

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    saved: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radii.sm, backgroundColor: t.colors.successTint },
    perf: { height: 20, justifyContent: 'center' },
    perfLine: { marginHorizontal: space.lg, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.colors.border },
    chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, height: 26, paddingHorizontal: space.sm, borderRadius: radii.chip },
    chipSm: { height: 22, paddingHorizontal: space.sm - 2 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
    itemText: { flex: 1, gap: space.xxs },
    bill: { gap: space.sm },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
    stack: { flexDirection: 'row', alignItems: 'center' },
    stackItem: {
        borderWidth: 2,
        borderColor: t.colors.surface,
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    more: { backgroundColor: t.colors.surfaceSunken },
}));
