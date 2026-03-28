import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { openMapMyIndiaNavigation } from '../utils/mapmyindia';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import type { NavigationScreenProps } from '../types/navigation';

const { width, height } = Dimensions.get('window');

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

  const mapRegion = {
    latitude: currentLocation?.latitude || pickupCoords.latitude,
    longitude: currentLocation?.longitude || pickupCoords.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={pickupCoords}
          title="Pickup"
          description={order.pickup.address.full}
          pinColor={COLORS.success}
        />
        <Marker
          coordinate={deliveryCoords}
          title="Delivery"
          description={order.delivery.address.full}
          pinColor={COLORS.primary}
        />
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']}>
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
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {activeOrder.status === 'picked_up'
                ? order.delivery.address.full
                : order.pickup.address.full}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.bottomCard}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <View style={styles.addressPreview}>
            <Text style={styles.addressLabel}>
              {activeOrder.status === 'picked_up' ? '📍 Delivery' : '📍 Pickup'}
            </Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {activeOrder.status === 'picked_up'
                ? order.delivery.address.full
                : order.pickup.address.full}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.mapButton}
          onPress={handleOpenMapMyIndia}
        >
          <Text style={styles.mapButtonText}>🗺️ Open in MapMyIndia</Text>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    width,
    height,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: 44,
    padding: SPACING.sm,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  orderInfo: {
    marginBottom: SPACING.md,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  addressPreview: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.text,
  },
  mapButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mapButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickupButton: {
    backgroundColor: COLORS.secondary,
  },
  deliverButton: {
    backgroundColor: COLORS.success,
  },
  actionButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});
