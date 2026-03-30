import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, ORDER_STATUS_LABELS } from '../utils/constants';
import type { Order } from '../types/order';

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

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
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <Text style={styles.timeTag}>9:45 PM • 3.2 km away</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{ORDER_STATUS_LABELS[order.status].toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.addressSection}>
        <View style={styles.addressRow}>
          <View style={styles.indicatorCol}>
            <View style={[styles.dot, { backgroundColor: '#333' }]} />
            <View style={styles.line} />
            <View style={[styles.dot, { backgroundColor: ZEPTO_GREEN }]} />
          </View>
          <View style={styles.addressDetails}>
            <View style={styles.point}>
              <Text style={styles.pointLabel}>PICKUP FROM</Text>
              <Text style={styles.pointText} numberOfLines={1}>{order.pickup.name}</Text>
            </View>
            <View style={styles.point}>
              <Text style={styles.pointLabel}>DELIVER TO</Text>
              <Text style={styles.pointText} numberOfLines={1}>{order.delivery.address.full}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="package-variant" size={14} color="#888" />
          <Text style={styles.statText}>{order.items.length} Items</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.stat}>
          <MaterialCommunityIcons name="wallet-outline" size={14} color={ZEPTO_GREEN} />
          <Text style={[styles.statText, { color: ZEPTO_GREEN, fontWeight: '800' }]}>
            Earn ₹{order.deliveryFee.toFixed(0)}
          </Text>
        </View>
      </View>

      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={onAccept}
          >
            <Text style={styles.acceptButtonText}>ACCEPT NOW</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  timeTag: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: ZEPTO_PURPLE,
    letterSpacing: 0.5,
  },
  addressSection: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 1.5,
    height: 24,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  addressDetails: {
    flex: 1,
    marginLeft: 12,
    gap: 12,
  },
  point: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#AAA',
    letterSpacing: 0.5,
  },
  pointText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F7F7F7',
    gap: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#DDD',
  },
  statText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actions: {
    marginTop: 16,
  },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: ZEPTO_PURPLE,
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

