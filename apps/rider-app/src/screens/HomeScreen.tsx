import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Banner, Card, IconButton, SectionTitle, Skeleton } from '../components/ui';
import { ActiveOrderCard, OfferCard, OnlineToggle, StatTile } from '../components/order';
import { RejectSheet } from '../components/RejectSheet';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { useSocketState } from '../hooks/useSocketState';
import { checkLocationPermission } from '../hooks/useRiderRuntime';
import { clearAvailabilityError, refreshRider, setAvailability } from '../store/slices/authSlice';
import {
  acceptOffer,
  dismissEnded,
  dismissOffer,
  fetchCurrentOrder,
  fetchOffers,
  rejectOrder,
} from '../store/slices/orderSlice';
import { fetchMetrics } from '../store/slices/metricsSlice';
import { locationService } from '../services/location';
import { radii, spacing, useTheme } from '../theme';
import { formatMoney } from '../utils/format';
import type { HomeScreenProps } from '../types/navigation';
import type { Order } from '../types/order';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const availabilityPending = useAppSelector((s) => s.auth.availabilityPending);
  const availabilityError = useAppSelector((s) => s.auth.availabilityError);
  const {
    currentOrder,
    offers: allOffers,
    offerSeenAt,
    expiredOfferIds,
    ended,
    loadError,
    pendingOrderId,
    currentLoaded,
  } = useAppSelector((s) => s.orders);
  const metrics = useAppSelector((s) => s.metrics);
  const location = useAppSelector((s) => s.location);
  const socketState = useSocketState();
  const [refreshing, setRefreshing] = useState(false);
  const [declining, setDeclining] = useState<Order | null>(null);

  const online = Boolean(user?.isOnline);
  // New requests are only for riders who are online.
  const offers = online ? allOffers : [];
  const rider = location.current;
  const notices = useMemo(() => Object.values(ended).filter((e) => !e.self), [ended]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(refreshRider()),
      dispatch(fetchCurrentOrder()),
      dispatch(fetchOffers()),
      dispatch(fetchMetrics()),
      checkLocationPermission(),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const openSettings = () => {
    Linking.openSettings().catch(() =>
      Alert.alert('Open Settings', 'Open your phone settings and allow location for this app.')
    );
  };

  const goOnline = async () => {
    if (Platform.OS !== 'web') {
      const granted = await locationService.requestPermissions();
      const enabled = await checkLocationPermission();
      if (!granted || !enabled) {
        Alert.alert(
          'Location needed',
          granted
            ? 'Turn on location (GPS) to go online. Customers and the store track your trip with it.'
            : 'Allow location access to go online. Customers and the store track your trip with it.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: openSettings },
          ]
        );
        return;
      }
    }
    dispatch(setAvailability(true));
  };

  const onToggle = (next: boolean) => {
    if (next) {
      goOnline();
      return;
    }
    if (currentOrder) {
      Alert.alert(
        'Go offline?',
        'You will stop getting new requests. Your current order stays with you until it is delivered.',
        [
          { text: 'Stay online', style: 'cancel' },
          { text: 'Go offline', style: 'destructive', onPress: () => dispatch(setAvailability(false)) },
        ]
      );
      return;
    }
    dispatch(setAvailability(false));
  };

  const accept = async (order: Order) => {
    const result = await dispatch(acceptOffer(order.id));
    if (acceptOffer.fulfilled.match(result)) {
      navigation.navigate('Navigation', { orderId: result.payload.id });
    } else {
      Alert.alert('Could not accept', result.payload?.message ?? 'Please try again.');
    }
  };

  const submitDecline = async (reason: string) => {
    if (!declining) return null;
    const result = await dispatch(rejectOrder({ orderId: declining.id, reason }));
    if (rejectOrder.fulfilled.match(result)) {
      setDeclining(null);
      return null;
    }
    return result.payload?.message ?? 'Could not decline this order.';
  };

  const firstName = (user?.name || 'Rider').split(' ')[0];
  const m = metrics.data;
  const metricsLoading = metrics.loading && !m;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: c.bg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => navigation.navigate('Profile')}
          style={[styles.avatar, { backgroundColor: c.brandSoft }]}
        >
          <AppText variant="h3" tone="brand">
            {firstName.charAt(0).toUpperCase()}
          </AppText>
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="bodySm" tone="muted">
            {greeting()},
          </AppText>
          <AppText variant="h2" numberOfLines={1}>
            {firstName}
          </AppText>
        </View>
        <View
          style={[styles.live, { backgroundColor: socketState === 'connected' ? c.successSoft : c.warningSoft }]}
          accessibilityLabel={socketState === 'connected' ? 'Live updates connected' : 'Reconnecting to live updates'}
        >
          <View style={[styles.liveDot, { backgroundColor: socketState === 'connected' ? c.success : c.warning }]} />
          <AppText variant="caption" weight="bold" color={socketState === 'connected' ? c.successText : c.warningText}>
            {socketState === 'connected' ? 'Live' : 'Connecting'}
          </AppText>
        </View>
        <IconButton icon="wallet-outline" label="Earnings" onPress={() => navigation.navigate('Earnings')} size={44} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} colors={[c.brand]} />
        }
      >
        {location.permission === 'denied' || location.permission === 'services_off' ? (
          <Banner
            tone="danger"
            icon="map-marker-off"
            title={location.permission === 'denied' ? 'Location access is off' : 'GPS is turned off'}
            message="You need location to go online and get orders."
            actionLabel="Fix"
            onAction={openSettings}
          />
        ) : null}
        {location.backgroundWarning && (online || currentOrder) ? (
          <Banner
            tone="warning"
            icon="map-marker-alert"
            title="Live location pauses in the background"
            message={location.backgroundWarning}
            actionLabel="Settings"
            onAction={openSettings}
          />
        ) : null}
        {availabilityError ? (
          <Banner tone="danger" title={availabilityError} onDismiss={() => dispatch(clearAvailabilityError())} />
        ) : null}
        {loadError ? (
          <Banner tone="warning" icon="cloud-alert" title={loadError} actionLabel="Retry" onAction={refresh} />
        ) : null}
        {notices.map((notice) => (
          <Banner
            key={notice.orderId}
            tone="danger"
            icon={notice.kind === 'cancelled' ? 'close-circle' : 'account-switch'}
            title={
              notice.kind === 'cancelled'
                ? `Order ${notice.orderNumber ?? ''} was cancelled`.replace(/\s+/g, ' ')
                : `Order ${notice.orderNumber ?? ''} was reassigned`.replace(/\s+/g, ' ')
            }
            message={
              notice.reason && notice.kind === 'cancelled' ? `Reason: ${notice.reason}` : 'No action needed from you.'
            }
            onDismiss={() => dispatch(dismissEnded(notice.orderId))}
          />
        ))}

        <OnlineToggle
          online={online}
          onDelivery={Boolean(currentOrder)}
          pending={availabilityPending}
          onToggle={onToggle}
        />

        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            order={offer}
            seenAt={offerSeenAt[offer.id]}
            rider={rider}
            pending={pendingOrderId === offer.id}
            expired={Boolean(expiredOfferIds[offer.id])}
            onDismiss={() => dispatch(dismissOffer(offer.id))}
            onAccept={() => accept(offer)}
            onDecline={() => setDeclining(offer)}
            onOpen={() => navigation.navigate('OrderDetail', { orderId: offer.id })}
          />
        ))}

        {currentOrder ? (
          <View>
            <SectionTitle title="Current order" />
            <ActiveOrderCard
              order={currentOrder}
              rider={rider}
              onOpen={() => navigation.navigate('Navigation', { orderId: currentOrder.id })}
              onDetails={() => navigation.navigate('OrderDetail', { orderId: currentOrder.id })}
            />
          </View>
        ) : !currentLoaded ? (
          <Skeleton height={150} radius={radii.lg} />
        ) : online && offers.length === 0 ? (
          <Card style={styles.waiting}>
            <View style={[styles.waitingIcon, { backgroundColor: c.brandSoft }]}>
              <MaterialCommunityIcons name="radar" size={28} color={c.brandText} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Looking for orders</AppText>
              <AppText variant="bodySm" tone="muted">
                Keep the app open. New requests ring and vibrate.
              </AppText>
            </View>
          </Card>
        ) : null}

        <View>
          <SectionTitle
            title="Today"
            right={
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Earnings')} hitSlop={10}>
                <AppText variant="bodySm" weight="semibold" tone="brand">
                  All earnings ›
                </AppText>
              </Pressable>
            }
          />
          {metrics.error && !m ? (
            <Banner
              tone="warning"
              title="Could not load today's numbers"
              actionLabel="Retry"
              onAction={() => dispatch(fetchMetrics())}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              <View style={styles.statRow}>
                <StatTile
                  label="Deliveries today"
                  value={m ? String(m.today.deliveries) : '–'}
                  icon="package-variant-closed-check"
                  tone="brand"
                  loading={metricsLoading}
                />
                <StatTile
                  label="Earned today"
                  value={m ? formatMoney(m.today.earnings) : '–'}
                  icon="cash"
                  tone="success"
                  hint="Fees + tips (estimate)"
                  loading={metricsLoading}
                />
              </View>
              <View style={styles.statRow}>
                <StatTile
                  label="Rating"
                  value={m ? (m.avgRating > 0 ? m.avgRating.toFixed(1) : 'New') : '–'}
                  icon="star"
                  tone="warning"
                  loading={metricsLoading}
                />
                <StatTile
                  label="Acceptance"
                  value={m ? `${Math.round(m.acceptanceRate)}%` : '–'}
                  icon="check-decagram"
                  loading={metricsLoading}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <RejectSheet
        visible={Boolean(declining)}
        orderNumber={declining?.orderNumber ?? ''}
        mode="decline"
        onClose={() => setDeclining(null)}
        onSubmit={submitDecline}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  waitingIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.md },
});
