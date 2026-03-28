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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { OnlineToggle } from '../components/OnlineToggle';
import { StatsCard } from '../components/StatsCard';
import { OrderCard } from '../components/OrderCard';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { useOrders } from '../hooks/useOrders';
import { useLocation } from '../hooks/useLocation';
import { logout, setUser } from '../store/slices/authSlice';
import { riderApi } from '../services/api';
import type { HomeScreenProps } from '../types/navigation';
import type { Rider } from '../types/rider';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrder, availableOrders } = useOrders();
  const { isTracking, startTracking, stopTracking, startSocketTracking, stopSocketTracking } = useLocation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);

  const handleToggleOnline = useCallback(async (value: boolean) => {
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
        await startTracking();
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
  }, [dispatch, user, startTracking, stopTracking, startSocketTracking, stopSocketTracking]);

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
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'Rider'}</Text>
          <Text style={styles.subGreeting}>
            {user?.isOnline ? 'You are online' : 'You are offline'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
          <Text style={styles.profileInitial}>
            {(user?.name || 'R').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <OnlineToggle
          isOnline={user?.isOnline || false}
          onToggle={handleToggleOnline}
          loading={toggling}
        />

        <View style={styles.statsContainer}>
          <StatsCard
            title="Today's Deliveries"
            value={user?.totalDeliveries || 0}
            subtitle="Total: 0"
          />
          <StatsCard
            title="Today's Earnings"
            value={`₹${0}`}
            color={COLORS.success}
            subtitle="This week: ₹0"
          />
        </View>

        <View style={styles.statsContainer}>
          <StatsCard
            title="Rating"
            value={user?.rating?.toFixed(1) || '0.0'}
            color={COLORS.warning}
          />
          <StatsCard
            title="Acceptance Rate"
            value={`${user?.acceptanceRate || 0}%`}
            color={COLORS.primary}
          />
        </View>

        {currentOrder && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Order</Text>
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
              style={styles.navigateButton}
              onPress={() =>
                navigation.navigate('Navigation', {
                  orderId: currentOrder.id,
                  order: currentOrder,
                })
              }
            >
              <Text style={styles.navigateButtonText}>Start Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        {availableOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Orders</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AvailableOrders')}
              >
                <Text style={styles.seeAll}>See All ({availableOrders.length})</Text>
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
              onReject={() => {}}
            />
          </View>
        )}

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Earnings')}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AvailableOrders')}
          >
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionLabel}>Orders</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subGreeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.surface,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  navigateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  navigateButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});
