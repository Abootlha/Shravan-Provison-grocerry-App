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
  Modal,
  TextInput,
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
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const mapRef = useRef<MapView>(null);

  const activeOrder = currentOrder?.id === order.id ? currentOrder : order;
  const activeOrderId = activeOrder.id || order.id;

  const pickupCoords = order.pickup.address.coordinates;
  const deliveryCoords = order.delivery.address.coordinates;

  const handleOpenMapMyIndia = useCallback(async () => {
    const startLat = currentLocation?.latitude || 0;
    const startLng = currentLocation?.longitude || 0;
    const endLat = ['picked_up', 'out_for_delivery'].includes(activeOrder.status)
      ? deliveryCoords.latitude
      : pickupCoords.latitude;
    const endLng = ['picked_up', 'out_for_delivery'].includes(activeOrder.status)
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
    const result = await updateStatus(activeOrderId, 'picked_up', currentLocation ?? undefined);
    setLoading(false);
    if (result) {
      Alert.alert('Success', 'Order marked as picked up!');
    } else {
      Alert.alert('Unable to update status', 'The pickup status could not be updated. Please try again.');
    }
  }, [updateStatus, activeOrderId, currentLocation]);

  const handleStartDelivery = useCallback(async () => {
    setLoading(true);
    const result = await updateStatus(activeOrderId, 'out_for_delivery', currentLocation ?? undefined);
    setLoading(false);
    if (result) {
      Alert.alert('Success', 'Order marked as out for delivery!');
    } else {
      Alert.alert('Unable to update status', 'The delivery status could not be updated. Please try again.');
    }
  }, [updateStatus, activeOrderId, currentLocation]);

  const handleMarkDelivered = useCallback(async () => {
    if ((activeOrder.deliveryOtp || '').trim() !== deliveryOtpInput.trim()) {
      Alert.alert('Invalid OTP', 'Please enter the delivery OTP shown in the customer app.');
      return;
    }

    setLoading(true);
    const result = await updateStatus(activeOrderId, 'delivered', currentLocation ?? undefined);
    setLoading(false);
    if (result) {
      setOtpModalVisible(false);
      setDeliveryOtpInput('');
      navigation.replace('DeliveryComplete', {
        order: result,
        tip: result.tip,
      });
    } else {
      Alert.alert('Unable to update status', 'The delivery could not be completed. Please try again.');
    }
  }, [updateStatus, activeOrderId, currentLocation, navigation, activeOrder.deliveryOtp, deliveryOtpInput]);

  const mapRegion = {
    latitude: currentLocation?.latitude || pickupCoords.latitude,
    longitude: currentLocation?.longitude || pickupCoords.longitude,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
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
              {['picked_up', 'out_for_delivery'].includes(activeOrder.status) ? 'Delivery Location' : 'Store Pickup'}
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
              {['picked_up', 'out_for_delivery'].includes(activeOrder.status) ? 'HEADING TO CUSTOMER' : 'HEADING TO STORE'}
            </Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <MaterialCommunityIcons name="phone" size={20} color={ZEPTO_PURPLE} />
          </TouchableOpacity>
        </View>

        <View style={styles.addressSection}>
          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: ['picked_up', 'out_for_delivery'].includes(activeOrder.status) ? ZEPTO_GREEN : '#333' }]} />
            <Text style={styles.addressText} numberOfLines={2}>
              {['picked_up', 'out_for_delivery'].includes(activeOrder.status)
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

          {activeOrder.status === 'assigned' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pickupButton]}
              onPress={() => Alert.alert('Waiting for packing', 'The store has not packed this order yet. You will be notified once it is ready for pickup.')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>WAIT FOR PACKING</Text>
              )}
            </TouchableOpacity>
          )}

          {activeOrder.status === 'packed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pickupButton]}
              onPress={handleMarkPickedUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>MARK PICKED UP</Text>
              )}
            </TouchableOpacity>
          )}

          {activeOrder.status === 'picked_up' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.pickupButton]}
              onPress={handleStartDelivery}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>START DELIVERY</Text>
              )}
            </TouchableOpacity>
          )}

          {activeOrder.status === 'out_for_delivery' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deliverButton]}
              onPress={() => setOtpModalVisible(true)}
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

      <Modal
        visible={otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Delivery OTP</Text>
            <Text style={styles.modalSubtitle}>
              Ask the customer for the 4-digit delivery OTP and enter it below.
            </Text>
            <TextInput
              style={styles.otpInput}
              value={deliveryOtpInput}
              onChangeText={(value) => setDeliveryOtpInput(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="Enter OTP"
              maxLength={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancel]} onPress={() => setOtpModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalConfirm]} onPress={handleMarkDelivered} disabled={loading}>
                <Text style={styles.modalConfirmText}>{loading ? 'Verifying...' : 'Verify & Deliver'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalConfirm: {
    backgroundColor: ZEPTO_GREEN,
  },
  modalCancelText: {
    color: '#111827',
    fontWeight: '700',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: '800',
  },
});
