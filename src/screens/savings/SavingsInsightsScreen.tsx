import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavingsStore } from '@/store/savingsStore';
import { useTransactionStore } from '@/store/transactionStore';
import { formatCurrency } from '@/utils/formatters';
import theme from '@/theme';

const monthsBack = 6;

const SavingsInsightsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const goals = useSavingsStore((s) => s.goals);
  const getTotalSavedAmount = useSavingsStore((s) => s.getTotalSavedAmount);

  const transactions = useTransactionStore((s) => s.transactions);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);

  useEffect(() => {
    // Ensure we have transactions loaded for history chart
    fetchTransactions().catch(() => {});
  }, [fetchTransactions]);

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const completedPendingCashOut = useMemo(
    () => goals.filter((g) => g.status === 'completed' && (g.current_amount ?? 0) > 0),
    [goals]
  );
  const cashedOutGoals = useMemo(
    () => goals.filter((g) => g.status === 'completed' && (g.current_amount ?? 0) <= 0),
    [goals]
  );

  const historyBuckets = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = d.toLocaleString(undefined, { month: 'short' });
      buckets.push({ key, label, total: 0 });
    }

    transactions
      .filter((t) => t.status === 'completed' && (t.type === 'deposit' || t.type === 'round_up'))
      .forEach((t) => {
        const d = new Date(t.completed_at ?? t.created_at);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const bucket = buckets.find((b) => b.key === key);
        if (bucket) bucket.total += t.amount;
      });

    return buckets;
  }, [transactions]);

  const maxBucket = useMemo(() => Math.max(1, ...historyBuckets.map((b) => b.total)), [historyBuckets]);
  const totalSaved = getTotalSavedAmount();

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Insights</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Hero Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Icon name="pie-chart" size={24} color={theme.colors.accent} />
              <Text style={styles.summaryTitle}>Total Saved Across Goals</Text>
            </View>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSaved)}</Text>
            <Text style={styles.summarySubtext}>Includes all active and completed goals</Text>
          </View>

          {/* Stat Grid */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: theme.colors.accent }]}>
              <Text style={styles.statLabel}>Active Goals</Text>
              <Text style={styles.statValue}>{activeGoals.length}</Text>
            </View>
            <View style={[styles.statCard, { borderColor: theme.colors.info }]}>
              <Text style={styles.statLabel}>Completed (Uncashed)</Text>
              <Text style={styles.statValue}>{completedPendingCashOut.length}</Text>
            </View>
            <View style={[styles.statCard, { borderColor: theme.colors.textSecondary }]}>
              <Text style={styles.statLabel}>Cashed Out</Text>
              <Text style={styles.statValue}>{cashedOutGoals.length}</Text>
            </View>
          </View>

          {/* History Chart */}
          <Text style={styles.sectionTitle}>Savings History</Text>
          <View style={styles.chartContainer}>
            {historyBuckets.map((b, idx) => {
              const widthPct = Math.round((b.total / maxBucket) * 100);
              return (
                <View key={b.key ?? idx} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{b.label}</Text>
                  <View style={styles.chartBarBg}>
                    <View style={[styles.chartBarFill, { width: `${widthPct}%` }]} />
                  </View>
                  <Text style={styles.chartValue}>{formatCurrency(b.total)}</Text>
                </View>
              );
            })}
          </View>

          {/* Recent Activity */}
          <Text style={styles.sectionTitle}>Recent Savings Activity</Text>
          <View style={styles.activityList}>
            {transactions
              .filter((t) => t.status === 'completed' && (t.type === 'deposit' || t.type === 'round_up' || t.type === 'withdrawal'))
              .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())
              .slice(0, 5)
              .map((t) => (
                <View key={t.id} style={styles.activityItem}>
                  <View style={[styles.activityIcon, t.type === 'withdrawal' ? styles.iconWithdrawal : styles.iconDeposit]}>
                    <Icon name={t.type === 'withdrawal' ? 'south' : 'north'} size={18} color={theme.colors.surface} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>
                      {t.type === 'round_up' ? 'Round-up' : t.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}
                    </Text>
                    <Text style={styles.activitySubtitle}>
                      {new Date(t.completed_at ?? t.created_at).toLocaleDateString()} · {t.category}
                    </Text>
                  </View>
                  <Text style={[styles.activityAmount, t.type === 'withdrawal' ? styles.negative : styles.positive]}>
                    {t.type === 'withdrawal' ? '-' : '+'}{formatCurrency(t.amount)}
                  </Text>
                </View>
              ))}
            {transactions.filter((t) => t.status === 'completed' && (t.type === 'deposit' || t.type === 'round_up' || t.type === 'withdrawal')).length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Recent Activity</Text>
                <Text style={styles.emptyDescription}>Your savings activity will show up here.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: theme.fontSizes.lg, fontFamily: theme.fonts.bold, color: theme.colors.textPrimary },
  headerSpacer: { width: 48, height: 48 },
  scrollView: { flex: 1 },
  content: { paddingBottom: 40 },
  summaryCard: {
    marginHorizontal: theme.spacing.base,
    marginTop: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.DEFAULT,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { marginLeft: 8, color: theme.colors.textPrimary, fontFamily: theme.fonts.semiBold },
  summaryAmount: { marginTop: 8, fontSize: 24, color: theme.colors.textPrimary, fontFamily: theme.fonts.bold },
  summarySubtext: { marginTop: 4, color: theme.colors.textSecondary },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    marginTop: theme.spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.base,
    alignItems: 'center',
    borderWidth: 1,
  },
  statLabel: { color: theme.colors.textSecondary, fontFamily: theme.fonts.medium },
  statValue: { marginTop: 4, fontSize: 20, color: theme.colors.textPrimary, fontFamily: theme.fonts.bold },
  sectionTitle: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.base,
  },
  chartContainer: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    ...theme.shadows.sm,
  },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  chartLabel: { width: 48, color: theme.colors.textSecondary },
  chartBarBg: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.backgroundLight,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  chartBarFill: { height: 12, backgroundColor: theme.colors.accent, borderRadius: 6 },
  chartValue: { width: 100, textAlign: 'right', color: theme.colors.textSecondary },
  goalCard: {
    marginHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
  },
  goalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalTitle: { fontFamily: theme.fonts.semiBold, color: theme.colors.textPrimary },
  goalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  goalMetaText: { color: theme.colors.textSecondary },
  goalMetaSubText: { color: theme.colors.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { marginTop: 8, fontFamily: theme.fonts.bold, color: theme.colors.textPrimary },
  emptyDescription: { marginTop: 4, color: theme.colors.textSecondary },

  activityList: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.base,
    ...theme.shadows.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.base,
  },
  iconWithdrawal: { backgroundColor: theme.colors.error },
  iconDeposit: { backgroundColor: theme.colors.accent },
  activityInfo: { flex: 1 },
  activityTitle: { color: theme.colors.textPrimary, fontFamily: theme.fonts.semiBold },
  activitySubtitle: { color: theme.colors.textSecondary },
  activityAmount: { fontFamily: theme.fonts.bold },
  positive: { color: theme.colors.accent },
  negative: { color: theme.colors.error },
});

export default SavingsInsightsScreen;
