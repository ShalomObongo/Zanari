import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTransactionStore } from '@/store/transactionStore';
import type { TransactionType, TransactionCategory } from '@/store/transactionStore';
import { formatCurrency, formatRelativeDate, mapTransactionType } from '@/utils/formatters';

interface TransactionHistoryScreenProps {}

interface FilterOptions {
  type: 'all' | 'debit' | 'credit';
  category: string;
  period: 'all' | 'today' | 'week' | 'month' | 'year';
}

const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = () => {
  const navigation = useNavigation<any>();
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    category: 'all',
    period: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

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
  
  // Client-side filtering
  const filterTransactions = () => {
    return transactions.filter(transaction => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#2D6A4F';
      case 'pending': return '#FF8C00';
      case 'failed': return '#FF4444';
      default: return '#666666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const getCategoryIcon = (category: TransactionCategory | string) => {
    const icons: Record<string, string> = {
      'airtime': '📱',
      'groceries': '🛒',
      'school_fees': '🎓',
      'utilities': '⚡',
      'transport': '🚗',
      'entertainment': '🎬',
      'savings': '🐷',
      'transfer': '📤',
      'other': '💳'
    };
    return icons[category] || '💳';
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
    console.log('Transaction pressed:', transactionId);
  };

  const renderFilterModal = () => {
    const categories: (TransactionCategory | 'all')[] = ['all', 'airtime', 'groceries', 'school_fees', 'utilities', 'transport', 'entertainment', 'savings', 'transfer', 'other'];
    const periods = [
      { key: 'all' as const, label: 'All Time' },
      { key: 'today' as const, label: 'Today' },
      { key: 'week' as const, label: 'This Week' },
      { key: 'month' as const, label: 'This Month' },
      { key: 'year' as const, label: 'This Year' }
    ];

    return (
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Transaction Type */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Transaction Type</Text>
              <View style={styles.filterRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'credit', label: 'Money In' },
                  { key: 'debit', label: 'Money Out' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOption,
                      filters.type === option.key && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters({ ...filters, type: option.key as any })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.type === option.key && styles.filterOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Category */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Category</Text>
              <View style={styles.filterGrid}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterOption,
                      filters.category === category && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters({ ...filters, category })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.category === category && styles.filterOptionTextSelected
                    ]}>
                      {category === 'all' ? 'All' : category.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time Period */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Time Period</Text>
              <View style={styles.filterColumn}>
                {periods.map((period) => (
                  <TouchableOpacity
                    key={period.key}
                    style={[
                      styles.filterOption,
                      filters.period === period.key && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters({ ...filters, period: period.key as any })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.period === period.key && styles.filterOptionTextSelected
                    ]}>
                      {period.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
        <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transactions</Text>
            <View style={styles.filterButton} />
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
    const description = item.description || item.merchant_info?.name || 'Transaction';
    const relativeDate = formatRelativeDate(item.created_at);
    const roundUpAmount = item.round_up_details?.round_up_amount;
    
    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => handleTransactionPress(item.id)}
      >
        <View style={styles.transactionIcon}>
          <Text style={styles.transactionIconText}>
            {getCategoryIcon(item.category)}
          </Text>
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>{description}</Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>{relativeDate}</Text>
            <Text style={[styles.transactionStatus, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          {roundUpAmount && roundUpAmount > 0 && (
            <Text style={styles.roundUpText}>
              Round-up saved: {formatCurrency(roundUpAmount)}
            </Text>
          )}
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.transactionAmountText,
            txnType === 'credit' ? styles.creditAmount : styles.debitAmount
          ]}>
            {txnType === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <Text style={styles.transactionCategory}>{item.category.replace('_', ' ')}</Text>
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
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transactions</Text>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Text style={styles.filterButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Summary */}
        {(filters.type !== 'all' || filters.category !== 'all' || filters.period !== 'all') && (
          <View style={styles.filterSummary}>
            <Text style={styles.filterSummaryText}>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </Text>
            <TouchableOpacity onPress={() => setFilters({ type: 'all', category: 'all', period: 'all' })}>
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transactions List */}
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          style={styles.transactionsList}
          contentContainerStyle={filteredTransactions.length === 0 ? styles.emptyListContent : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions found</Text>
              <Text style={styles.emptyStateSubtext}>
                {filters.type !== 'all' || filters.category !== 'all' || filters.period !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Make your first payment to get started'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {renderFilterModal()}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B4332',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(183, 228, 199, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: 'System',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(183, 228, 199, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 18,
  },
  filterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  filterSummaryText: {
    fontSize: 14,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#52B788',
    fontWeight: '500',
    fontFamily: 'System',
  },
  transactionsList: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionIconText: {
    fontSize: 20,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'System',
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'System',
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'System',
  },
  roundUpText: {
    fontSize: 11,
    color: '#52B788',
    fontFamily: 'System',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'System',
  },
  creditAmount: {
    color: '#2D6A4F',
  },
  debitAmount: {
    color: '#666666',
  },
  transactionCategory: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'System',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    fontFamily: 'System',
  },
  bottomSpacer: {
    height: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'System',
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
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'System',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#52B788',
    fontWeight: '600',
    fontFamily: 'System',
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    fontFamily: 'System',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterColumn: {
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterOptionSelected: {
    backgroundColor: '#52B788',
    borderColor: '#52B788',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'System',
  },
  filterOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default TransactionHistoryScreen;