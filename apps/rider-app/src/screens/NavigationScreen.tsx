import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Banner, Button, EmptyState, IconButton, Pill, Skeleton } from '../components/ui';
import { PaymentCallout, StatusStepper } from '../components/order';
import { SlideToConfirm } from '../components/SlideToConfirm';
import { OtpSheet } from '../components/OtpSheet';
import { RejectSheet } from '../components/RejectSheet';
import { DeliveryMap, DeliveryMapHandle } from '../components/DeliveryMap';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { useOrderById } from '../hooks/useOrderById';
import { useRouteLine } from '../hooks/useRouteLine';
import { rejectOrder, updateOrderStatus } from '../store/slices/orderSlice';
import { fetchMetrics } from '../store/slices/metricsSlice';
import { elevation, radii, spacing, useTheme } from '../theme';
import { callPhone, distanceKm, formatDistance, formatMoney, formatTime, openNavigation } from '../utils/format';
import { addressDetails, cashToCollect, destinationOf, stageOf } from '../utils/orderFlow';
import type { NavigationScreenProps } from '../types/navigation';
import type { OrderStatus } from '../types/order';

export const NavigationScreen: React.FC<NavigationScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const { orderId } = route.params;
  const { order, ended, loading, error, reload } = useOrderById(orderId);
  const rider = useAppSelector((s) => s.location.current);
  const locationPermission = useAppSelector((s) => s.location.permission);
  const pendingOrderId = useAppSelector((s) => s.orders.pendingOrderId);
  const mapRef = useRef<DeliveryMapHandle>(null);
  const [follow, setFollow] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(320);
  const [actionError, setActionError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const destination = order ? destinationOf(order) : null;
  const riderCoords = rider ? { latitude: rider.latitude, longitude: rider.longitude } : null;
  const routeOrigin =
    destination?.leg === 'customer' && !riderCoords ? (order?.pickup.address.coordinates ?? null) : riderCoords;
  const routeLine = useRouteLine(routeOrigin, destination?.coords ?? null, order?.routeCoordinates ?? []);

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  const back = () => (navigation.canGoBack() ? navigation.goBack() : goHome());

  if (ended) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <EmptyState
          icon={ended.kind === 'cancelled' ? 'close-circle-outline' : 'account-switch-outline'}
          title={
            ended.kind === 'cancelled'
              ? `Order ${ended.orderNumber ?? ''} was cancelled`.replace(/\s+/g, ' ')
              : ended.self
                ? 'Order released'
                : `Order ${ended.orderNumber ?? ''} was reassigned`.replace(/\s+/g, ' ')
          }
          message={
            ended.kind === 'cancelled'
              ? `${ended.reason ? `Reason: ${ended.reason}. ` : ''}If you already picked it up, return the items to the store.`
              : 'You no longer need to deliver this order.'
          }
          actionLabel="Back to home"
          onAction={goHome}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      </View>
    );
  }

  if (!order || !destination) {
    return (
      <View
        style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }}
      >
        <IconButton icon="arrow-left" label="Go back" onPress={back} size={44} />
        {loading ? (
          <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            <Skeleton height={windowHeight * 0.45} radius={radii.lg} />
            <Skeleton height={180} radius={radii.lg} />
          </View>
        ) : (
          <EmptyState
            icon="map-marker-question-outline"
            title="Could not load this order"
            message={error ?? undefined}
            actionLabel="Try again"
            onAction={reload}
          />
        )}
      </View>
    );
  }

  const stage = stageOf(order);
  const pending = pendingOrderId === order.id;
  const cash = cashToCollect(order);
  const away = distanceKm(riderCoords, destination.coords);
  const remaining =
    order.activeLeg && order.distanceRemainingMeters != null
      ? order.distanceRemainingMeters / 1000
      : routeLine?.distanceMeters != null
        ? routeLine.distanceMeters / 1000
        : away;
  const details = destination.leg === 'customer' ? addressDetails(order) : '';

  const advance = async (status: OrderStatus): Promise<boolean> => {
    setActionError(null);
    const result = await dispatch(updateOrderStatus({ orderId: order.id, status }));
    if (updateOrderStatus.fulfilled.match(result)) {
      setFollow(true);
      return true;
    }
    setActionError(result.payload?.message ?? 'Could not update the order.');
    return false;
  };

  const submitOtp = async (otp: string): Promise<string | null> => {
    const result = await dispatch(updateOrderStatus({ orderId: order.id, status: 'delivered', deliveryOtp: otp }));
    if (updateOrderStatus.fulfilled.match(result)) {
      setOtpOpen(false);
      dispatch(fetchMetrics());
      navigation.replace('DeliveryComplete', { order: result.payload });
      return null;
    }
    return result.payload?.message ?? 'Could not complete the delivery.';
  };

  const submitRelease = async (reason: string) => {
    const result = await dispatch(rejectOrder({ orderId: order.id, reason }));
    if (rejectOrder.fulfilled.match(result)) {
      setReleaseOpen(false);
      goHome();
      return null;
    }
    return result.payload?.message ?? 'Could not release this order.';
  };

  const primaryAction = () => {
    switch (order.status) {
      case 'assigned':
        return (
          <View style={[styles.waiting, { backgroundColor: c.warningSoft }]}>
            <ActivityIndicator color={c.warningText} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" color={c.warningText}>
                Store is packing the order
              </AppText>
              <AppText variant="bodySm" color={c.warningText}>
                Head to the store. Pickup unlocks when it is packed.
              </AppText>
            </View>
          </View>
        );
      case 'packed':
        return (
          <SlideToConfirm
            label="Slide to confirm pickup"
            onConfirm={() => advance('picked_up')}
            disabled={pending}
            testID="slide-pickup"
          />
        );
      case 'picked_up':
        return (
          <Button
            label="Start delivery"
            icon="moped"
            onPress={() => advance('out_for_delivery')}
            loading={pending}
            testID="start-delivery"
          />
        );
      case 'out_for_delivery':
        return (
          <Button
            label="Arrived · Enter delivery code"
            icon="form-textbox-password"
            variant="success"
            onPress={() => {
              setActionError(null);
              setOtpOpen(true);
            }}
            testID="enter-otp"
          />
        );
      default:
        return <Button label="Back to home" onPress={goHome} />;
    }
  };

  const canNavigate = Boolean(destination.coords);

  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceAlt }}>
      <DeliveryMap
        ref={mapRef}
        store={order.pickup.address.coordinates}
        customer={order.delivery.address.coordinates}
        rider={rider}
        route={routeLine}
        leg={destination.leg}
        follow={follow}
        onUserPan={() => setFollow(false)}
        bottomInset={sheetHeight}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <IconButton
          icon="arrow-left"
          label="Go back"
          onPress={back}
          size={48}
          style={[{ backgroundColor: c.surface }, elevation(theme, 2)]}
        />
        <View style={[styles.topPill, { backgroundColor: c.surface }, elevation(theme, 2)]}>
          <MaterialCommunityIcons
            name={destination.leg === 'store' ? 'storefront' : 'home-map-marker'}
            size={20}
            color={c.brandText}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="subtle">
              {destination.leg === 'store' ? 'To store' : 'To customer'}
            </AppText>
            <AppText variant="body" weight="bold" numberOfLines={1}>
              {remaining != null ? formatDistance(remaining) : canNavigate ? 'Locating you…' : 'No map location'}
              {order.durationMinutes != null && destination.leg === 'customer'
                ? ` · ${Math.max(1, Math.round(order.durationMinutes))} min`
                : ''}
            </AppText>
          </View>
        </View>
      </View>

      {/* Map controls */}
      <View style={[styles.mapControls, { bottom: sheetHeight + spacing.md }]} pointerEvents="box-none">
        <IconButton
          icon="fit-to-screen-outline"
          label="Show whole route"
          onPress={() => {
            setFollow(false);
            mapRef.current?.fitAll();
          }}
          size={48}
          style={[{ backgroundColor: c.surface }, elevation(theme, 2)]}
        />
        <IconButton
          icon={follow ? 'crosshairs-gps' : 'crosshairs'}
          label={follow ? 'Following your location' : 'Follow my location'}
          tone={follow ? 'brand' : 'default'}
          onPress={() => {
            setFollow(true);
            mapRef.current?.recenter();
          }}
          size={48}
          style={[{ backgroundColor: follow ? c.brandSoft : c.surface }, elevation(theme, 2)]}
        />
      </View>

      {/* Bottom sheet */}
      <View
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          { backgroundColor: c.surface, paddingBottom: insets.bottom + spacing.lg, maxHeight: windowHeight * 0.78 },
          elevation(theme, 3),
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
          onPress={() => setExpanded((v) => !v)}
          style={styles.handleArea}
          hitSlop={8}
        >
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
        </Pressable>

        <ScrollView bounces={false} contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <Pill label={stage.pill.label} tone={stage.pill.tone} icon={stage.pill.icon} />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              hitSlop={10}
            >
              <AppText variant="bodySm" weight="semibold" tone="brand">
                {order.orderNumber} ›
              </AppText>
            </Pressable>
          </View>

          <View>
            <AppText variant="h1">{stage.title}</AppText>
            <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
              {stage.hint}
            </AppText>
          </View>

          <View style={[styles.destination, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="h3" numberOfLines={1}>
                {destination.name}
              </AppText>
              {details ? (
                <AppText variant="bodySm" weight="bold" numberOfLines={1}>
                  {details}
                </AppText>
              ) : null}
              <AppText variant="bodySm" tone="muted" numberOfLines={expanded ? 4 : 2}>
                {destination.address || 'Address not available'}
              </AppText>
              {destination.leg === 'customer' && order.delivery.address.landmark ? (
                <AppText variant="bodySm" tone="muted" numberOfLines={1}>
                  Landmark: {order.delivery.address.landmark}
                </AppText>
              ) : null}
            </View>
            <View style={{ gap: spacing.sm }}>
              <IconButton
                icon="phone"
                label={destination.leg === 'store' ? 'Call store' : 'Call customer'}
                tone="success"
                disabled={!destination.phone}
                onPress={() => callPhone(destination.phone, destination.leg === 'store' ? 'the store' : 'the customer')}
              />
            </View>
          </View>

          <Button
            label={canNavigate ? 'Navigate in Google Maps' : 'No map location saved'}
            icon="navigation-variant"
            variant="secondary"
            size="md"
            disabled={!canNavigate}
            onPress={() => destination.coords && openNavigation(destination.coords, riderCoords)}
          />

          {destination.leg === 'customer' && order.delivery.instructions ? (
            <Banner
              tone="warning"
              icon="note-text-outline"
              title="Delivery note"
              message={order.delivery.instructions}
            />
          ) : null}

          {destination.leg === 'customer' && cash > 0 ? <PaymentCallout order={order} /> : null}
          {destination.leg === 'store' && cash > 0 && expanded ? (
            <AppText variant="bodySm" tone="warning">
              Cash on delivery: collect {formatMoney(cash)} from the customer.
            </AppText>
          ) : null}

          {expanded ? (
            <View style={{ paddingVertical: spacing.sm }}>
              <StatusStepper order={order} />
            </View>
          ) : null}

          {locationPermission === 'denied' || locationPermission === 'services_off' ? (
            <Banner
              tone="warning"
              icon="map-marker-off"
              title="Location is off"
              message="The store and customer cannot see you moving."
            />
          ) : null}

          {actionError ? <Banner tone="danger" title={actionError} onDismiss={() => setActionError(null)} /> : null}

          {primaryAction()}

          {order.status === 'assigned' ? (
            <Button
              label="Can't do this order? Release it"
              variant="ghost"
              size="md"
              onPress={() => setReleaseOpen(true)}
            />
          ) : null}
          {expanded && order.estimatedDeliveryTime && destination.leg === 'customer' ? (
            <AppText variant="caption" tone="subtle" align="center">
              Customer expects delivery by {formatTime(order.estimatedDeliveryTime)}
            </AppText>
          ) : null}
        </ScrollView>
      </View>

      <OtpSheet visible={otpOpen} order={order} onClose={() => setOtpOpen(false)} onSubmit={submitOtp} />
      <RejectSheet
        visible={releaseOpen}
        orderNumber={order.orderNumber}
        mode="release"
        onClose={() => setReleaseOpen(false)}
        onSubmit={submitRelease}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  topPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  mapControls: { position: 'absolute', right: spacing.lg, gap: spacing.md },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
  },
  handleArea: { alignItems: 'center', paddingVertical: spacing.md },
  handle: { width: 44, height: 5, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.md, padding: spacing.lg },
});
