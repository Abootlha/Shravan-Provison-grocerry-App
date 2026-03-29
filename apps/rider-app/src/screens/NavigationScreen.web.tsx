import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { openMapMyIndiaNavigation } from '../utils/mapmyindia';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import type { NavigationScreenProps } from '../types/navigation';

export const NavigationScreen: React.FC<NavigationScreenProps> = ({
  navigation,
  route,
}) => {
  const { order } = route.params;
  const { updateStatus, currentOrder } = useOrders();
  const { currentLocation } = useLocation();
  const [loading, setLoading] = useState(false);

  const activeOrder = currentOrder?.id === order.id ? currentOrder : order;
  const pickupCoords = order.pickup.address.coordinates;
  const deliveryCoords = order.delivery.address.coordinates;

  const handleOpenMapMyIndia = useCallback(async () => {
    const startLat = currentLocation?.latitude || 0;
    const startLng = currentLocation?.longitude || 0;
    const endLat = activeOrder.status === 'picked_up'
      ? deliveryCoords.latitude
      : pickupCoords.latitude;
    const endLng = activeOrder.status === 'picked_up'
      ? deliveryCoords.longitude
      : pickupCoords.longitude;

    try {
      await openMapMyIndiaNavigation({
        startLat,
        startLng,
        endLat,
        endLng,
        vehicleType: 'bike',
      });
    } catch {
      Alert.alert('Error', 'Unable to open navigation');
    }
  }, [currentLocation, activeOrder.status, pickupCoords, deliveryCoords]);

  const handleMarkPickedUp = useCallback(async () => {
    setLoading(true);
    const result = await updateStatus(order.id, 'picked_up', currentLocation ?? undefined);
    setLoading(false);
    if (result) {
      Alert.alert('Success', 'Order marked as picked up!');
    }
  }, [updateStatus, order.id, currentLocation]);

  const handleMarkDelivered = useCallback(async () => {
    setLoading(true);
    const result = await updateStatus(order.id, 'delivered', currentLocation ?? undefined);
    setLoading(false);
    if (result) {
      navigation.replace('DeliveryComplete', {
        order: result,
        tip: result.tip,
      });
    }
  }, [updateStatus, order.id, currentLocation, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {activeOrder.status === 'picked_up' ? 'Navigate to Delivery' : 'Navigate to Pickup'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Web preview shows route details. Native app opens turn-by-turn navigation.
            </Text>
          </View>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Route Summary</Text>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.address}>{order.pickup.address.full}</Text>
          <Text style={styles.coords}>
            {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}
          </Text>

          <Text style={styles.label}>Delivery</Text>
          <Text style={styles.address}>{order.delivery.address.full}</Text>
          <Text style={styles.coords}>
            {deliveryCoords.latitude.toFixed(5)}, {deliveryCoords.longitude.toFixed(5)}
          </Text>

          {currentLocation && (
            <>
              <Text style={styles.label}>Current Location</Text>
              <Text style={styles.coords}>
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.mapButton}
          onPress={handleOpenMapMyIndia}
        >
          <Text style={styles.mapButtonText}>Open in MapMyIndia</Text>
        </TouchableOpacity>

        {activeOrder.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.pickupButton]}
            onPress={handleMarkPickedUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.surface} />
            ) : (
              <Text style={styles.actionButtonText}>Mark as Picked Up</Text>
            )}
          </TouchableOpacity>
        )}

        {activeOrder.status === 'picked_up' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deliverButton]}
            onPress={handleMarkDelivered}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.surface} />
            ) : (
              <Text style={styles.actionButtonText}>Mark as Delivered</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  label: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  address: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  coords: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  mapButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  mapButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.surface,
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupButton: {
    backgroundColor: COLORS.warning,
  },
  deliverButton: {
    backgroundColor: COLORS.success,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.surface,
  },
});
