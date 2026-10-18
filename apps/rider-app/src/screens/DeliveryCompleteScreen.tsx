import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Button, Card, Divider } from '../components/ui';
import { useAppSelector } from '../hooks/useAuth';
import { spacing, useTheme } from '../theme';
import { formatMoney, formatTime } from '../utils/format';
import { riderEarning } from '../utils/orderFlow';
import type { DeliveryCompleteScreenProps } from '../types/navigation';

export const DeliveryCompleteScreen: React.FC<DeliveryCompleteScreenProps> = ({ navigation, route }) => {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { order } = route.params;
  const today = useAppSelector((s) => s.metrics.data?.today);
  const online = useAppSelector((s) => Boolean(s.auth.user?.isOnline));
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [scale]);

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    return true;
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goHome);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const earning = riderEarning(order);
  const collected = order.paymentMethod === 'COD' ? order.totalAmount : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxxl }]}>
        <Animated.View style={[styles.badge, { backgroundColor: c.success, transform: [{ scale }] }]}>
          <MaterialCommunityIcons name="check-bold" size={56} color="#FFFFFF" />
        </Animated.View>
        <AppText variant="h1" align="center" style={{ marginTop: spacing.xl }}>
          Delivered
        </AppText>
        <AppText variant="body" tone="muted" align="center" style={{ marginTop: spacing.xs }}>
          {order.orderNumber}
          {order.deliveredAt ? ` · ${formatTime(order.deliveredAt)}` : ''}
        </AppText>

        <Card style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <View style={styles.row}>
            <AppText variant="body" tone="muted">
              You earned
            </AppText>
            <AppText variant="h1" numeric tone="success">
              {formatMoney(earning)}
            </AppText>
          </View>
          <AppText variant="caption" tone="subtle">
            Delivery fee {formatMoney(order.deliveryFee)}
            {order.tip ? ` + tip ${formatMoney(order.tip)}` : ''}. Final payout is confirmed by the store.
          </AppText>
          {collected > 0 ? (
            <>
              <Divider />
              <View style={styles.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color={c.warningText} />
                  <AppText variant="body" weight="semibold">
                    Cash collected
                  </AppText>
                </View>
                <AppText variant="h3" numeric>
                  {formatMoney(collected)}
                </AppText>
              </View>
              <AppText variant="caption" tone="subtle">
                Hand this cash over to the store at the end of your shift.
              </AppText>
            </>
          ) : null}
          {today ? (
            <>
              <Divider />
              <View style={styles.row}>
                <AppText variant="bodySm" tone="muted">
                  Today so far
                </AppText>
                <AppText variant="bodySm" weight="semibold" numeric>
                  {today.deliveries} deliveries · {formatMoney(today.earnings)}
                </AppText>
              </View>
            </>
          ) : null}
        </Card>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button label={online ? 'Back to orders' : 'Done'} icon="home" onPress={goHome} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.xl, alignItems: 'stretch', maxWidth: 560, width: '100%', alignSelf: 'center' },
  badge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  footer: { paddingHorizontal: spacing.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
