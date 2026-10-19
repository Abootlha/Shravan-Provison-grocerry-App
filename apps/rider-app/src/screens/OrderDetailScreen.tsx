import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AppText,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  IconButton,
  Pill,
  ScreenHeader,
  SectionTitle,
  Skeleton,
} from '../components/ui';
import { ItemsList, PaymentCallout, RouteLegs, StatusStepper } from '../components/order';
import { RejectSheet } from '../components/RejectSheet';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { useOrderById } from '../hooks/useOrderById';
import { acceptOffer, rejectOrder } from '../store/slices/orderSlice';
import { elevation, radii, spacing, useTheme } from '../theme';
import { callPhone, formatDateTime, formatMoney, formatPhone, formatTime, openNavigation } from '../utils/format';
import { addressDetails, itemCount, riderEarning, stageOf } from '../utils/orderFlow';
import type { OrderDetailScreenProps } from '../types/navigation';

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { orderId } = route.params;
  const { order, ended, loading, error, reload, isLive } = useOrderById(orderId);
  const pendingOrderId = useAppSelector((s) => s.orders.pendingOrderId);
  const rider = useAppSelector((s) => s.location.current);
  const expired = useAppSelector((s) => Boolean(s.orders.expiredOfferIds[orderId]));
  const [rejecting, setRejecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Home'));

  if (ended) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScreenHeader title={ended.orderNumber || 'Order'} onBack={back} />
        <EmptyState
          icon={ended.kind === 'cancelled' ? 'close-circle-outline' : 'account-switch-outline'}
          title={
            ended.kind === 'cancelled'
              ? 'This order was cancelled'
              : ended.self
                ? 'You declined this order'
                : 'This order was reassigned'
          }
          message={ended.reason ? `Reason: ${ended.reason}` : 'There is nothing more to do for this order.'}
          actionLabel="Back to home"
          onAction={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
        />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScreenHeader title="Order details" onBack={back} />
        {loading ? (
          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <Skeleton height={110} radius={radii.lg} />
            <Skeleton height={180} radius={radii.lg} />
            <Skeleton height={140} radius={radii.lg} />
          </View>
        ) : (
          <EmptyState
            icon="file-alert-outline"
            title="Could not load this order"
            message={error ?? 'It may have been reassigned or removed.'}
            actionLabel="Try again"
            onAction={reload}
          />
        )}
      </View>
    );
  }

  const stage = stageOf(order);
  const isOffer = order.status === 'confirmed';
  const pending = pendingOrderId === order.id;
  const details = addressDetails(order);
  const receiverDiffers = Boolean(order.delivery.receiverName) && order.delivery.receiverName !== order.delivery.name;
  const customerPhone = order.delivery.receiverPhone || order.delivery.phone;
  const count = itemCount(order);
  const bill = [
    order.itemTotal != null ? { label: 'Item total', value: order.itemTotal } : null,
    order.deliveryFee ? { label: 'Delivery fee', value: order.deliveryFee } : null,
    order.packagingFee ? { label: 'Packaging', value: order.packagingFee } : null,
    order.discount ? { label: 'Discount', value: -order.discount } : null,
    order.tip ? { label: 'Tip', value: order.tip } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  const accept = async () => {
    const result = await dispatch(acceptOffer(order.id));
    if (acceptOffer.fulfilled.match(result)) {
      navigation.replace('Navigation', { orderId: order.id });
    } else {
      Alert.alert('Could not accept', result.payload?.message ?? 'Please try again.');
    }
  };

  const submitReject = async (reason: string) => {
    const result = await dispatch(rejectOrder({ orderId: order.id, reason }));
    if (rejectOrder.fulfilled.match(result)) {
      setRejecting(false);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return null;
    }
    return result.payload?.message ?? 'Could not decline this order.';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const timeline = [
    { label: 'Order placed', at: order.createdAt },
    { label: 'Accepted', at: order.acceptedAt },
    { label: 'Packed', at: order.packedAt },
    { label: 'Picked up', at: order.pickedUpAt },
    { label: 'Out for delivery', at: order.outForDeliveryAt },
    { label: 'Delivered', at: order.deliveredAt },
    { label: 'Cancelled', at: order.cancelledAt },
  ].filter((entry) => entry.at);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title={order.orderNumber}
        subtitle={order.createdAt ? `Placed ${formatDateTime(order.createdAt)}` : undefined}
        onBack={back}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
      >
        <Card style={{ gap: spacing.lg }}>
          <View style={styles.rowBetween}>
            <Pill label={stage.pill.label} tone={stage.pill.tone} icon={stage.pill.icon} />
            <AppText variant="bodySm" tone="muted">
              {count} item{count === 1 ? '' : 's'}
            </AppText>
          </View>
          {!isOffer && order.status !== 'cancelled' ? <StatusStepper order={order} /> : null}
          <View style={[styles.earn, { backgroundColor: c.surfaceAlt }]}>
            <MaterialCommunityIcons name="wallet-outline" size={20} color={c.textMuted} />
            <AppText variant="bodySm" tone="muted" style={{ flex: 1 }}>
              Your earning (delivery fee{order.tip ? ' + tip' : ''})
            </AppText>
            <AppText variant="h3" numeric>
              {formatMoney(riderEarning(order))}
            </AppText>
          </View>
        </Card>

        <PaymentCallout order={order} />

        <Card style={{ gap: spacing.md }}>
          <SectionTitle title="Customer" style={{ marginBottom: 0 }} />
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{order.delivery.name}</AppText>
              {customerPhone ? (
                <AppText variant="bodySm" tone="muted" numeric>
                  {formatPhone(customerPhone)}
                </AppText>
              ) : (
                <AppText variant="bodySm" tone="warning">
                  No phone number on this order
                </AppText>
              )}
            </View>
            {!isOffer ? (
              <IconButton
                icon="phone"
                label="Call customer"
                tone="success"
                disabled={!customerPhone}
                onPress={() => callPhone(customerPhone, 'the customer')}
              />
            ) : null}
          </View>
          {receiverDiffers ? (
            <Banner
              tone="info"
              icon="account-arrow-right"
              title={`Hand over to ${order.delivery.receiverName}`}
              message={order.delivery.receiverPhone ? formatPhone(order.delivery.receiverPhone) : undefined}
            />
          ) : null}
          <Divider />
          <View style={{ gap: 4 }}>
            {order.delivery.address.type ? (
              <AppText variant="caption" tone="subtle">
                {order.delivery.address.type}
              </AppText>
            ) : null}
            {details ? (
              <AppText variant="body" weight="bold">
                {details}
              </AppText>
            ) : null}
            <AppText variant="body">{order.delivery.address.full || 'Address not available'}</AppText>
            {order.delivery.address.landmark ? (
              <AppText variant="bodySm" tone="muted">
                Landmark: {order.delivery.address.landmark}
              </AppText>
            ) : null}
            {!order.delivery.address.coordinates ? (
              <AppText variant="bodySm" tone="warning">
                No map location saved for this address. Call the customer for directions.
              </AppText>
            ) : null}
          </View>
          {order.delivery.instructions ? (
            <Banner
              tone="warning"
              icon="note-text-outline"
              title="Delivery note"
              message={order.delivery.instructions}
            />
          ) : null}
          {order.delivery.address.coordinates && !isOffer ? (
            <Button
              label="Directions to customer"
              icon="navigation-variant"
              variant="outline"
              size="md"
              onPress={() => openNavigation(order.delivery.address.coordinates!, rider)}
            />
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Route" />
          <RouteLegs order={order} rider={rider} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionTitle title={`Items (${count})`} style={{ marginBottom: 0 }} />
          <ItemsList order={order} />
          {bill.length ? (
            <>
              <Divider />
              {bill.map((line) => (
                <View key={line.label} style={styles.rowBetween}>
                  <AppText variant="bodySm" tone="muted">
                    {line.label}
                  </AppText>
                  <AppText variant="bodySm" tone={line.value < 0 ? 'success' : 'muted'} numeric>
                    {line.value < 0 ? `−${formatMoney(-line.value)}` : formatMoney(line.value)}
                  </AppText>
                </View>
              ))}
            </>
          ) : null}
          <Divider />
          <View style={styles.rowBetween}>
            <AppText variant="body" weight="bold">
              Order total
            </AppText>
            <AppText variant="h3" numeric>
              {formatMoney(order.totalAmount)}
            </AppText>
          </View>
        </Card>

        {timeline.length ? (
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle title="Timeline" style={{ marginBottom: 0 }} />
            {timeline.map((entry) => (
              <View key={entry.label} style={styles.rowBetween}>
                <AppText variant="bodySm">{entry.label}</AppText>
                <AppText variant="bodySm" tone="muted" numeric>
                  {formatDateTime(entry.at)}
                </AppText>
              </View>
            ))}
            {order.estimatedDeliveryTime && order.status !== 'delivered' ? (
              <View style={styles.rowBetween}>
                <AppText variant="bodySm" weight="semibold">
                  Expected delivery
                </AppText>
                <AppText variant="bodySm" weight="semibold" numeric>
                  {formatTime(order.estimatedDeliveryTime)}
                </AppText>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {isLive && order.status !== 'delivered' && order.status !== 'cancelled' ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: c.surface, paddingBottom: insets.bottom + spacing.md, borderTopColor: c.border },
            elevation(theme, 3),
          ]}
        >
          {isOffer && expired ? (
            <Banner
              tone="info"
              icon="timer-off-outline"
              title="Request expired"
              message="The store will give this order to another rider."
            />
          ) : isOffer ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                label="Decline"
                variant="outline"
                fullWidth={false}
                style={{ flex: 1 }}
                disabled={pending}
                onPress={() => setRejecting(true)}
              />
              <Button
                label="Accept order"
                icon="check-bold"
                fullWidth={false}
                style={{ flex: 2 }}
                loading={pending}
                onPress={accept}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button
                label={stage.leg === 'store' ? 'Open pickup map' : 'Open delivery map'}
                icon="map-marker-path"
                onPress={() => navigation.navigate('Navigation', { orderId: order.id })}
              />
              {order.status === 'assigned' ? (
                <Button
                  label="Can't do this order? Release it"
                  variant="ghost"
                  size="md"
                  onPress={() => setRejecting(true)}
                />
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      <RejectSheet
        visible={rejecting}
        orderNumber={order.orderNumber}
        mode={isOffer ? 'decline' : 'release'}
        onClose={() => setRejecting(false)}
        onSubmit={submitReject}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  earn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
