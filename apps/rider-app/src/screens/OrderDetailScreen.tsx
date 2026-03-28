import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../utils/constants';
import { StatusStepper } from '../components/StatusStepper';
import { useOrders } from '../hooks/useOrders';
import type { OrderDetailScreenProps } from '../types/navigation';
import type { Order } from '../types/order';

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { orderId, order: initialOrder } = route.params;
  const [order, setOrder] = useState<Order | undefined>(initialOrder);
  const [loading, setLoading] = useState(false);
  const { accept, reject, updateStatus, currentOrder } = useOrders();

  const activeOrder = currentOrder?.id === orderId ? currentOrder : order;

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  }, []);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    const result = await accept(orderId);
    setLoading(false);
    if (result) {
      setOrder(result);
      Alert.alert('Success', 'Order accepted successfully!');
    }
  }, [accept, orderId]);

  const handleReject = useCallback(async () => {
    Alert.alert('Reject Order', 'Are you sure you want to reject this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await reject(orderId);
          setLoading(false);
          navigation.goBack();
        },
      },
    ]);
  }, [reject, orderId, navigation]);

  const handleMarkPickedUp = useCallback(async () => {
    setLoading(true);
    const result = await updateStatus(orderId, 'picked_up');
    setLoading(false);
    if (result) {
      setOrder(result);
      navigation.navigate('Navigation', { orderId, order: result });
    }
  }, [updateStatus, orderId, navigation]);

  const handleNavigate = useCallback(() => {
    navigation.navigate('Navigation', { orderId, order: activeOrder! });
  }, [navigation, orderId, activeOrder]);

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = ORDER_STATUS_COLORS[activeOrder.status] || COLORS.textSecondary;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.orderNumber}>Order #{activeOrder.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {ORDER_STATUS_LABELS[activeOrder.status]}
            </Text>
          </View>
        </View>

        {activeOrder.status !== 'pending' && (
          <StatusStepper currentStatus={activeOrder.status} />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
              <View style={styles.addressContent}>
                <Text style={styles.addressName}>{activeOrder.pickup.name}</Text>
                <Text style={styles.addressText}>{activeOrder.pickup.address.full}</Text>
                <TouchableOpacity
                  onPress={() => handleCall(activeOrder.pickup.phone)}
                  style={styles.callButton}
                >
                  <Text style={styles.callButtonText}>
                    📞 {activeOrder.pickup.phone}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
              <View style={styles.addressContent}>
                <Text style={styles.addressName}>{activeOrder.delivery.name}</Text>
                <Text style={styles.addressText}>{activeOrder.delivery.address.full}</Text>
                <TouchableOpacity
                  onPress={() => handleCall(activeOrder.delivery.phone)}
                  style={styles.callButton}
                >
                  <Text style={styles.callButtonText}>
                    📞 {activeOrder.delivery.phone}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({activeOrder.items.length})</Text>
          <View style={styles.itemsCard}>
            {activeOrder.items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index < activeOrder.items.length - 1 && styles.itemBorder,
                ]}
              >
                <Text style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{activeOrder.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.earningsCard}>
            <View style={styles.earningRow}>
              <Text style={styles.earningLabel}>Delivery Fee</Text>
              <Text style={styles.earningValue}>₹{activeOrder.deliveryFee.toFixed(2)}</Text>
            </View>
            {activeOrder.tip && activeOrder.tip > 0 && (
              <View style={styles.earningRow}>
                <Text style={styles.earningLabel}>Tip</Text>
                <Text style={[styles.earningValue, { color: COLORS.success }]}>
                  +₹{activeOrder.tip.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.earningRow, styles.totalEarning]}>
              <Text style={styles.totalEarningLabel}>Total Earning</Text>
              <Text style={styles.totalEarningValue}>
                ₹{(activeOrder.deliveryFee + (activeOrder.tip || 0)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {activeOrder.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
              disabled={loading}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={handleAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeOrder.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.button, styles.navigateButton]}
            onPress={handleNavigate}
          >
            <Text style={styles.navigateButtonText}>Navigate to Pickup</Text>
          </TouchableOpacity>
        )}

        {activeOrder.status === 'in_transit' && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.pickupButton]}
              onPress={handleMarkPickedUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surface} />
              ) : (
                <Text style={styles.pickupButtonText}>Mark as Picked Up</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.navigateButton]}
              onPress={handleNavigate}
            >
              <Text style={styles.navigateButtonText}>Navigate to Delivery</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  orderNumber: {
    fontSize: 20,
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
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  addressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  addressRow: {
    flexDirection: 'row',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: SPACING.sm,
  },
  addressContent: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  callButton: {
    alignSelf: 'flex-start',
  },
  callButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.text,
  },
  itemPrice: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  earningsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  earningLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  earningValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  totalEarning: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  totalEarningLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalEarningValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.error + '20',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  pickupButton: {
    backgroundColor: COLORS.secondary,
  },
  navigateButton: {
    backgroundColor: COLORS.primary,
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
  pickupButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  navigateButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
