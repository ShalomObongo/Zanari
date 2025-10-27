import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTransactionStore } from '@/store/transactionStore';
import theme from '@/theme';

type TransactionDetailsRouteProp = RouteProp<
  { TransactionDetails: { transactionId: string } },
  'TransactionDetails'
>;

const TransactionDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<TransactionDetailsRouteProp>();
  const { transactionId } = route.params;

  // Get transaction from store
  const transaction = useTransactionStore((state) =>
    state.transactions.find((t) => t.id === transactionId)
  );

  // Local state for notes and attachments
  const [notes, setNotes] = useState('Lunch with the team.');
  const [attachments] = useState<string[]>(['receipt.jpg']);

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toFixed(2);
    const isDebit = ['payment', 'transfer_out', 'bill_payment', 'withdrawal'].includes(transaction.type);
    return isDebit ? `-$${formatted}` : `+$${formatted}`;
  };

  const getCategoryDisplay = (category: string) => {
    const categoryMap: Record<string, string> = {
      food_dining: 'Food & Dining',
      groceries: 'Groceries',
      shopping: 'Shopping',
      transport: 'Transport',
      entertainment: 'Entertainment',
      bills: 'Bills & Utilities',
      health: 'Health',
      transfer: 'Transfer',
      income: 'Income',
      other: 'Other',
    };
    return categoryMap[category] || category;
  };

  const getCategoryIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      food_dining: 'restaurant',
      groceries: 'shopping-cart',
      shopping: 'shopping-bag',
      transport: 'directions-car',
      entertainment: 'movie',
      bills: 'receipt-long',
      health: 'local-hospital',
      transfer: 'swap-horiz',
      income: 'attach-money',
      other: 'category',
    };
    return iconMap[category] || 'category';
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      completed: { label: 'Completed', color: theme.colors.accentDarker },
      pending: { label: 'Pending', color: theme.colors.warning },
      failed: { label: 'Failed', color: theme.colors.error },
    };
    return statusMap[status] || { label: status, color: theme.colors.textSecondary };
  };

  const merchantName = transaction.merchant_info?.name || transaction.description || 'Transaction';
  const statusInfo = getStatusDisplay(transaction.status);
  const isDebit = ['payment', 'transfer_out', 'bill_payment', 'withdrawal'].includes(transaction.type);
  const amountColor = isDebit ? theme.colors.textSecondary : theme.colors.accentDarker;

  const handleChangeCategory = () => {
    Alert.alert('Change Category', 'Category selection coming soon');
  };

  const handleReportIssue = () => {
    Alert.alert('Report Issue', 'Issue reporting coming soon');
  };

  const handleShareTransaction = () => {
    Alert.alert('Share Transaction', 'Transaction sharing coming soon');
  };

  const handleAddNote = () => {
    Alert.alert('Add Note', 'Note editing coming soon');
  };

  const handleAddFile = () => {
    Alert.alert('Add File', 'File attachment coming soon');
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.surface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction Details</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Transaction Card */}
          <View style={styles.mainCard}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {formatAmount(transaction.amount)}
            </Text>
            <Text style={styles.merchantName}>{merchantName}</Text>
            <Text style={styles.dateTime}>{formatDate(transaction.created_at)}</Text>
          </View>

          {/* Details Section */}
          <View style={styles.section}>
            <View style={styles.detailsCard}>
              {/* Category */}
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Icon
                    name={getCategoryIcon(transaction.category)}
                    size={24}
                    color={theme.colors.accentDarkest}
                  />
                  <Text style={styles.detailLabel}>Category</Text>
                </View>
                <Text style={styles.detailValue}>
                  {getCategoryDisplay(transaction.category)}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* Status */}
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Icon name="task-alt" size={24} color={theme.colors.accentDarkest} />
                  <Text style={styles.detailLabel}>Status</Text>
                </View>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                  <Text style={styles.detailValue}>{statusInfo.label}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Payment Method */}
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Icon name="credit-card" size={24} color={theme.colors.accentDarkest} />
                  <Text style={styles.detailLabel}>Payment Method</Text>
                </View>
                <Text style={styles.detailValue}>
                  Main Wallet
                </Text>
              </View>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <View style={styles.detailsCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <TouchableOpacity onPress={handleAddNote}>
                  <Text style={styles.addButton}>Add Note</Text>
                </TouchableOpacity>
              </View>
              {notes ? (
                <Text style={styles.noteText}>{notes}</Text>
              ) : (
                <Text style={styles.emptyText}>No notes added yet</Text>
              )}
            </View>
          </View>

          {/* Attachments Section */}
          <View style={styles.section}>
            <View style={styles.detailsCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Attachments</Text>
                <TouchableOpacity onPress={handleAddFile}>
                  <Text style={styles.addButton}>Add File</Text>
                </TouchableOpacity>
              </View>
              {attachments.length > 0 ? (
                <View style={styles.attachmentsList}>
                  {attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      <Icon
                        name="receipt-long"
                        size={20}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.attachmentName}>{attachment}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No attachments</Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleChangeCategory}
            >
              <Text style={styles.primaryButtonText}>Change Category</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleReportIssue}
            >
              <Text style={styles.secondaryButtonText}>Report an Issue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleShareTransaction}
            >
              <Text style={styles.secondaryButtonText}>Share Transaction</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['3xl'],
  },
  mainCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.base,
    backgroundColor: theme.colors.surface,
  },
  amount: {
    fontSize: 40,
    fontFamily: theme.fonts.bold,
    letterSpacing: -1,
    marginBottom: theme.spacing.sm,
  },
  merchantName: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  dateTime: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
  },
  section: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
  },
  detailsCard: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  detailLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  addButton: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accentDarkest,
  },
  noteText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  attachmentsList: {
    gap: theme.spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
  },
  attachmentName: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  actionsContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    gap: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.base,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.medium,
    color: theme.colors.error,
  },
});

export default TransactionDetailsScreen;
