import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { apiClient } from '@/services/api';
import { formatCurrency } from '@/utils/formatters';
import { Transaction } from '@/store/transactionStore';

const InvestmentHistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get<{ transactions: Transaction[] }>('/transactions', {
        searchParams: {
          category: 'investment',
          limit: 50, // Fetch enough history
        },
      });
      setTransactions(response.transactions);
    } catch (err) {
      console.error('Failed to fetch investment history:', err);
      setError('Unable to load investment history');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'investment_allocation':
        return 'trending-up';
      case 'investment_redemption':
        return 'trending-down';
      case 'interest_payout':
        return 'account-balance-wallet'; // or 'savings'
      default:
        return 'swap-horiz';
    }
  };

  const getLabelForType = (type: string) => {
    switch (type) {
      case 'investment_allocation':
        return 'Investment Allocation';
      case 'investment_redemption':
        return 'Investment Redemption';
      case 'interest_payout':
        return 'Interest Payout';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'investment_allocation':
        return theme.colors.textPrimary; // Money leaving wallet (neutral or specific color?)
        // Actually, allocation is usually negative in wallet, but positive in investment.
        // Let's stick to standard: Red for money out, Green for money in.
        // Allocation = Money out of wallet -> Investment.
        // Redemption = Money into wallet <- Investment.
        // Interest = Money into wallet (if paid out) or reinvested.
      case 'investment_redemption':
      case 'interest_payout':
        return theme.colors.success;
      default:
        return theme.colors.textPrimary;
    }
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.type === 'investment_redemption' || item.type === 'interest_payout';
    const amountPrefix = isCredit ? '+' : '-';
    const amountColor = isCredit ? theme.colors.success : theme.colors.textPrimary;

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => (navigation as any).navigate('TransactionDetails', { transactionId: item.id })}
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.surface }]}>
          <Icon
            name={getIconForType(item.type)}
            size={24}
            color={theme.colors.accent}
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>{item.description || getLabelForType(item.type)}</Text>
          <Text style={styles.transactionDate}>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={[styles.transactionAmount, { color: amountColor }]}>
          {amountPrefix}{formatCurrency(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Investment History</Text>
          <View style={styles.placeholderButton} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTransactions}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="history" size={48} color={theme.colors.textTertiary} />
                <Text style={styles.emptyStateText}>No investment transactions yet</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  placeholderButton: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.fontSizes.base,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontFamily: theme.fonts.semiBold,
  },
  listContent: {
    padding: theme.spacing.base,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
  },
  transactionAmount: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing['3xl'],
  },
  emptyStateText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    color: theme.colors.textSecondary,
  },
});

export default InvestmentHistoryScreen;
