import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../utils/constants';
import type { Order } from '../types/order';

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  showActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  showActions = false,
  onAccept,
  onReject,
}) => {
  const statusColor = ORDER_STATUS_COLORS[order.status] || COLORS.textSecondary;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{ORDER_STATUS_LABELS[order.status]}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.addressRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>Pickup</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {order.pickup.address.full}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.addressRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>Delivery</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {order.delivery.address.full}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>Items</Text>
          <Text style={styles.footerValue}>{order.items.length}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>Amount</Text>
          <Text style={styles.footerValue}>₹{order.totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>Earn</Text>
          <Text style={[styles.footerValue, { color: COLORS.success }]}>
            ₹{order.deliveryFee.toFixed(2)}
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={onReject}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={onAccept}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.surface,
  },
  section: {
    marginBottom: SPACING.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: SPACING.sm,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  divider: {
    height: 12,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  footerItem: {
    flex: 1,
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.error + '20',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButtonText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 16,
  },
  acceptButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});
