import React, { useState, useEffect } from 'react';
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
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';
import { formatCurrency, formatRelativeDate, mapTransactionType, getTimeBasedGreeting } from '@/utils/formatters';

interface DashboardScreenProps {}

const DashboardScreen: React.FC<DashboardScreenProps> = () => {
  const navigation = useNavigation<any>();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
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
  
  const isRefreshing = isRefreshingWallets || isRefreshingTransactions || isRefreshingGoals;
  
  // Initial data fetch on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchWallets(),
          fetchTransactions(),
          fetchGoals({ page: 1 }),
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
      { id: 'send', label: 'Send', icon: '📤', color: '#52B788' },
      { id: 'pay', label: 'Pay', icon: '💳', color: '#2D6A4F' },
      { id: 'save', label: 'Save', icon: '🎯', color: '#1B4332' },
      { id: 'topup', label: 'Top Up', icon: '💰', color: '#40916C' }
    ];

    return (
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickActionButton, { backgroundColor: action.color }]}
              onPress={() => handleQuickAction(action.id)}
            >
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderRecentTransactions = () => {
    if (recentTransactions.length === 0) {
      return (
        <View style={styles.transactionsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
            <Text style={styles.emptyStateSubtext}>Make your first payment to get started</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.transactionsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {recentTransactions.map((transaction) => {
          const txnType = mapTransactionType(transaction.type);
          const description = transaction.description || transaction.merchant_info?.name || 'Transaction';
          const relativeDate = formatRelativeDate(transaction.created_at);
          
          return (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Text style={styles.transactionIconText}>
                  {txnType === 'credit' ? '↗️' : '↙️'}
                </Text>
              </View>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{description}</Text>
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
        <View style={styles.savingsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Savings Goals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Savings')}>
              <Text style={styles.viewAllText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No savings goals yet</Text>
            <Text style={styles.emptyStateSubtext}>Create your first goal to start saving</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.savingsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Savings')}>
            <Text style={styles.viewAllText}>Manage</Text>
          </TouchableOpacity>
        </View>
        
        {activeSavingsGoals.map((goal) => (
          <View key={goal.goal_id} style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalAmount}>
                {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
              </Text>
            </View>
            <View style={styles.goalProgressContainer}>
              <View style={styles.goalProgressBackground}>
                <View 
                  style={[
                    styles.goalProgressFill, 
                    { width: `${Math.min(goal.progress_percentage, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.goalProgressText}>
                {Math.round(goal.progress_percentage)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Show loading skeleton on initial load
  if (isInitialLoading) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#52B788" />
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }
  
  const greeting = getTimeBasedGreeting(user?.first_name);
  
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting.split(',')[0]},</Text>
              <Text style={styles.userName}>{user?.first_name || 'User'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.profileButtonText}>👤</Text>
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <TouchableOpacity onPress={toggleBalanceVisibility}>
                <Text style={styles.eyeIcon}>{balanceVisible ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              {balanceVisible ? formatCurrency(getTotalBalance()) : '••••••'}
            </Text>
            
            <View style={styles.balanceBreakdown}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceSubLabel}>Main Wallet</Text>
                <Text style={styles.balanceSubAmount}>
                  {balanceVisible ? formatCurrency(mainBalance) : '••••'}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceSubLabel}>Savings</Text>
                <Text style={styles.balanceSubAmount}>
                  {balanceVisible ? formatCurrency(savingsBalance) : '••••'}
                </Text>
              </View>
              {roundUpBalance > 0 && (
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceSubLabel}>Round-up</Text>
                  <Text style={styles.balanceSubAmount}>
                    {balanceVisible ? formatCurrency(roundUpBalance) : '••••'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Actions */}
          {renderQuickActions()}

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
    backgroundColor: '#1B4332',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'System',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(183, 228, 199, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: {
    fontSize: 20,
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'System',
  },
  eyeIcon: {
    fontSize: 18,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1B4332',
    marginBottom: 20,
    fontFamily: 'System',
  },
  balanceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  balanceSubLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
    fontFamily: 'System',
  },
  balanceSubAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B4332',
    fontFamily: 'System',
  },
  quickActionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'System',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#52B788',
    fontWeight: '500',
    fontFamily: 'System',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: 70,
    height: 70,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
    fontFamily: 'System',
  },
  transactionsContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
    fontFamily: 'System',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'System',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  creditAmount: {
    color: '#2D6A4F',
  },
  debitAmount: {
    color: '#666666',
  },
  savingsContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  goalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    fontFamily: 'System',
  },
  goalAmount: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'System',
  },
  goalProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalProgressBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginRight: 12,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#52B788',
    borderRadius: 3,
  },
  goalProgressText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    fontFamily: 'System',
  },
  bottomSpacer: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B4332',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
    fontFamily: 'System',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    fontFamily: 'System',
  },
});

export default DashboardScreen;