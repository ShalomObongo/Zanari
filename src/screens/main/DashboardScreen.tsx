import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';
import { useRoundUpStore } from '@/store/roundUpStore';
import { formatCurrency, formatRelativeDate, mapTransactionType, getTimeBasedGreeting } from '@/utils/formatters';
import { useTheme } from '@/theme';
import theme from '@/theme'; // Static theme for StyleSheet

interface DashboardScreenProps {}

const DashboardScreen: React.FC<DashboardScreenProps> = () => {
  const navigation = useNavigation<any>();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const themeColors = useTheme();
  
  // Zustand stores
  const user = useAuthStore((state) => state.user);
  const wallets = useWalletStore((state) => state.wallets);
  const fetchWallets = useWalletStore((state) => state.fetchWallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const isRefreshingWallets = useWalletStore((state) => state.isRefreshing);
  
  const transactions = useTransactionStore((state) => state.transactions);
  const fetchTransactions = useTransactionStore((state) => state.fetchTransactions);
  const refreshTransactions = useTransactionStore((state) => state.refreshTransactions);
  const isRefreshingTransactions = useTransactionStore((state) => state.isRefreshing);
  
  const goals = useSavingsStore((state) => state.goals);
  const fetchGoals = useSavingsStore((state) => state.fetchGoals);
  const refreshGoals = useSavingsStore((state) => state.refreshGoals);
  const isRefreshingGoals = useSavingsStore((state) => state.isRefreshing);

  const roundUpRule = useRoundUpStore((state) => state.rule);
  const fetchRoundUpRule = useRoundUpStore((state) => state.fetchRule);

  const isRefreshing = isRefreshingWallets || isRefreshingTransactions || isRefreshingGoals;
  
  // Initial data fetch on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchWallets(),
          fetchTransactions(),
          fetchGoals({ page: 1 }),
          fetchRoundUpRule().catch(() => {
            // Silently fail if round-up rule doesn't exist yet
            console.log('Round-up rule not found - user may not have set it up yet');
          }),
        ]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Get wallet balances
  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const savingsWallet = wallets.find(w => w.wallet_type === 'savings');
  
  const mainBalance = mainWallet?.balance ?? 0;
  const savingsBalance = savingsWallet?.balance ?? 0;
  
  // Calculate round-up balance from active goals with lock-in enabled
  const roundUpBalance = goals
    .filter(g => g.status === 'active' && g.lock_in_enabled)
    .reduce((sum, g) => sum + g.current_amount, 0);
  
  const getTotalBalance = (): number => {
    return mainBalance + savingsBalance;
  };
  
  // Get recent transactions (limit to 3, completed only)
  const recentTransactions = transactions
    .filter(t => t.status === 'completed')
    .slice(0, 3);

  // Get active savings goals (limit to 2)
  const activeSavingsGoals = goals
    .filter(g => g.status === 'active')
    .slice(0, 2);

  const getTransactionTitle = (transaction: typeof transactions[0]) => {
    // For transfers, extract and display sender/recipient name
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      try {
        let metadata: { recipientName?: string; senderName?: string } = {};

        // Try parsing external_reference first
        if (transaction.external_reference) {
          try {
            metadata = JSON.parse(transaction.external_reference);
          } catch {
            // Not JSON, skip
          }
        }

        // If no name found, try external_transaction_id (for sender in external transfers)
        if (!metadata.recipientName && !metadata.senderName && transaction.external_transaction_id) {
          try {
            metadata = JSON.parse(transaction.external_transaction_id);
          } catch {
            // Not JSON, skip
          }
        }

        if (transaction.type === 'transfer_out') {
          const recipientName = metadata.recipientName || 'Zanari User';
          return `Sent to ${recipientName}`;
        } else {
          const senderName = metadata.senderName || 'Zanari User';
          return `Received from ${senderName}`;
        }
      } catch {
        // Fallback
        if (transaction.type === 'transfer_out') {
          return 'Sent to Zanari User';
        } else {
          return 'Received from Zanari User';
        }
      }
    }

    // For non-transfer transactions, use merchant name or description
    return transaction.merchant_info?.name || transaction.description || 'Transaction';
  };

  const onRefresh = async () => {
    try {
      await Promise.all([
        refreshWallets(),
        refreshTransactions(),
        refreshGoals(),
      ]);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
  };

  const toggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'send':
        navigation.navigate('Transfer');
        break;
      case 'pay':
        navigation.navigate('Payment');
        break;
      case 'save':
        navigation.navigate('Savings');
        break;
      case 'topup':
        navigation.navigate('Payment', { mode: 'topup' });
        break;
      default:
        break;
    }
  };

  const renderQuickActions = () => {
    const actions = [
      { id: 'send', label: 'Send', icon: 'arrow-upward' },
      { id: 'pay', label: 'Pay', icon: 'receipt-long' },
      { id: 'save', label: 'Save', icon: 'savings' },
      { id: 'topup', label: 'Top Up', icon: 'add-card' }
    ];

    return (
      <View style={styles.quickActionsContainer}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.quickActionCard, { backgroundColor: themeColors.colors.surface }]}
            onPress={() => handleQuickAction(action.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconContainer, { backgroundColor: `${themeColors.colors.accent}15` }]}>
              <Icon name={action.icon} size={24} color={themeColors.colors.accentDarker} />
            </View>
            <Text style={[styles.quickActionLabel, { color: themeColors.colors.textPrimary }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRecentTransactions = () => {
    if (recentTransactions.length === 0) {
      return (
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtext}>Make your first payment to get started</Text>
          </View>
        </View>
      );
    }

    const getTransactionIcon = (type: string, description: string) => {
      if (type === 'credit') {
        return 'work';
      }
      // Check description for common categories
      if (description.toLowerCase().includes('music') || description.toLowerCase().includes('spotify')) {
        return 'music-note';
      }
      if (description.toLowerCase().includes('food') || description.toLowerCase().includes('restaurant')) {
        return 'restaurant';
      }
      // Default debit
      return 'shopping-cart';
    };

    return (
      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        {recentTransactions.map((transaction) => {
          const txnType = mapTransactionType(transaction.type);
          const title = getTransactionTitle(transaction);
          const relativeDate = formatRelativeDate(transaction.created_at);
          const iconName = getTransactionIcon(txnType, title);

          return (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIconContainer}>
                <Icon name={iconName} size={24} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{title}</Text>
                <Text style={styles.transactionDate}>{relativeDate}</Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                txnType === 'credit' ? styles.creditAmount : styles.debitAmount
              ]}>
                {txnType === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderSavingsGoals = () => {
    if (activeSavingsGoals.length === 0) {
      return (
        <View style={styles.savingsSection}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No savings goals yet</Text>
            <Text style={styles.emptyStateSubtext}>Create your first goal to start saving</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.savingsSection}>
        <Text style={styles.sectionTitle}>Savings Goals</Text>

        {activeSavingsGoals.map((goal) => (
          <View key={goal.goal_id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalPercentage}>{Math.round(goal.progress_percentage)}%</Text>
            </View>
            <View style={styles.goalProgressBackground}>
              <View
                style={[
                  styles.goalProgressFill,
                  { width: `${Math.min(goal.progress_percentage, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.goalAmountText}>
              {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRoundUpInsights = () => {
    // Don't show if no round-up rule or if it's disabled
    if (!roundUpRule || !roundUpRule.is_enabled) {
      return null;
    }

    const totalSaved = roundUpRule.total_amount_saved;
    const totalRoundUps = roundUpRule.total_round_ups_count;
    const averageRoundUp = totalRoundUps > 0 ? Math.round(totalSaved / totalRoundUps) : 0;

    return (
      <View style={styles.roundUpSection}>
        <View style={styles.roundUpHeader}>
          <Text style={styles.sectionTitle}>Round-Up Savings</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('RoundUpSettings')}
            style={styles.roundUpSettingsButton}
            activeOpacity={0.7}
          >
            <Icon name="settings" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.roundUpCard}>
          <View style={styles.roundUpStats}>
            <View style={styles.roundUpStat}>
              <Icon name="savings" size={32} color={theme.colors.accent} />
              <Text style={styles.roundUpStatValue}>{formatCurrency(totalSaved)}</Text>
              <Text style={styles.roundUpStatLabel}>Total Saved</Text>
            </View>

            <View style={styles.roundUpStatDivider} />

            <View style={styles.roundUpStat}>
              <Icon name="trending-up" size={32} color={theme.colors.success} />
              <Text style={styles.roundUpStatValue}>{totalRoundUps}</Text>
              <Text style={styles.roundUpStatLabel}>Round-Ups</Text>
            </View>

            <View style={styles.roundUpStatDivider} />

            <View style={styles.roundUpStat}>
              <Icon name="analytics" size={32} color={theme.colors.info} />
              <Text style={styles.roundUpStatValue}>{formatCurrency(averageRoundUp)}</Text>
              <Text style={styles.roundUpStatLabel}>Avg Amount</Text>
            </View>
          </View>

          <Text style={styles.roundUpDescription}>
            {roundUpRule.increment_type === 'auto'
              ? 'Auto-saving with smart AI-powered amounts'
              : roundUpRule.increment_type === 'percentage'
              ? `Saving ${roundUpRule.percentage_value || 5}% of each transaction`
              : `Auto-saving to nearest KES ${roundUpRule.increment_type}`}
          </Text>
        </View>
      </View>
    );
  };

  // Show loading skeleton on initial load
  if (isInitialLoading) {
    return (
      <>
        <StatusBar barStyle={themeColors.colors.statusBarStyle} backgroundColor={themeColors.colors.surface} />
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.colors.surface }]} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.colors.accent} />
            <Text style={[styles.loadingText, { color: themeColors.colors.textSecondary }]}>Loading your dashboard...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const greeting = getTimeBasedGreeting(user?.first_name);

  return (
    <>
      <StatusBar barStyle={themeColors.colors.statusBarStyle} backgroundColor={themeColors.colors.surface} />
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.colors.surface }]} edges={['top']}>
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColors.colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Top App Bar with Profile and Notification */}
          <View style={styles.topAppBar}>
            <TouchableOpacity
              style={styles.profileAvatar}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Icon name="account-circle" size={40} color={themeColors.colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationButton}
              activeOpacity={0.7}
            >
              <Icon name="notifications" size={24} color={themeColors.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Greeting */}
          <Text style={[styles.greeting, { color: themeColors.colors.textPrimary }]}>{greeting}</Text>

          {/* Balance Cards Section */}
          <View style={styles.balanceSection}>
            {/* Primary Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <TouchableOpacity onPress={toggleBalanceVisibility}>
                  <Icon
                    name={balanceVisible ? 'visibility-off' : 'visibility'}
                    size={24}
                    color={theme.colors.onPrimaryText}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? formatCurrency(getTotalBalance()) : '••••••'}
              </Text>
            </View>

            {/* Wallet Cards Row */}
            <View style={styles.walletCardsRow}>
              <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>Main Wallet</Text>
                <Text style={styles.walletAmount}>
                  {balanceVisible ? formatCurrency(mainBalance) : '••••'}
                </Text>
              </View>
              <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>Savings Wallet</Text>
                <Text style={styles.walletAmount}>
                  {balanceVisible ? formatCurrency(savingsBalance) : '••••'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          {renderQuickActions()}

          {/* Round-Up Insights */}
          {renderRoundUpInsights()}

          {/* Recent Transactions */}
          {renderRecentTransactions()}

          {/* Savings Goals */}
          {renderSavingsGoals()}

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  notificationButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  greeting: {
    fontSize: 28,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    letterSpacing: -0.5,
  },
  balanceSection: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    gap: theme.spacing.base,
  },
  balanceCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  balanceLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.onPrimaryText,
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
    letterSpacing: -0.5,
  },
  walletCardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.base,
  },
  walletCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  walletLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  walletAmount: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.base,
  },
  quickActionCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  quickActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: `${theme.colors.accent}33`, // 20% opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  transactionsSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.xl,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    minHeight: 72,
    gap: theme.spacing.base,
  },
  transactionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  transactionDescription: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
  },
  transactionAmount: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
  },
  creditAmount: {
    color: theme.colors.accentDarker,
  },
  debitAmount: {
    color: theme.colors.textSecondary,
  },
  savingsSection: {
    backgroundColor: theme.colors.surface,
    paddingBottom: theme.spacing.base,
  },
  goalCard: {
    marginHorizontal: theme.spacing.base,
    marginVertical: theme.spacing.xs,
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: theme.spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalName: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  goalPercentage: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textTertiary,
  },
  goalProgressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.full,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.full,
  },
  goalAmountText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.base,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  roundUpSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.xl,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing.base,
  },
  roundUpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  roundUpSettingsButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundUpCard: {
    marginHorizontal: theme.spacing.base,
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: theme.spacing.md,
  },
  roundUpStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  roundUpStat: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  roundUpStatValue: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  roundUpStatLabel: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  roundUpStatDivider: {
    width: 1,
    height: 48,
    backgroundColor: theme.colors.gray200,
  },
  roundUpDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingTop: theme.spacing.xs,
  },
  bottomSpacer: {
    height: theme.layout.tabBarBottomPadding,
  },
});

export default DashboardScreen;
