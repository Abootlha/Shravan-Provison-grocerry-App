import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { OrderCard } from '../components/OrderCard';
import { useOrders } from '../hooks/useOrders';
import type { AvailableOrdersScreenProps } from '../types/navigation';
import type { AvailableOrder } from '../types/order';

export const AvailableOrdersScreen: React.FC<AvailableOrdersScreenProps> = ({
  navigation,
}) => {
  const { availableOrders, loading, loadAvailableOrders, accept, reject } = useOrders();

  useEffect(() => {
    loadAvailableOrders();
  }, [loadAvailableOrders]);

  const onRefresh = useCallback(() => {
    loadAvailableOrders();
  }, [loadAvailableOrders]);

  const handleAccept = useCallback(
    async (order: AvailableOrder) => {
      Alert.alert('Accept Order', `Accept order #${order.orderNumber}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const result = await accept(order.id);
            if (result) {
              navigation.navigate('OrderDetail', { orderId: order.id, order: result });
            }
          },
        },
      ]);
    },
    [accept, navigation]
  );

  const handleReject = useCallback(
    (orderId: string) => {
      Alert.alert('Reject Order', 'Are you sure you want to reject this order?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => reject(orderId),
        },
      ]);
    },
    [reject]
  );

  const renderItem = ({ item }: { item: AvailableOrder }) => (
    <OrderCard
      order={item}
      showActions
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id, order: item })}
      onAccept={() => handleAccept(item)}
      onReject={() => handleReject(item.id)}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>No Orders Available</Text>
      <Text style={styles.emptySubtitle}>
        New orders will appear here when available
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={availableOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  separator: {
    height: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
