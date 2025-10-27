import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavingsStore } from '@/store/savingsStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import theme from '@/theme';

// Category colors for goal cards (left bar indicator)
const GOAL_COLORS = ['#3b82f6', '#a855f7', '#ef4444', '#f97316', '#10b981', '#ec4899'];

// Category icons and colors for modal
const GOAL_CATEGORIES = {
  emergency: { icon: '🚨', color: '#ef4444', label: 'Safety' },
  vacation: { icon: '✈️', color: '#f97316', label: 'Travel' },
  purchase: { icon: '🛍️', color: '#3b82f6', label: 'Technology' },
  education: { icon: '🎓', color: '#10b981', label: 'Education' },
  other: { icon: '💡', color: '#a855f7', label: 'Other' },
};

const SavingsGoalsScreen: React.FC = () => {
  // State management
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zustand stores
  const goals = useSavingsStore((state) => state.goals);
  const fetchGoals = useSavingsStore((state) => state.fetchGoals);
  const refreshGoals = useSavingsStore((state) => state.refreshGoals);
  const createGoal = useSavingsStore((state) => state.createGoal);
  const updateGoal = useSavingsStore((state) => state.updateGoal);
  const getTotalSavedAmount = useSavingsStore((state) => state.getTotalSavedAmount);
  const getActiveGoals = useSavingsStore((state) => state.getActiveGoals);
  const isRefreshing = useSavingsStore((state) => state.isRefreshing);

  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);

  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const availableBalance = mainWallet?.available_balance ?? 0;

  // Initial data fetch
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchGoals(),
          useWalletStore.getState().fetchWallets(),
        ]);
      } catch (error) {
        console.error('Error loading savings goals:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Form state
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetAmount: '',
    targetDate: '',
    category: 'emergency' as keyof typeof GOAL_CATEGORIES,
    roundUpEnabled: false,
  });
  const [addAmount, setAddAmount] = useState('');

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  // Helper functions
  const selectedGoal = selectedGoalId ? goals.find(g => g.goal_id === selectedGoalId) : null;

  const getDaysRemaining = (targetDate: string | null): number | null => {
    if (!targetDate) return null;
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate this month's savings
  const getThisMonthSavings = (): number => {
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    return goals
      .filter(g => g.status === 'active')
      .reduce((total, goal) => {
        const goalCreatedTime = new Date(goal.created_at).getTime();
        if (goalCreatedTime > oneMonthAgo) {
          return total + goal.current_amount;
        }
        return total;
      }, 0);
  };

  // Event handlers
  const handleRefresh = async () => {
    try {
      await Promise.all([
        refreshGoals(),
        refreshWallets(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.targetAmount) {
      Alert.alert('Error', 'Please enter goal name and target amount');
      return;
    }

    const targetAmountCents = parseCentsFromInput(newGoal.targetAmount);
    if (targetAmountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    setIsSubmitting(true);

    try {
      await createGoal({
        name: newGoal.title.trim(),
        description: newGoal.description.trim() || undefined,
        target_amount: targetAmountCents,
        target_date: newGoal.targetDate || null,
        category: newGoal.category,
        lock_in_enabled: newGoal.roundUpEnabled,
      });

      // Reset form
      setNewGoal({
        title: '',
        description: '',
        targetAmount: '',
        targetDate: '',
        category: 'emergency',
        roundUpEnabled: false,
      });

      setShowCreateModal(false);
      Alert.alert('Success', 'Savings goal created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create savings goal. Please try again.');
      console.error('Create goal error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFunds = async () => {
    if (!addAmount.trim() || !selectedGoal) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amountCents = parseCentsFromInput(addAmount);
    if (amountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Check available balance
    if (amountCents > availableBalance) {
      Alert.alert('Error', `Insufficient balance. Available: ${formatCurrency(availableBalance)}`);
      return;
    }

    if (amountCents > 100000000) { // KES 1M limit in cents
      Alert.alert('Error', 'Maximum deposit amount is KES 1,000,000');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Implement deposit to savings goal API endpoint
      Alert.alert(
        'Coming Soon',
        'Adding funds to savings goals will be available soon. This feature requires backend API integration.'
      );

      setAddAmount('');
      setShowAddFundsModal(false);
      setSelectedGoalId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to add funds. Please try again.');
      console.error('Add funds error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleGoal = async (goalId: string) => {
    const goal = goals.find(g => g.goal_id === goalId);
    if (!goal) return;

    const newStatus = goal.status === 'active' ? 'paused' : 'active';

    try {
      await updateGoal(goalId, { status: newStatus } as any);
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal status');
      console.error('Toggle goal error:', error);
    }
  };

  const handleDeleteGoal = (goalId: string) => {
    Alert.alert(
      'Cancel Goal',
      'Are you sure you want to cancel this savings goal? You can reactivate it later.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel Goal',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateGoal(goalId, { status: 'cancelled' } as any);
              Alert.alert('Success', 'Goal cancelled successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel goal');
              console.error('Delete goal error:', error);
            }
          },
        },
      ]
    );
  };

  const openAddFundsModal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setShowAddFundsModal(true);
  };

  const renderGoalCard = (goal: typeof goals[0], index: number) => {
    const progress = goal.progress_percentage;
    const daysRemaining = getDaysRemaining(goal.target_date);
    const colorIndex = index % GOAL_COLORS.length;
    const barColor = GOAL_COLORS[colorIndex];
    const isActive = goal.status === 'active';
    const isCompleted = goal.status === 'completed';

    return (
      <View key={goal.goal_id} style={[styles.goalCard, !isActive && styles.inactiveGoal]}>
        <View style={styles.goalContent}>
          <View style={styles.goalHeaderRow}>
            <View style={styles.goalHeaderLeft}>
              <View style={[styles.colorBar, { backgroundColor: barColor }]} />
              <Text style={styles.goalTitle}>{goal.name}</Text>
            </View>
            {goal.lock_in_enabled && (
              <View style={styles.roundUpBadge}>
                <Icon name="all-inclusive" size={14} color={theme.colors.primary} />
                <Text style={styles.roundUpBadgeText}>Round-up</Text>
              </View>
            )}
          </View>

          <View style={styles.progressSection}>
            <View style={styles.amountRow}>
              <View style={styles.amountLeft}>
                <Text style={styles.currentAmount}>{formatCurrency(goal.current_amount)}</Text>
                <Text style={styles.targetAmount}> / {formatCurrency(goal.target_amount)}</Text>
              </View>
              <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
          </View>

          <View style={styles.goalFooter}>
            <Text style={styles.daysRemaining}>
              {daysRemaining !== null ? (
                daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ongoing'
              ) : (
                'Ongoing'
              )}
            </Text>
            <TouchableOpacity
              style={styles.addFundsButton}
              onPress={() => openAddFundsModal(goal.goal_id)}
              disabled={!isActive || isCompleted}
              activeOpacity={0.8}
            >
              <Text style={styles.addFundsButtonText}>
                {isCompleted ? '✓ Complete' : 'Add Funds'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const navigation = useNavigation<any>();

  // Show loading on initial load
  if (isInitialLoading) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Savings</Text>
            <TouchableOpacity style={styles.menuButton}>
              <Icon name="more-horiz" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading your goals...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const activeGoals = getActiveGoals();
  const totalSaved = getTotalSavedAmount();

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings</Text>
          <TouchableOpacity style={styles.menuButton}>
            <Icon name="more-horiz" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
        >
          {/* Summary Cards Row */}
          <View style={styles.summaryCardsRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Saved</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalSaved)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Active Goals</Text>
              <Text style={styles.summaryAmount}>{activeGoals.length}</Text>
            </View>
          </View>

          {/* Section Header */}
          <Text style={styles.sectionTitle}>Active Goals</Text>

          {/* Goals List */}
          {activeGoals.length > 0 ? (
            activeGoals.map((goal, index) => renderGoalCard(goal, index))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎯</Text>
              <Text style={styles.emptyTitle}>No Savings Goals Yet</Text>
              <Text style={styles.emptyDescription}>
                Create your first savings goal to start building your financial future
              </Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.emptyActionButtonText}>Create Your First Goal</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <Icon name="add" size={32} color={theme.colors.surface} />
        </TouchableOpacity>

        {/* Modals remain the same */}
        {/* Create Goal Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Savings Goal</Text>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleCreateGoal}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalSaveText}>
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Goal Title *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newGoal.title}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, title: text }))}
                    placeholder="e.g., Emergency Fund, New Car, Vacation"
                    placeholderTextColor="#999"
                    maxLength={50}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={newGoal.description}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, description: text }))}
                    placeholder="Brief description of your savings goal"
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Target Amount (KES) *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newGoal.targetAmount}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, targetAmount: text.replace(/[^0-9]/g, '') }))}
                    placeholder="50000"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Target Date *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newGoal.targetDate}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, targetDate: text }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
                    {Object.entries(GOAL_CATEGORIES).map(([key, category]) => (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.categoryButton,
                          newGoal.category === key && { backgroundColor: category.color + '20', borderColor: category.color }
                        ]}
                        onPress={() => setNewGoal(prev => ({ ...prev, category: key as keyof typeof GOAL_CATEGORIES }))}
                      >
                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                        <Text style={styles.categoryButtonLabel}>{category.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.formGroup}>
                  <TouchableOpacity
                    style={styles.switchRow}
                    onPress={() => setNewGoal(prev => ({ ...prev, roundUpEnabled: !prev.roundUpEnabled }))}
                  >
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Enable Round-up</Text>
                      <Text style={styles.switchDescription}>Automatically round up purchases to the nearest KES 10</Text>
                    </View>
                    <View style={[styles.switch, newGoal.roundUpEnabled && styles.switchActive]}>
                      <View style={[styles.switchThumb, newGoal.roundUpEnabled && styles.switchThumbActive]} />
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Funds Modal */}
        <Modal
          visible={showAddFundsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddFundsModal(false);
                    setSelectedGoalId(null);
                    setAddAmount('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Add Funds</Text>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleAddFunds}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalSaveText}>
                    {isSubmitting ? 'Adding...' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.addFundsContent}>
                {selectedGoal && (
                  <View style={styles.selectedGoalInfo}>
                    <Text style={styles.selectedGoalTitle}>{selectedGoal.name}</Text>
                    <Text style={styles.selectedGoalProgress}>
                      {formatCurrency(selectedGoal.current_amount)} of {formatCurrency(selectedGoal.target_amount)}
                    </Text>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Amount to Add (KES)</Text>
                  <TextInput
                    style={[styles.formInput, styles.amountInput]}
                    value={addAmount}
                    onChangeText={(text) => setAddAmount(text.replace(/[^0-9]/g, ''))}
                    placeholder="10000"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>

                <View style={styles.quickAmountContainer}>
                  <Text style={styles.quickAmountLabel}>Quick amounts:</Text>
                  <View style={styles.quickAmountButtons}>
                    {[5000, 10000, 25000, 50000].map(amount => (
                      <TouchableOpacity
                        key={amount}
                        style={styles.quickAmountButton}
                        onPress={() => setAddAmount(amount.toString())}
                      >
                        <Text style={styles.quickAmountButtonText}>
                          {formatCurrency(amount).replace('KES', 'KES ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
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
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  menuButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for FAB
  },
  summaryCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.base,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  summaryAmount: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
    letterSpacing: -0.5,
  },
  goalCard: {
    marginHorizontal: theme.spacing.base,
    marginVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  inactiveGoal: {
    opacity: 0.6,
  },
  goalContent: {
    padding: theme.spacing.base,
    gap: theme.spacing.base,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.base,
  },
  goalHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  colorBar: {
    width: 6,
    height: 32,
    borderRadius: theme.borderRadius.full,
  },
  goalTitle: {
    flex: 1,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  roundUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.primary}1A`, // 10% opacity
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  roundUpBadgeText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.medium,
    color: theme.colors.primary,
  },
  progressSection: {
    gap: theme.spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  amountLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentAmount: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  targetAmount: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
  },
  progressPercentage: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.full,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.full,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  daysRemaining: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  addFundsButton: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accentDarker,
    borderRadius: theme.borderRadius.lg,
  },
  addFundsButtonText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    paddingHorizontal: theme.spacing.base,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.base,
  },
  emptyTitle: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  emptyActionButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
  },
  emptyActionButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCancelButton: {
    padding: theme.spacing.sm,
  },
  modalCancelText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  modalTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.primary,
  },
  modalSaveButton: {
    padding: theme.spacing.sm,
  },
  modalSaveText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.accent,
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  formGroup: {
    marginTop: theme.spacing.xl,
  },
  formLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  formInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 80,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  categoryButtonLabel: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.base,
  },
  switchInfo: {
    flex: 1,
    marginRight: theme.spacing.base,
  },
  switchLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  switchDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  switch: {
    width: 52,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray200,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: theme.colors.accent,
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  addFundsContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  selectedGoalInfo: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  selectedGoalTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  selectedGoalProgress: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  amountInput: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
  },
  quickAmountContainer: {
    marginTop: theme.spacing.xl,
  },
  quickAmountLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  quickAmountButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
  },
  quickAmountButtonText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
  },
});

export default SavingsGoalsScreen;
