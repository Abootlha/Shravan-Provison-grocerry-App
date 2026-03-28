import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { StatsCard } from '../components/StatsCard';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { fetchEarnings } from '../store/slices/earningsSlice';
import type { EarningsScreenProps } from '../types/navigation';

type Period = 'daily' | 'weekly' | 'monthly';

export const EarningsScreen: React.FC<EarningsScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { todayEarnings, weekEarnings, monthEarnings, stats, loading } = useAppSelector(
    (state) => state.earnings
  );
  const [period, setPeriod] = useState<Period>('daily');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (selectedPeriod?: Period) => {
      await dispatch(fetchEarnings(selectedPeriod || period));
    },
    [dispatch, period]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const renderPeriodButton = (p: Period, label: string) => (
    <TouchableOpacity
      style={[styles.periodButton, period === p && styles.periodButtonActive]}
      onPress={() => setPeriod(p)}
    >
      <Text
        style={[
          styles.periodButtonText,
          period === p && styles.periodButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const getEarnings = () => {
    switch (period) {
      case 'daily':
        return todayEarnings;
      case 'weekly':
        return weekEarnings;
      case 'monthly':
        return monthEarnings;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.periodSelector}>
          {renderPeriodButton('daily', 'Today')}
          {renderPeriodButton('weekly', 'This Week')}
          {renderPeriodButton('monthly', 'This Month')}
        </View>

        <View style={styles.mainEarning}>
          <Text style={styles.earningLabel}>
            {period === 'daily'
              ? "Today's Earnings"
              : period === 'weekly'
              ? "This Week's Earnings"
              : "This Month's Earnings"}
          </Text>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <Text style={styles.earningValue}>₹{getEarnings().toFixed(2)}</Text>
          )}
        </View>

        <View style={styles.statsGrid}>
          <StatsCard
            title="Deliveries"
            value={stats.deliveries}
            subtitle={
              period === 'daily'
                ? 'Today'
                : period === 'weekly'
                ? 'This Week'
                : 'This Month'
            }
          />
          <StatsCard
            title="Rating"
            value={stats.rating.toFixed(1)}
            color={COLORS.warning}
            subtitle="Average"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatsCard
            title="Acceptance"
            value={`${stats.acceptanceRate}%`}
            color={COLORS.primary}
            subtitle="Rate"
          />
          <StatsCard
            title="Earnings"
            value={`₹${monthEarnings.toFixed(0)}`}
            color={COLORS.success}
            subtitle="This Month"
          />
        </View>

        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Earnings Breakdown</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Daily Average</Text>
              <Text style={styles.breakdownValue}>
                ₹{(todayEarnings / Math.max(1, new Date().getDate())).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Per Delivery</Text>
              <Text style={styles.breakdownValue}>
                ₹{stats.deliveries > 0 ? (getEarnings() / stats.deliveries).toFixed(2) : '0.00'}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownRowLast]}>
              <Text style={styles.breakdownLabel}>Best Day</Text>
              <Text style={styles.breakdownValue}>₹{todayEarnings.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.md,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: COLORS.surface,
  },
  mainEarning: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  earningLabel: {
    fontSize: 14,
    color: COLORS.surface,
    opacity: 0.9,
    marginBottom: 8,
  },
  earningValue: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.surface,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  breakdown: {
    marginTop: SPACING.md,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  breakdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breakdownRowLast: {
    borderBottomWidth: 0,
  },
  breakdownLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
});
