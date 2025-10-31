import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTransactionStore } from '@/store/transactionStore';
import type { TransactionType, TransactionCategory } from '@/store/transactionStore';
import { formatCurrency, formatRelativeDate, mapTransactionType } from '@/utils/formatters';
import theme from '@/theme';

interface TransactionHistoryScreenProps {}

interface FilterOptions {
  type: 'all' | 'debit' | 'credit';
  category: string;
  period: 'all' | 'today' | 'week' | 'month' | 'year';
}

const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = () => {
  const navigation = useNavigation<any>();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    category: 'all',
    period: 'month'
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Zustand store
  const transactions = useTransactionStore((state) => state.transactions);
  const fetchTransactions = useTransactionStore((state) => state.fetchTransactions);
  const refreshTransactions = useTransactionStore((state) => state.refreshTransactions);
  const loadMoreTransactions = useTransactionStore((state) => state.loadMoreTransactions);
  const pagination = useTransactionStore((state) => state.pagination);
  const isRefreshing = useTransactionStore((state) => state.isRefreshing);
  const isLoadingMore = useTransactionStore((state) => state.isLoadingMore);
  
  // Initial data fetch on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchTransactions();
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

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

  // Client-side filtering
  const filterTransactions = () => {
    return transactions.filter(transaction => {
      // Filter by search query
      if (searchQuery) {
        const title = getTransactionTitle(transaction).toLowerCase();
        if (!title.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      // Filter by type
      if (filters.type !== 'all') {
        const txnType = mapTransactionType(transaction.type);
        if (txnType !== filters.type) {
          return false;
        }
      }

      // Filter by category
      if (filters.category !== 'all' && transaction.category !== filters.category) {
        return false;
      }

      // Filter by period
      if (filters.period !== 'all') {
        const now = Date.now();
        const transactionTime = new Date(transaction.created_at).getTime();

        switch (filters.period) {
          case 'today':
            if (now - transactionTime > 24 * 60 * 60 * 1000) return false;
            break;
          case 'week':
            if (now - transactionTime > 7 * 24 * 60 * 60 * 1000) return false;
            break;
          case 'month':
            if (now - transactionTime > 30 * 24 * 60 * 60 * 1000) return false;
            break;
          case 'year':
            if (now - transactionTime > 365 * 24 * 60 * 60 * 1000) return false;
            break;
        }
      }

      return true;
    });
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          bg: '#EAF6F0',
          text: '#2D6A4F',
          label: 'Completed'
        };
      case 'pending':
        return {
          bg: '#FFF8E6',
          text: '#B98900',
          label: 'Pending'
        };
      case 'failed':
        return {
          bg: '#FCEEEE',
          text: '#D93434',
          label: 'Failed'
        };
      default:
        return {
          bg: '#f0f0f0',
          text: '#666666',
          label: status
        };
    }
  };

  const getTransactionIcon = (type: string, description: string, category: string) => {
    const desc = description.toLowerCase();

    // For credit transactions
    if (type === 'credit') {
      if (desc.includes('salary') || desc.includes('income') || desc.includes('paycheck')) {
        return 'receipt-long';
      }
      return 'trending-up';
    }

    // For debit transactions - category-based icons
    if (desc.includes('groceries') || desc.includes('market') || desc.includes('supermarket') || desc.includes('kroger')) {
      return 'shopping-cart';
    }
    if (desc.includes('music') || desc.includes('spotify') || desc.includes('apple music')) {
      return 'music-note';
    }
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('food') || desc.includes('dining')) {
      return 'restaurant';
    }
    if (desc.includes('transit') || desc.includes('metro') || desc.includes('train') || desc.includes('bus')) {
      return 'train';
    }
    if (desc.includes('uber') || desc.includes('taxi') || desc.includes('ride')) {
      return 'local-taxi';
    }
    if (desc.includes('flight') || desc.includes('airline')) {
      return 'flight';
    }
    if (desc.includes('movie') || desc.includes('cinema') || desc.includes('theater')) {
      return 'theaters';
    }
    if (desc.includes('phone') || desc.includes('airtime')) {
      return 'phone-android';
    }

    // Default
    return 'receipt-long';
  };

  const getPeriodLabel = () => {
    switch (filters.period) {
      case 'today': return 'Today';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'year': return 'Last Year';
      default: return 'All Time';
    }
  };

  const getCategoryLabel = () => {
    if (filters.category === 'all') return 'All';
    return filters.category.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const onRefresh = async () => {
    try {
      await refreshTransactions();
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    }
  };
  
  const handleLoadMore = async () => {
    if (pagination.has_more && !isLoadingMore) {
      try {
        await loadMoreTransactions();
      } catch (error) {
        console.error('Error loading more transactions:', error);
      }
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleTransactionPress = (transactionId: string) => {
    // Navigate to transaction detail screen
    navigation.navigate('TransactionDetails', { transactionId });
  };;

  const renderCategoryModal = () => {
    const categories: (TransactionCategory | 'all')[] = [
      'all', 'airtime', 'groceries', 'school_fees', 'utilities',
      'transport', 'entertainment', 'savings', 'transfer', 'other'
    ];

    return (
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalList}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.modalOption}
                  onPress={() => {
                    setFilters({ ...filters, category });
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    filters.category === category && styles.modalOptionTextSelected
                  ]}>
                    {category === 'all' ? 'All Categories' : category.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Text>
                  {filters.category === category && (
                    <Icon name="check" size={20} color="#52B788" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPeriodModal = () => {
    const periods = [
      { key: 'all' as const, label: 'All Time' },
      { key: 'today' as const, label: 'Today' },
      { key: 'week' as const, label: 'Last 7 Days' },
      { key: 'month' as const, label: 'Last 30 Days' },
      { key: 'year' as const, label: 'Last Year' }
    ];

    return (
      <Modal
        visible={showPeriodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Period</Text>
              <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
                <Icon name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalList}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period.key}
                  style={styles.modalOption}
                  onPress={() => {
                    setFilters({ ...filters, period: period.key });
                    setShowPeriodModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    filters.period === period.key && styles.modalOptionTextSelected
                  ]}>
                    {period.label}
                  </Text>
                  {filters.period === period.key && (
                    <Icon name="check" size={20} color="#52B788" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const filteredTransactions = filterTransactions();
  
  // Show loading skeleton on initial load
  if (isInitialLoading) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color="#333333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transactions</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#52B788" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const renderTransaction = ({ item }: { item: typeof transactions[0] }) => {
    const txnType = mapTransactionType(item.type);
    const title = getTransactionTitle(item);
    const relativeDate = formatRelativeDate(item.created_at);
    const iconName = getTransactionIcon(txnType, title, item.category);
    const statusStyles = getStatusStyles(item.status);

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => handleTransactionPress(item.id)}
      >
        <View style={styles.transactionIcon}>
          <Icon name={iconName} size={24} color={theme.colors.textPrimary} />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>{title}</Text>
          <Text style={styles.transactionDate}>{relativeDate}</Text>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmountText,
            txnType === 'credit' ? styles.creditAmount : styles.debitAmount
          ]}>
            {txnType === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyles.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyles.text }]} />
            <Text style={[styles.statusText, { color: statusStyles.text }]}>
              {statusStyles.label}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  const renderFooter = () => {
    if (!isLoadingMore) return <View style={styles.bottomSpacer} />;
    
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color="#52B788" />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Icon name="arrow-back" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transactions</Text>
          <View style={styles.backButton} />
        </View>

        {/* Sticky Filter Section */}
        <View style={styles.filterSection}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#999999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close" size={20} color="#999999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category and Period Buttons */}
          <View style={styles.filterButtonsRow}>
            <TouchableOpacity
              style={styles.filterDropdownButton}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={styles.filterDropdownText}>Category: {getCategoryLabel()}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterDropdownButton}
              onPress={() => setShowPeriodModal(true)}
            >
              <Text style={styles.filterDropdownText}>{getPeriodLabel()}</Text>
            </TouchableOpacity>
          </View>

          {/* Type Segmented Control */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filters.type === 'all' && styles.segmentButtonActive
              ]}
              onPress={() => setFilters({ ...filters, type: 'all' })}
            >
              <Text style={[
                styles.segmentButtonText,
                filters.type === 'all' && styles.segmentButtonTextActive
              ]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filters.type === 'credit' && styles.segmentButtonActive
              ]}
              onPress={() => setFilters({ ...filters, type: 'credit' })}
            >
              <Text style={[
                styles.segmentButtonText,
                filters.type === 'credit' && styles.segmentButtonTextActive
              ]}>
                Money In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filters.type === 'debit' && styles.segmentButtonActive
              ]}
              onPress={() => setFilters({ ...filters, type: 'debit' })}
            >
              <Text style={[
                styles.segmentButtonText,
                filters.type === 'debit' && styles.segmentButtonTextActive
              ]}>
                Money Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions List */}
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          style={styles.transactionsList}
          contentContainerStyle={[
            styles.transactionsListContent,
            filteredTransactions.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#52B788"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="receipt-long" size={64} color="#e5e7eb" />
              <Text style={styles.emptyStateText}>No transactions found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || filters.type !== 'all' || filters.category !== 'all' || filters.period !== 'month'
                  ? 'Try adjusting your filters'
                  : 'Make your first payment to get started'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {renderCategoryModal()}
        {renderPeriodModal()}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  filterSection: {
    backgroundColor: theme.colors.surface,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.base,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSizes.base,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.regular,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.base,
  },
  filterDropdownButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  filterDropdownText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.medium,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.full,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  segmentButtonText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  segmentButtonTextActive: {
    color: theme.colors.surface,
    fontFamily: theme.fonts.semiBold,
  },
  transactionsList: {
    flex: 1,
  },
  transactionsListContent: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    gap: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
  },
  transactionDetails: {
    flex: 1,
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
    color: theme.colors.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmountText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
  },
  creditAmount: {
    color: theme.colors.accentDarker,
  },
  debitAmount: {
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: theme.fonts.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 48,
  },
  emptyStateText: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.regular,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'System',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius['2xl'],
    borderTopRightRadius: theme.borderRadius['2xl'],
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.base,
  },
  modalTitle: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  modalList: {
    paddingHorizontal: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
  },
  modalOptionTextSelected: {
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.primary,
  },
});

export default TransactionHistoryScreen;
