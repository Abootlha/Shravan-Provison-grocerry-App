import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/constants';
import { OnlineToggle } from '../components/OnlineToggle';
import { StatsCard } from '../components/StatsCard';
import { OrderCard } from '../components/OrderCard';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import { logout, setUser } from '../store/slices/authSlice';
import { riderApi } from '../services/api';
import { locationService } from '../services/location';
import type { HomeScreenProps } from '../types/navigation';
import type { Rider } from '../types/rider';

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrder, availableOrders } = useOrders();
  const { isTracking, currentLocation, startTracking, stopTracking, startSocketTracking, stopSocketTracking } = useLocation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [locationEnabled, setLocationEnabled] = React.useState(false);
  const [locationAddress, setLocationAddress] = React.useState<string>('');

  const checkLocationPermission = useCallback(async () => {
    const hasPermission = await locationService.hasPermissions();
    setLocationEnabled(hasPermission);
    if (hasPermission) {
      const loc = await locationService.getCurrentLocation();
      if (loc) {
        setLocationAddress(`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
      }
    }
  }, []);

  useEffect(() => {
    checkLocationPermission();
    const interval = setInterval(checkLocationPermission, 10000);
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkLocationPermission();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkLocationPermission]);

  const handleEnableLocation = useCallback(async () => {
    const granted = await locationService.requestPermissions();
    if (granted) {
      checkLocationPermission();
      return;
    }

    if (Platform.OS === 'android') {
      Linking.openSettings().catch(() => {
        Alert.alert('Error', 'Unable to open settings');
      });
    } else {
      Alert.alert(
        'Location Required',
        'Please enable location services in Settings to use the rider app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [checkLocationPermission]);

  const handleToggleOnline = useCallback(async (value: boolean) => {
    if (value && !locationEnabled) {
      Alert.alert(
        'Location Required',
        'You must enable location services to go online and receive orders. Please enable location in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: handleEnableLocation },
        ]
      );
      return;
    }

    setToggling(true);
    try {
      await riderApi.updateAvailability(value);
      dispatch(
        setUser({
          ...(user as Rider),
          isOnline: value,
        })
      );

      if (value) {
        const trackingStarted = await startTracking();
        if (!trackingStarted) {
          Alert.alert('Location Required', 'Please allow location access to go online and receive live navigation updates.');
          await riderApi.updateAvailability(false);
          dispatch(
            setUser({
              ...(user as Rider),
              isOnline: false,
            })
          );
          return;
        }

        startSocketTracking(user?.id || '');
      } else {
        stopTracking();
        stopSocketTracking();
      }
    } catch {
      Alert.alert('Error', 'Failed to update availability');
    } finally {
      setToggling(false);
    }
  }, [dispatch, user, startTracking, stopTracking, startSocketTracking, stopSocketTracking, locationEnabled, handleEnableLocation]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          stopTracking();
          stopSocketTracking();
          dispatch(logout());
          navigation.replace('Login');
        },
      },
    ]);
  }, [dispatch, navigation, stopTracking, stopSocketTracking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkLocationPermission();
    setTimeout(() => setRefreshing(false), 1000);
  }, [checkLocationPermission]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hey {user?.name?.split(' ')[0] || 'Rider'},</Text>
          <View style={styles.onlineStatusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: user?.isOnline ? ZEPTO_GREEN : '#AAA' }]} />
            <Text style={styles.subGreeting}>
              {user?.isOnline ? 'Active & Receiving Orders' : 'Offline - Go Online to work'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={checkLocationPermission}
            style={[styles.locationButton, !locationEnabled && styles.locationButtonDisabled]}
          >
            <MaterialCommunityIcons
              name={locationEnabled ? 'map-marker-radius' : 'map-marker-off'}
              size={20}
              color={locationEnabled ? ZEPTO_GREEN : '#EF4444'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
            <MaterialCommunityIcons name="logout-variant" size={20} color={ZEPTO_PURPLE} />
          </TouchableOpacity>
        </View>
      </View>

      {!locationEnabled && (
        <View style={styles.locationWarning}>
          <View style={styles.warningContent}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Location Services Disabled</Text>
              <Text style={styles.warningSubtitle}>
                Enable location to go online and accept orders
              </Text>
            </View>
            <TouchableOpacity style={styles.enableLocationBtn} onPress={handleEnableLocation}>
              <Text style={styles.enableLocationText}>Enable</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {locationEnabled && locationAddress ? (
        <View style={styles.locationInfo}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
          <Text style={styles.locationInfoText}>{locationAddress}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ZEPTO_PURPLE} />
        }
      >
        <View style={styles.toggleSection}>
          <OnlineToggle
            isOnline={user?.isOnline || false}
            onToggle={handleToggleOnline}
            loading={toggling}
            disabled={!locationEnabled}
          />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatsCard
              title="Today's Orders"
              value={user?.totalDeliveries || 0}
              icon="package-variant"
            />
            <StatsCard
              title="Today's Earnings"
              value={`₹${(user?.totalEarnings || 0).toFixed(0)}`}
              color={ZEPTO_GREEN}
              icon="currency-inr"
            />
          </View>
          <View style={styles.statsRow}>
            <StatsCard
              title="Rating"
              value={typeof user?.rating === 'number' ? user.rating.toFixed(1) : '0.0'}
              color="#FF9800"
              icon="star"
            />
            <StatsCard
              title="Online Hours"
              value="4.5h"
              color={ZEPTO_PURPLE}
              icon="clock-outline"
            />
          </View>
        </View>

        {currentOrder && (
          <View style={styles.activeOrderSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTIVE ORDER</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>READY</Text>
              </View>
            </View>
            <View style={styles.activeOrderCard}>
              <OrderCard
                order={currentOrder}
                onPress={() =>
                  navigation.navigate('OrderDetail', {
                    orderId: currentOrder.id,
                    order: currentOrder,
                  })
                }
              />
              <TouchableOpacity
                style={styles.navigateAction}
                onPress={() =>
                  navigation.navigate('Navigation', {
                    orderId: currentOrder.id,
                    order: currentOrder,
                  })
                }
              >
                <MaterialCommunityIcons name="navigation-variant" size={20} color="white" />
                <Text style={styles.navigateActionText}>START NAVIGATION</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {availableOrders.length > 0 && !currentOrder && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NEW REQUESTS</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AvailableOrders')}>
                <Text style={styles.seeAll}>SEE ALL ({availableOrders.length})</Text>
              </TouchableOpacity>
            </View>
            <OrderCard
              order={availableOrders[0]}
              showActions
              onAccept={() =>
                navigation.navigate('OrderDetail', {
                  orderId: availableOrders[0].id,
                  order: availableOrders[0],
                })
              }
            />
          </View>
        )}

        <View style={styles.menuGrid}>
          <Text style={styles.sectionTitle}>QUICK MENU</Text>
          <View style={styles.menuRow}>
            <MenuButton
              label="Earnings"
              icon="wallet-outline"
              onPress={() => navigation.navigate('Earnings')}
              color="#4F46E5"
            />
            <MenuButton
              label="Orders"
              icon="history"
              onPress={() => navigation.navigate('AvailableOrders')}
              color="#EF4444"
            />
            <MenuButton
              label="Profile"
              icon="account-outline"
              onPress={() => navigation.navigate('Profile')}
              color="#10B981"
            />
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const MenuButton = ({ label, icon, onPress, color }: any) => (
  <TouchableOpacity style={styles.menuBtn} onPress={onPress}>
    <View style={[styles.menuIconBox, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  subGreeting: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationButtonDisabled: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationWarning: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  warningSubtitle: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 1,
  },
  enableLocationBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  enableLocationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  locationInfoText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  toggleSection: {
    marginBottom: 8,
  },
  statsGrid: {
    gap: 12,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    marginTop: 24,
  },
  activeOrderSection: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ZEPTO_GREEN,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: ZEPTO_GREEN,
  },
  activeOrderCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  navigateAction: {
    flexDirection: 'row',
    backgroundColor: ZEPTO_PURPLE,
    margin: 12,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  navigateActionText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: 12,
    color: ZEPTO_PURPLE,
    fontWeight: '800',
  },
  menuGrid: {
    marginTop: 32,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    borderRadius: 24,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  menuBtn: {
    alignItems: 'center',
    width: 80,
  },
  menuIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '700',
  },
  bottomPadding: {
    height: 100,
  },
});
