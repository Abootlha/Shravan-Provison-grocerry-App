import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/constants';
import { openMapMyIndiaNavigation } from '../utils/mapmyindia';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import type { NavigationScreenProps } from '../types/navigation';

const { width, height } = Dimensions.get('window');

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

const MAP_STYLE_SILVER = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
];

const CustomMarkerView = ({ icon, color, label }: { icon: any; color: string; label: string }) => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerOuter, { backgroundColor: color }]}>
      <View style={styles.markerInner}>
        <MaterialCommunityIcons name={icon} size={18} color="white" />
      </View>
    </View>
    <View style={styles.markerLabel}>
      <Text style={styles.markerLabelText}>{label}</Text>
    </View>
  </View>
);

export const NavigationScreen: React.FC<NavigationScreenProps> = ({
  navigation,
  route,
}) => {
  const { order } = route.params;
  const { updateStatus, currentOrder } = useOrders();
  const { currentLocation } = useLocation();
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

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
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        customMapStyle={MAP_STYLE_SILVER}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker coordinate={pickupCoords}>
          <CustomMarkerView icon="store" color="#333" label="Store" />
        </Marker>

        <Marker coordinate={deliveryCoords}>
          <CustomMarkerView icon="map-marker" color={ZEPTO_GREEN} label="Customer" />
        </Marker>
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {activeOrder.status === 'picked_up' ? 'Delivery Location' : 'Store Pickup'}
            </Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>READY</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.bottomCard}>
        <View style={styles.dragHandle} />

        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            <Text style={styles.statusBadge}>
              {activeOrder.status === 'picked_up' ? 'OUT FOR DELIVERY' : 'HEADING TO STORE'}
            </Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <MaterialCommunityIcons name="phone" size={20} color={ZEPTO_PURPLE} />
          </TouchableOpacity>
        </View>

        <View style={styles.addressSection}>
          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: activeOrder.status === 'picked_up' ? ZEPTO_GREEN : '#333' }]} />
            <Text style={styles.addressText} numberOfLines={2}>
              {activeOrder.status === 'picked_up'
                ? order.delivery.address.full
                : order.pickup.address.full}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handleOpenMapMyIndia}
          >
            <MaterialCommunityIcons name="navigation-variant" size={24} color="white" />
            <Text style={styles.navButtonText}>NAVIGATE</Text>
          </TouchableOpacity>

          {activeOrder.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pickupButton]}
              onPress={handleMarkPickedUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>PICKED UP</Text>
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
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>DELIVERED</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    width,
    height: height * 0.7,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 40 : 0,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ZEPTO_GREEN,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    color: ZEPTO_GREEN,
    letterSpacing: 0.5,
  },

  // Marker styles
  markerContainer: {
    alignItems: 'center',
  },
  markerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  markerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  markerLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#333',
  },

  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: ZEPTO_PURPLE,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressSection: {
    backgroundColor: '#F9F9F9',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
    lineHeight: 20,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  actionButton: {
    flex: 1.2,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupButton: {
    backgroundColor: ZEPTO_PURPLE,
  },
  deliverButton: {
    backgroundColor: ZEPTO_GREEN,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
});

