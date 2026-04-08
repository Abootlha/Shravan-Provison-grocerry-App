import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, ORDER_STATUS_LABELS } from '../utils/constants';
import { StatusStepper } from '../components/StatusStepper';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import { locationService } from '../services/location';
import { notificationService } from '../services/notifications';
import type { OrderDetailScreenProps } from '../types/navigation';
import type { Order } from '../types/order';

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { orderId, order: initialOrder } = route.params;
  const [order, setOrder] = useState<Order | undefined>(initialOrder);
  const [loading, setLoading] = useState(false);
  const { accept, reject, updateStatus, currentOrder } = useOrders();
  const { currentLocation, isTracking } = useLocation();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);
  const delayAlertShownRef = useRef(false);

  useEffect(() => {
    const checkLocation = async () => {
      const hasPermission = await locationService.hasPermissions();
      setLocationEnabled(hasPermission);
      if (hasPermission) {
        const loc = await locationService.getCurrentLocation();
        if (loc) {
          setRiderCoords({ lat: loc.latitude, lng: loc.longitude });
        }
      }
    };
    checkLocation();
  }, []);

  const activeOrder = currentOrder?.id === orderId ? currentOrder : order;
  const activeStatusLabel = ORDER_STATUS_LABELS[activeOrder?.status || 'confirmed'] || 'Awaiting Acceptance';

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'assigned') {
      delayAlertShownRef.current = false;
      return;
    }

    const assignedAt = activeOrder.acceptedAt || activeOrder.createdAt;
    if (!assignedAt) {
      return;
    }

    const interval = setInterval(() => {
      const assignedTime = new Date(assignedAt).getTime();
      const minutesWaiting = (Date.now() - assignedTime) / 60000;

      if (minutesWaiting >= 5 && !delayAlertShownRef.current) {
        delayAlertShownRef.current = true;
        notificationService.notifyOnce(
          `pickup-delay-${orderId}`,
          'Pickup Delay Alert',
          'Please visit the store. This order has been waiting for more than 5 minutes.',
        ).catch(() => {
          // The in-app alert below is the fallback if notifications fail.
        });
        Alert.alert(
          'Pickup Delay Alert',
          'Please visit the store. This order has been waiting for more than 5 minutes.',
        );
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeOrder]);

  useEffect(() => {
    if (activeOrder?.status !== 'assigned') {
      notificationService.reset(`pickup-delay-${orderId}`);
    }
  }, [activeOrder?.status, orderId]);

  const handleCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to make phone call');
    });
  }, []);

  const handleAccept = useCallback(async () => {
    if (!locationEnabled) {
      Alert.alert(
        'Location Required',
        'You must enable location services to accept orders. Please enable location in your device settings and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    if (!riderCoords) {
      Alert.alert(
        'Location Unavailable',
        'Unable to get your current location. Please make sure GPS is enabled and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleAccept },
        ]
      );
      return;
    }

    setLoading(true);
    const result = await accept(orderId);
    setLoading(false);
    if (result) {
      setOrder(result);
      Alert.alert('Success', 'Order accepted successfully!');
    }
  }, [accept, orderId, locationEnabled, riderCoords]);

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
    if (!riderCoords) {
      Alert.alert('Location Required', 'Unable to get your current location. Please wait for GPS to update.');
      return;
    }

    setLoading(true);
    const result = await updateStatus(orderId, 'picked_up', {
      latitude: riderCoords.lat,
      longitude: riderCoords.lng,
    });
    setLoading(false);
    if (result) {
      setOrder(result);
      navigation.navigate('Navigation', { orderId, order: result });
    }
  }, [updateStatus, orderId, navigation, riderCoords]);

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

  const deliveryCoords = activeOrder.delivery.address.coordinates;
  const pickupCoords = activeOrder.pickup.address?.coordinates;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.orderNumberTitle}>Order #{activeOrder.orderNumber}</Text>
            <Text style={styles.orderDate}>Today, 09:45 PM</Text>
          </View>
          <View style={styles.statusBadgeContainer}>
            <Text style={styles.statusBadgeText}>
              {activeStatusLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        {activeOrder.status !== 'confirmed' && (
          <View style={styles.stepperContainer}>
            <StatusStepper currentStatus={activeOrder.status} />
          </View>
        )}

        {/* Rider Location Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR LOCATION</Text>
          <View style={styles.locationCard}>
            {locationEnabled && riderCoords ? (
              <>
                <View style={styles.locationStatusRow}>
                  <View style={styles.locationDot} />
                  <Text style={styles.locationStatusText}>Location Active</Text>
                </View>
                <Text style={styles.locationCoords}>
                  {riderCoords.lat.toFixed(6)}, {riderCoords.lng.toFixed(6)}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.locationStatusRow}>
                  <View style={[styles.locationDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={[styles.locationStatusText, { color: '#EF4444' }]}>
                    Location Disabled
                  </Text>
                </View>
                <Text style={styles.locationWarningText}>
                  Enable location to accept and deliver orders
                </Text>
                <TouchableOpacity
                  style={styles.enableLocationBtn}
                  onPress={() => Linking.openSettings()}
                >
                  <MaterialCommunityIcons name="cog-outline" size={16} color="white" />
                  <Text style={styles.enableLocationBtnText}>Open Settings</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PICKUP & DELIVERY</Text>
          <View style={styles.addressContainer}>
            <View style={styles.addressRow}>
              <View style={styles.indicatorCol}>
                <View style={[styles.indicatorDot, { backgroundColor: '#333' }]} />
                <View style={styles.indicatorLine} />
                <View style={[styles.indicatorDot, { backgroundColor: ZEPTO_GREEN }]} />
              </View>
              <View style={styles.addressDetails}>
                <View style={styles.addressPoint}>
                  <Text style={styles.pointTitle}>{activeOrder.pickup.name}</Text>
                  <Text style={styles.pointSub}>{activeOrder.pickup.address.full}</Text>
                  {pickupCoords && (
                    <Text style={styles.coordText}>
                      📍 {pickupCoords.latitude?.toFixed(5)}, {pickupCoords.longitude?.toFixed(5)}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => handleCall(activeOrder.pickup.phone)} style={styles.inlineCall}>
                    <MaterialCommunityIcons name="phone" size={14} color={ZEPTO_PURPLE} />
                    <Text style={styles.inlineCallText}>Call Store</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.addressPoint}>
                  <Text style={styles.pointTitle}>{activeOrder.delivery.name}</Text>
                  <Text style={styles.pointSub}>{activeOrder.delivery.address.full}</Text>
                  {deliveryCoords && (
                    <Text style={styles.coordText}>
                      📍 {deliveryCoords.latitude?.toFixed(5)}, {deliveryCoords.longitude?.toFixed(5)}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => handleCall(activeOrder.delivery.phone)} style={styles.inlineCall}>
                    <MaterialCommunityIcons name="phone" size={14} color={ZEPTO_PURPLE} />
                    <Text style={styles.inlineCallText}>Call Customer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
          <View style={styles.itemsCard}>
            {activeOrder.items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index < activeOrder.items.length - 1 && styles.itemBorder,
                ]}
              >
                <View style={styles.itemNameCol}>
                  <View style={styles.quantityBox}>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Bill Amount</Text>
              <Text style={styles.totalValue}>₹{activeOrder.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR EARNINGS</Text>
          <View style={styles.earningsCard}>
            <View style={styles.earningRow}>
              <Text style={styles.earningLabel}>Delivery Fee</Text>
              <Text style={styles.earningValue}>₹{activeOrder.deliveryFee.toFixed(2)}</Text>
            </View>
            {activeOrder.tip && activeOrder.tip > 0 && (
              <View style={styles.earningRow}>
                <Text style={styles.earningLabel}>Customer Tip</Text>
                <Text style={[styles.earningValue, { color: ZEPTO_GREEN }]}>
                  +₹{activeOrder.tip.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.earningRow}>
              <Text style={styles.totalEarningLabel}>Estimated Earning</Text>
              <Text style={styles.totalEarningValue}>
                ₹{(activeOrder.deliveryFee + (activeOrder.tip || 0)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        {activeOrder.status === 'confirmed' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
              disabled={loading}
            >
              <Text style={styles.rejectButtonText}>REJECT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.acceptButton,
                !locationEnabled && styles.disabledButton,
              ]}
              onPress={handleAccept}
              disabled={loading || !locationEnabled}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : !locationEnabled ? (
                <>
                  <MaterialCommunityIcons name="map-marker-off" size={18} color="#999" />
                  <Text style={styles.disabledAcceptText}>ENABLE LOCATION</Text>
                </>
              ) : (
                <Text style={styles.acceptButtonText}>ACCEPT ORDER</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeOrder.status === 'assigned' && (
          <TouchableOpacity
            style={[styles.fullButton, { backgroundColor: ZEPTO_PURPLE }]}
            onPress={handleNavigate}
          >
            <MaterialCommunityIcons name="navigation-variant" size={20} color="white" />
            <Text style={styles.fullButtonText}>NAVIGATE TO PICKUP</Text>
          </TouchableOpacity>
        )}

        {activeOrder.status === 'packed' && (
          <TouchableOpacity
            style={[styles.fullButton, { backgroundColor: ZEPTO_GREEN }]}
            onPress={handleMarkPickedUp}
          >
            <MaterialCommunityIcons name="package-variant-closed" size={20} color="white" />
            <Text style={styles.fullButtonText}>MARK PICKED UP</Text>
          </TouchableOpacity>
        )}

        {(activeOrder.status === 'picked_up' || activeOrder.status === 'out_for_delivery') && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#333' }]}
              onPress={handleNavigate}
            >
              <MaterialCommunityIcons name="navigation" size={20} color="white" />
              <Text style={styles.buttonText}>NAVIGATE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: riderCoords ? ZEPTO_GREEN : '#999' },
              ]}
              onPress={handleNavigate}
              disabled={loading || !riderCoords}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>CONTINUE DELIVERY</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 1,
  },
  orderNumberTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  orderDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadgeContainer: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: ZEPTO_PURPLE,
    letterSpacing: 0.5,
  },
  stepperContainer: {
    backgroundColor: 'white',
    paddingVertical: 20,
    marginBottom: 8,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ZEPTO_GREEN,
  },
  locationStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  locationCoords: {
    fontSize: 13,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  locationWarningText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 12,
  },
  enableLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  enableLocationBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  addressContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  addressRow: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 20,
    paddingTop: 6,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  addressDetails: {
    flex: 1,
    marginLeft: 12,
    gap: 24,
  },
  addressPoint: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  pointSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  coordText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inlineCall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  inlineCallText: {
    fontSize: 13,
    fontWeight: '700',
    color: ZEPTO_PURPLE,
  },
  itemsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  itemNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quantityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    color: '#1F1F1F',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  earningsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  earningLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  earningValue: {
    fontSize: 14,
    color: '#1F1F1F',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalEarningLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  totalEarningValue: {
    fontSize: 18,
    fontWeight: '900',
    color: ZEPTO_GREEN,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  fullButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
  },
  acceptButton: {
    backgroundColor: ZEPTO_PURPLE,
  },
  disabledButton: {
    backgroundColor: '#E5E5E5',
  },
  disabledAcceptText: {
    color: '#999',
    fontWeight: '900',
    fontSize: 14,
  },
  rejectButtonText: {
    color: '#666',
    fontWeight: '900',
    fontSize: 14,
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
  },
  fullButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#888',
  },
});
