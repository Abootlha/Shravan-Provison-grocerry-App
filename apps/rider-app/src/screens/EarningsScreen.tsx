import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Banner, Card, EmptyState, ScreenHeader, Skeleton } from '../components/ui';
import { StatTile } from '../components/order';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { fetchMetrics } from '../store/slices/metricsSlice';
import { radii, spacing, useTheme } from '../theme';
import { formatAgo, formatMoney } from '../utils/format';
import type { EarningsScreenProps } from '../types/navigation';

type Period = 'today' | 'week' | 'month';

const TABS: { key: Period; label: string; empty: string }[] = [
  { key: 'today', label: 'Today', empty: 'No deliveries yet today' },
  { key: 'week', label: 'This week', empty: 'No deliveries this week' },
  { key: 'month', label: 'This month', empty: 'No deliveries this month' },
];

export const EarningsScreen: React.FC<EarningsScreenProps> = ({ navigation }) => {
  const { colors: c } = useTheme();
  const dispatch = useAppDispatch();
  const { data, loading, error, fetchedAt } = useAppSelector((s) => s.metrics);
  const [period, setPeriod] = useState<Period>('today');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchMetrics());
  }, [dispatch]);

  const refresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMetrics());
    setRefreshing(false);
  };

  const current = data?.[period];
  const tab = TABS.find((t) => t.key === period)!;
  const perDelivery = current && current.deliveries > 0 ? current.earnings / current.deliveries : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="Earnings" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} />}
      >
        <View style={[styles.tabs, { backgroundColor: c.border }]} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.key === period;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setPeriod(t.key)}
                style={[styles.tab, active && { backgroundColor: c.surface }]}
              >
                <AppText variant="bodySm" weight={active ? 'bold' : 'medium'} tone={active ? 'default' : 'muted'}>
                  {t.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {error && !data ? (
          <EmptyState
            icon="cloud-alert"
            title="Could not load earnings"
            message={error}
            actionLabel="Try again"
            onAction={refresh}
            loading={loading}
          />
        ) : !data ? (
          <View style={{ gap: spacing.lg }}>
            <Skeleton height={150} radius={radii.xl} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Skeleton height={110} radius={radii.lg} style={{ flex: 1 }} />
              <Skeleton height={110} radius={radii.lg} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <>
            {error ? (
              <Banner
                tone="warning"
                title="Showing saved numbers"
                message={error}
                actionLabel="Retry"
                onAction={refresh}
              />
            ) : null}
            <View style={[styles.hero, { backgroundColor: c.brand }]}>
              <AppText variant="overline" color="rgba(255,255,255,0.85)">
                {tab.label} · estimated
              </AppText>
              <AppText variant="display" numeric color="#FFFFFF" style={{ fontSize: 42, lineHeight: 50 }}>
                {formatMoney(current?.earnings ?? 0)}
              </AppText>
              <AppText variant="bodySm" color="rgba(255,255,255,0.9)">
                {current?.deliveries ?? 0} deliver{current?.deliveries === 1 ? 'y' : 'ies'}
                {perDelivery != null ? ` · ${formatMoney(Math.round(perDelivery))} per delivery` : ''}
              </AppText>
            </View>

            {current && current.deliveries === 0 ? (
              <Card>
                <EmptyState
                  icon="moped-outline"
                  title={tab.empty}
                  message="Go online from the home screen to receive orders. Earnings appear here after each delivery."
                  style={{ paddingVertical: spacing.xl }}
                />
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile
                label="All-time deliveries"
                value={String(data.totalDeliveries)}
                icon="package-variant-closed-check"
                tone="brand"
              />
              <StatTile
                label="Rating"
                value={data.avgRating > 0 ? data.avgRating.toFixed(1) : 'New'}
                icon="star"
                tone="warning"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile
                label="Acceptance rate"
                value={`${Math.round(data.acceptanceRate)}%`}
                icon="check-decagram"
                tone="success"
              />
              <StatTile
                label="This month"
                value={String(data.month.deliveries)}
                icon="calendar-month"
                hint="deliveries"
              />
            </View>

            <Card style={{ flexDirection: 'row', gap: spacing.md }}>
              <MaterialCommunityIcons name="information-outline" size={20} color={c.textMuted} />
              <AppText variant="bodySm" tone="muted" style={{ flex: 1 }}>
                Earnings are the delivery fees and tips of your delivered orders. They are an estimate, not a payout
                statement. Weeks start on Monday{data.timezone ? ` (${data.timezone})` : ''}.
                {fetchedAt ? ` Updated ${formatAgo(new Date(fetchedAt).toISOString())}.` : ''}
              </AppText>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  tabs: { flexDirection: 'row', borderRadius: radii.md, padding: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xs },
});
