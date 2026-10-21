import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Pill } from './ui';
import { ItemThumb } from './order';
import { radii, spacing, useTheme } from '../theme';
import { formatDateTime, formatMoney } from '../utils/format';
import type { RiderDelivery } from '../types/delivery';

const MAX_THUMBS = 4;

/**
 * One completed delivery: when, to whom and where, what was in the bag
 * (with photos), what was collected at the door and what the rider earned.
 * Tapping opens the full order.
 */
export const DeliveryCard: React.FC<{ delivery: RiderDelivery; onPress?: () => void }> = ({ delivery: d, onPress }) => {
  const { colors: c } = useTheme();
  const extra = d.items.length - MAX_THUMBS;
  // Saved addresses often already end with the city; do not repeat it.
  const hasCity = d.address.city && d.address.full.toLowerCase().includes(d.address.city.toLowerCase());
  const where = hasCity ? d.address.full : [d.address.full, d.address.city].filter(Boolean).join(', ');
  const cod = d.paymentMethod === 'COD';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${d.orderNumber}, delivered ${formatDateTime(d.deliveredAt)}, earned ${formatMoney(d.earning.total)}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" weight="bold" numeric>
            #{d.orderNumber.replace(/^ORD-\d{8}-/, '')}
          </AppText>
          <AppText variant="caption" tone="muted">
            Delivered {formatDateTime(d.deliveredAt)}
            {d.tripMinutes != null ? ` · ${d.tripMinutes} min trip` : ''}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <AppText variant="h3" numeric tone="success">
            +{formatMoney(d.earning.total)}
          </AppText>
          <AppText variant="caption" tone="muted" numeric>
            {d.earning.tip > 0
              ? `${formatMoney(d.earning.deliveryFee)} fee + ${formatMoney(d.earning.tip)} tip`
              : 'Delivery fee'}
          </AppText>
        </View>
      </View>

      <View style={styles.drop}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={c.textMuted} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodySm" weight="semibold">
            {d.customerName}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {where}
            {d.address.landmark ? ` · ${d.address.landmark}` : ''}
          </AppText>
        </View>
      </View>

      <View style={styles.items}>
        {d.items.slice(0, MAX_THUMBS).map((item, index) => (
          <ItemThumb key={`${item.name}-${index}`} uri={item.image} quantity={item.quantity} name={item.name} size="sm" />
        ))}
        {extra > 0 ? (
          <View style={[styles.more, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <AppText variant="caption" weight="bold" tone="muted">
              +{extra}
            </AppText>
          </View>
        ) : null}
        <AppText variant="caption" tone="muted" style={{ flex: 1, textAlign: 'right' }}>
          {d.itemCount} item{d.itemCount === 1 ? '' : 's'} · {formatMoney(d.totalAmount)}
        </AppText>
      </View>

      <View style={styles.rowBetween}>
        <Pill
          tone={cod ? 'warning' : 'success'}
          icon={cod ? 'cash' : 'check-circle-outline'}
          label={cod ? `Collected ${formatMoney(d.cashCollected)} cash` : 'Paid online'}
        />
        <AppText variant="caption" weight="semibold" tone="brand">
          View order ›
        </AppText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  drop: { flexDirection: 'row', gap: spacing.sm },
  items: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 4 },
  more: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
