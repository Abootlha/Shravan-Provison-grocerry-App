import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Button, Card, IconName, Pill, tapHaptic } from './ui';
import { elevation, radii, spacing, useTheme } from '../theme';
import type { Coordinates, Order } from '../types/order';
import { distanceKm, formatDistance, formatMoney, formatTime } from '../utils/format';
import { cashToCollect, itemCount, riderEarning, stageOf, STEPS, stepIndex, stepTime } from '../utils/orderFlow';
import { OFFER_TIMEOUT_SECONDS } from '../utils/constants';

/* ------------------------------------------------------- OnlineToggle */

export const OnlineToggle: React.FC<{
  /** Receiving requests (server status available or busy). */
  online: boolean;
  /** Carrying an accepted order. Shown first: it is what the rider is doing. */
  onDelivery: boolean;
  pending: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}> = ({ online, onDelivery, pending, disabled, onToggle }) => {
  const theme = useTheme();
  const c = theme.colors;
  const filled = online || onDelivery;
  const bg = onDelivery ? c.brand : online ? c.success : c.surface;
  const fg = filled ? '#FFFFFF' : c.text;
  const soft = 'rgba(255,255,255,0.88)';
  const label = onDelivery
    ? online
      ? 'Online'
      : 'Offline after this order'
    : online
      ? 'You are online'
      : 'You are offline';
  const title = onDelivery ? 'On a delivery' : online ? 'Online' : 'Offline';
  const sub = onDelivery
    ? online
      ? 'New requests are paused until you deliver.'
      : 'Finish this order. You will not get new requests.'
    : online
      ? 'Waiting for orders near the store'
      : 'Go online to start receiving orders';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${title}. ${label}`}
      accessibilityState={{ checked: online, disabled: Boolean(disabled || pending), busy: pending }}
      accessibilityHint={online ? 'Double tap to go offline' : 'Double tap to go online'}
      disabled={disabled || pending}
      onPress={() => {
        tapHaptic();
        onToggle(!online);
      }}
      style={({ pressed }) => [
        styles.toggle,
        { backgroundColor: bg, opacity: pressed ? 0.92 : 1 },
        filled ? null : { borderWidth: 1, borderColor: c.border },
        elevation(theme, filled ? 2 : 1),
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="overline" color={filled ? soft : c.textSubtle}>
          {label}
        </AppText>
        <AppText variant="h1" color={fg} style={{ marginTop: 2 }}>
          {title}
        </AppText>
        <AppText variant="bodySm" color={filled ? soft : c.textMuted} style={{ marginTop: 2 }}>
          {sub}
        </AppText>
      </View>
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: online ? 'rgba(255,255,255,0.28)' : filled ? 'rgba(0,0,0,0.18)' : c.surfaceAlt,
            borderColor: filled ? 'transparent' : c.borderStrong,
          },
        ]}
      >
        <View
          style={[
            styles.switchKnob,
            { backgroundColor: online ? '#FFFFFF' : c.offline, alignSelf: online ? 'flex-end' : 'flex-start' },
          ]}
        >
          {pending ? (
            <ActivityIndicator size="small" color={online ? bg : '#FFFFFF'} />
          ) : (
            <MaterialCommunityIcons name="power" size={22} color={online ? bg : '#FFFFFF'} />
          )}
        </View>
      </View>
    </Pressable>
  );
};

/* ----------------------------------------------------------- StatTile */

export const StatTile: React.FC<{
  label: string;
  value: string;
  icon: IconName;
  hint?: string;
  tone?: 'brand' | 'success' | 'warning' | 'neutral';
  loading?: boolean;
}> = ({ label, value, icon, hint, tone = 'neutral', loading }) => {
  const { colors: c } = useTheme();
  const accent = { brand: c.brandText, success: c.successText, warning: c.warningText, neutral: c.textMuted }[tone];
  const soft = { brand: c.brandSoft, success: c.successSoft, warning: c.warningSoft, neutral: c.surfaceAlt }[tone];
  return (
    <Card style={styles.statTile} accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <MaterialCommunityIcons name={icon} size={18} color={accent} />
      </View>
      {loading ? (
        <View style={{ height: 32, justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={c.textSubtle} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <AppText variant="h1" numeric numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
      )}
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
};

/* ---------------------------------------------------------- RouteLegs */

export const RouteLegs: React.FC<{ order: Order; rider?: Coordinates | null; compact?: boolean }> = ({
  order,
  rider,
  compact,
}) => {
  const { colors: c } = useTheme();
  const toStore = distanceKm(rider, order.pickup.address.coordinates);
  const storeToCustomer = distanceKm(order.pickup.address.coordinates, order.delivery.address.coordinates);
  const lines = compact ? 1 : 2;
  return (
    <View>
      <View style={styles.leg}>
        <View style={styles.legRail}>
          <View style={[styles.legDot, { backgroundColor: c.text }]}>
            <MaterialCommunityIcons name="storefront" size={12} color={c.surface} />
          </View>
          <View style={[styles.legLine, { backgroundColor: c.borderStrong }]} />
        </View>
        <View style={styles.legBody}>
          <AppText variant="overline" tone="subtle">
            Pickup{toStore != null ? ` · ${formatDistance(toStore)} away` : ''}
          </AppText>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {order.pickup.name}
          </AppText>
          {order.pickup.address.full ? (
            <AppText variant="bodySm" tone="muted" numberOfLines={lines}>
              {order.pickup.address.full}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.leg}>
        <View style={styles.legRail}>
          <View style={[styles.legDot, { backgroundColor: c.success }]}>
            <MaterialCommunityIcons name="home" size={12} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.legBody}>
          <AppText variant="overline" tone="subtle">
            Drop{storeToCustomer != null ? ` · ${formatDistance(storeToCustomer)} from store` : ''}
          </AppText>
          <AppText variant="body" weight="semibold" numberOfLines={1}>
            {order.delivery.receiverName || order.delivery.name}
          </AppText>
          <AppText variant="bodySm" tone={order.delivery.address.full ? 'muted' : 'warning'} numberOfLines={lines}>
            {order.delivery.address.full || 'Address not available'}
          </AppText>
          {!order.delivery.address.coordinates ? (
            <AppText variant="caption" tone="warning" style={{ marginTop: 2 }}>
              No map location for this address
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
};

/* ---------------------------------------------------- PaymentCallout */

export const PaymentCallout: React.FC<{ order: Order; style?: object }> = ({ order, style }) => {
  const { colors: c } = useTheme();
  const cash = cashToCollect(order);
  if (cash > 0) {
    return (
      <View
        style={[styles.payment, { backgroundColor: c.warningSoft, borderColor: c.warning }, style]}
        accessibilityLabel={`Cash on delivery. Collect ${formatMoney(cash)}`}
      >
        <MaterialCommunityIcons name="cash-multiple" size={26} color={c.warningText} />
        <View style={{ flex: 1 }}>
          <AppText variant="overline" color={c.warningText}>
            Cash on delivery
          </AppText>
          <AppText variant="bodySm" color={c.warningText}>
            Collect from customer
          </AppText>
        </View>
        <AppText variant="h1" numeric color={c.warningText}>
          {formatMoney(cash)}
        </AppText>
      </View>
    );
  }
  const label = order.paymentMethod
    ? order.paymentMethod === 'COD'
      ? 'Cash already collected'
      : `Paid online (${order.paymentMethod})`
    : 'Payment method not shared';
  return (
    <View style={[styles.payment, { backgroundColor: c.successSoft, borderColor: 'transparent' }, style]}>
      <MaterialCommunityIcons name="check-decagram" size={24} color={c.successText} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="bold" color={c.successText}>
          {label}
        </AppText>
        <AppText variant="bodySm" color={c.successText}>
          Do not collect any money
        </AppText>
      </View>
    </View>
  );
};

/* ----------------------------------------------------- StatusStepper */

export const StatusStepper: React.FC<{ order: Order }> = ({ order }) => {
  const { colors: c } = useTheme();
  const current = stepIndex(order.status);
  return (
    <View style={styles.stepper} accessibilityLabel={`Progress: ${stageOf(order).pill.label}`}>
      {STEPS.map((step, index) => {
        const done = index <= current;
        const active = index === current;
        const time = stepTime(order, step.status);
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.stepTop}>
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: index === 0 ? 'transparent' : index <= current ? c.brand : c.border },
                ]}
              />
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: done ? c.brand : c.surface,
                    borderColor: done ? c.brand : c.borderStrong,
                    transform: [{ scale: active ? 1.15 : 1 }],
                  },
                ]}
              >
                {done && !active ? <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" /> : null}
              </View>
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: index === STEPS.length - 1 ? 'transparent' : index < current ? c.brand : c.border,
                  },
                ]}
              />
            </View>
            <AppText
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              tone={done ? 'default' : 'subtle'}
              align="center"
              numberOfLines={1}
            >
              {step.label}
            </AppText>
            <AppText variant="caption" tone="subtle" align="center" numeric style={{ fontSize: 10 }}>
              {time ? formatTime(time) : ' '}
            </AppText>
          </View>
        );
      })}
    </View>
  );
};

/* --------------------------------------------------------- OfferCard */

const useCountdown = (seenAt: number | undefined) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const end = (seenAt ?? now) + OFFER_TIMEOUT_SECONDS * 1000;
  return Math.max(0, Math.ceil((end - now) / 1000));
};

export const OfferCard: React.FC<{
  order: Order;
  seenAt?: number;
  rider?: Coordinates | null;
  pending: boolean;
  /** Countdown ran out: shown greyed out until the server reassigns it or the rider dismisses it. */
  expired?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss?: () => void;
  onOpen: () => void;
}> = ({ order, seenAt, rider, pending, expired, onAccept, onDecline, onDismiss, onOpen }) => {
  const theme = useTheme();
  const c = theme.colors;
  const seconds = useCountdown(seenAt);
  const progress = seconds / OFFER_TIMEOUT_SECONDS;
  const urgent = seconds <= 10;
  const earning = riderEarning(order);
  const cash = cashToCollect(order);
  const count = itemCount(order);

  return (
    <View
      style={[
        styles.offer,
        { backgroundColor: c.surface, borderColor: expired ? c.border : c.brand },
        expired ? null : elevation(theme, 2),
      ]}
    >
      <View style={[styles.offerTimerTrack, { backgroundColor: c.brandSoft }]}>
        <View
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: '100%',
            backgroundColor: urgent ? c.danger : c.brand,
          }}
        />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={styles.rowBetween}>
          {expired ? (
            <Pill label="Request expired" tone="neutral" icon="timer-off-outline" />
          ) : (
            <Pill label="New order request" tone="brand" icon="bell-ring" />
          )}
          {expired ? null : (
            <AppText
              variant="h3"
              numeric
              tone={urgent ? 'danger' : 'brand'}
              accessibilityLabel={`${seconds} seconds left to accept`}
              accessibilityLiveRegion={urgent ? 'polite' : 'none'}
            >
              {`0:${String(seconds).padStart(2, '0')}`}
            </AppText>
          )}
        </View>

        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="subtle">
              You earn
            </AppText>
            <AppText variant="display" numeric>
              {formatMoney(earning)}
            </AppText>
            <AppText variant="caption" tone="subtle">
              Delivery fee{order.tip ? ' + tip' : ''}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <AppText variant="bodySm" weight="semibold">
              {order.orderNumber}
            </AppText>
            <AppText variant="bodySm" tone="muted">
              {count} item{count === 1 ? '' : 's'} · {formatMoney(order.totalAmount)}
            </AppText>
            {cash > 0 ? <Pill label={`Collect ${formatMoney(cash)} cash`} tone="warning" icon="cash" /> : null}
            {order.paymentMethod && cash === 0 ? <Pill label="Prepaid" tone="success" icon="check" /> : null}
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="View order details" onPress={onOpen}>
          <RouteLegs order={order} rider={rider} compact />
        </Pressable>

        {expired ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="bodySm" tone="muted">
              You did not respond in time. The store will give this order to another rider.
            </AppText>
            {onDismiss ? <Button label="Dismiss" variant="outline" size="md" onPress={onDismiss} /> : null}
          </View>
        ) : (
          <View style={styles.offerActions}>
            <Button
              label="Decline"
              variant="outline"
              onPress={onDecline}
              disabled={pending}
              fullWidth={false}
              style={{ flex: 1 }}
            />
            <Button
              label="Accept order"
              icon="check-bold"
              onPress={onAccept}
              loading={pending}
              fullWidth={false}
              style={{ flex: 2 }}
              testID="accept-order"
            />
          </View>
        )}
      </View>
    </View>
  );
};

/* --------------------------------------------------- ActiveOrderCard */

export const ActiveOrderCard: React.FC<{
  order: Order;
  rider?: Coordinates | null;
  onOpen: () => void;
  onDetails: () => void;
}> = ({ order, rider, onOpen, onDetails }) => {
  const theme = useTheme();
  const stage = stageOf(order);
  const cash = cashToCollect(order);
  const destination = stage.leg === 'store' ? order.pickup.address.coordinates : order.delivery.address.coordinates;
  const away = distanceKm(rider, destination);
  return (
    <Card raised style={{ gap: spacing.md, borderWidth: 1.5, borderColor: theme.colors.brand }}>
      <View style={styles.rowBetween}>
        <Pill label={stage.pill.label} tone={stage.pill.tone} icon={stage.pill.icon} />
        <Pressable accessibilityRole="button" onPress={onDetails} hitSlop={10}>
          <AppText variant="bodySm" weight="semibold" tone="brand">
            {order.orderNumber} ›
          </AppText>
        </Pressable>
      </View>
      <View>
        <AppText variant="h2">{stage.title}</AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
          {stage.leg === 'store' ? order.pickup.name : order.delivery.receiverName || order.delivery.name}
          {away != null ? ` · ${formatDistance(away)} away` : ''}
        </AppText>
      </View>
      {cash > 0 ? <Pill label={`Collect ${formatMoney(cash)} cash`} tone="warning" icon="cash" /> : null}
      <Button
        label={stage.leg === 'store' ? 'Open pickup map' : 'Open delivery map'}
        icon="map-marker-path"
        onPress={onOpen}
        testID="open-delivery"
      />
    </Card>
  );
};

/* --------------------------------------------------------- ItemsList */

/** Only real http(s) images; anything else shows the placeholder. */
const imageUri = (value?: string | null) => (value && /^https?:\/\//i.test(value.trim()) ? value.trim() : null);

/**
 * Product photo so the rider can pick the right item at the counter. Images
 * come from the catalogue (often other stores' CDNs), so a broken or missing
 * one falls back to a package icon instead of an empty box.
 */
export const ItemThumb: React.FC<{ uri?: string | null; quantity: number; name: string }> = ({ uri, quantity, name }) => {
  const { colors: c } = useTheme();
  const source = imageUri(uri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return (
    <View style={[styles.thumb, { borderColor: c.border, backgroundColor: '#FFFFFF' }]}>
      {source && !failed ? (
        <Image
          source={{ uri: source }}
          style={styles.thumbImage}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityLabel={name}
        />
      ) : (
        <MaterialCommunityIcons name="package-variant-closed" size={24} color={c.textSubtle} />
      )}
      <View style={[styles.thumbQty, { backgroundColor: c.brand, borderColor: c.surface }]}>
        <AppText variant="caption" weight="bold" numeric color="#FFFFFF">
          {quantity}×
        </AppText>
      </View>
    </View>
  );
};

export const ItemsList: React.FC<{ order: Order }> = ({ order }) => {
  if (!order.items.length) {
    return (
      <AppText variant="bodySm" tone="muted">
        Item list not available for this order.
      </AppText>
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {order.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <ItemThumb uri={item.image} quantity={item.quantity} name={item.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" numberOfLines={2}>
              {item.name}
            </AppText>
            <AppText variant="caption" tone="muted" numeric>
              {item.quantity} × {formatMoney(item.price)}
            </AppText>
          </View>
          <AppText variant="bodySm" tone="muted" numeric>
            {formatMoney(item.price * item.quantity)}
          </AppText>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  toggle: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 120,
  },
  switchTrack: {
    width: 84,
    height: 48,
    borderRadius: 24,
    padding: 4,
    justifyContent: 'center',
    borderWidth: 1,
  },
  switchKnob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTile: { flex: 1, gap: 2, padding: spacing.md, minWidth: 0 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  leg: { flexDirection: 'row', gap: spacing.md },
  legRail: { width: 22, alignItems: 'center' },
  legDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  legLine: { width: 2, flex: 1, marginVertical: 2, minHeight: 14 },
  legBody: { flex: 1, paddingBottom: spacing.md },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.lg,
  },
  stepper: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  stepTop: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 2 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offer: { borderRadius: radii.xl, borderWidth: 1.5, overflow: 'hidden' },
  offerTimerTrack: { height: 6, width: '100%' },
  offerActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: 48, height: 48, borderRadius: radii.sm },
  thumbQty: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
