import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/constants';
import { OrderCard } from '../components/OrderCard';
import { useOrders } from '../hooks/useOrders';
import type { AvailableOrdersScreenProps } from '../types/navigation';
import type { AvailableOrder } from '../types/order';

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

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
      <View style={styles.emptyIconBox}>
        <MaterialCommunityIcons name="package-variant" size={60} color="#E0E0E0" />
      </View>
      <Text style={styles.emptyTitle}>No New Requests</Text>
      <Text style={styles.emptySubtitle}>
        Incoming orders will appear here in real-time. Stay online to receive them!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Orders</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{availableOrders.length}</Text>
        </View>
      </View>

      <FlatList
        data={availableOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={ZEPTO_PURPLE} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1F1F',
    marginLeft: 12,
  },
  countBadge: {
    backgroundColor: ZEPTO_PURPLE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});

