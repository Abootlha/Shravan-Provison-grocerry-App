import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/constants';
import { StatsCard } from '../components/StatsCard';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { fetchEarnings } from '../store/slices/earningsSlice';
import type { EarningsScreenProps } from '../types/navigation';

const ZEPTO_PURPLE = '#7C3AED';
const ZEPTO_GREEN = '#10B981';

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
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.periodSelectorOuter}>
        <View style={styles.periodSelector}>
          {renderPeriodButton('daily', 'Today')}
          {renderPeriodButton('weekly', 'Week')}
          {renderPeriodButton('monthly', 'Month')}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ZEPTO_PURPLE} />
        }
      >
        <View style={styles.mainEarningCard}>
          <View style={styles.earningHeader}>
            <Text style={styles.earningLabel}>
              {period === 'daily'
                ? "TOTAL EARNING TODAY"
                : period === 'weekly'
                  ? "TOTAL EARNING THIS WEEK"
                  : "TOTAL EARNING THIS MONTH"}
            </Text>
            <View style={styles.payoutBadge}>
              <Text style={styles.payoutText}>READY FOR PAYOUT</Text>
            </View>
          </View>

          <View style={styles.earningValueRow}>
            {loading && !refreshing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.earningValue}>₹{getEarnings().toFixed(0)}</Text>
            )}
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.6)" />
          </View>

          <View style={styles.earningFooter}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>ORDERS</Text>
              <Text style={styles.footerValue}>{stats.deliveries}</Text>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>TIPS</Text>
              <Text style={styles.footerValue}>₹{(getEarnings() * 0.1).toFixed(0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatsCard
            title="Avg Rating"
            value={stats.rating.toFixed(1)}
            icon="star"
            color="#FF9800"
          />
          <StatsCard
            title="Acceptance"
            value={`${stats.acceptanceRate}%`}
            icon="check-circle-outline"
            color={ZEPTO_GREEN}
          />
        </View>

        <View style={styles.breakdown}>
          <Text style={styles.sectionTitle}>EARNINGS BREAKDOWN</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <View style={styles.labelCol}>
                <Text style={styles.breakdownLabel}>Daily Average</Text>
                <Text style={styles.breakdownSub}>Avg. per day worked</Text>
              </View>
              <Text style={styles.breakdownValue}>
                ₹{(todayEarnings / Math.max(1, new Date().getDate())).toFixed(0)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.labelCol}>
                <Text style={styles.breakdownLabel}>Per Delivery</Text>
                <Text style={styles.breakdownSub}>Includes basic + surge</Text>
              </View>
              <Text style={styles.breakdownValue}>
                ₹{stats.deliveries > 0 ? (getEarnings() / stats.deliveries).toFixed(0) : '0'}
              </Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownRowLast]}>
              <View style={styles.labelCol}>
                <Text style={styles.breakdownLabel}>Surge Pay</Text>
                <Text style={styles.breakdownSub}>During peak hours</Text>
              </View>
              <Text style={[styles.breakdownValue, { color: ZEPTO_GREEN }]}>₹0</Text>
            </View>
          </View>
        </View>

        <View style={styles.helpCard}>
          <MaterialCommunityIcons name="help-circle-outline" size={20} color="#666" />
          <Text style={styles.helpText}>How is my earning calculated?</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#999" />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1F1F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  periodSelectorOuter: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '700',
  },
  periodButtonTextActive: {
    color: ZEPTO_PURPLE,
  },
  mainEarningCard: {
    backgroundColor: ZEPTO_PURPLE,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: ZEPTO_PURPLE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '900',
    letterSpacing: 1,
  },
  payoutBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payoutText: {
    fontSize: 8,
    fontWeight: '900',
    color: 'white',
  },
  earningValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  earningValue: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
  },
  earningFooter: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  footerItem: {
    flex: 1,
  },
  footerDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  footerLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '900',
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 15,
    fontWeight: '900',
    color: 'white',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  breakdown: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  breakdownCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  breakdownRowLast: {
    borderBottomWidth: 0,
  },
  labelCol: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#1F1F1F',
    fontWeight: '700',
  },
  breakdownSub: {
    fontSize: 11,
    color: '#AAA',
    marginTop: 2,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 15,
    color: '#1F1F1F',
    fontWeight: '800',
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
});

