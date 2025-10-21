import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSavingsStore } from '@/store/savingsStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';

// Category icons and colors
const GOAL_CATEGORIES = {
  emergency: { icon: '🚨', color: '#FF6B6B', label: 'Emergency Fund' },
  vacation: { icon: '✈️', color: '#4ECDC4', label: 'Vacation' },
  purchase: { icon: '🛍️', color: '#45B7D1', label: 'Purchase' },
  education: { icon: '🎓', color: '#96CEB4', label: 'Education' },
  other: { icon: '💡', color: '#FECA57', label: 'Other' },
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
      // For now, this is a placeholder - the actual implementation would call:
      // await apiClient.post(`/savings-goals/${selectedGoal.goal_id}/deposit`, { amount: amountCents });
      
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

  const renderGoalCard = (goal: typeof goals[0]) => {
    const progress = goal.progress_percentage;
    const daysRemaining = getDaysRemaining(goal.target_date);
    const category = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.other;
    const isActive = goal.status === 'active';
    const isCompleted = goal.status === 'completed';

    return (
      <View key={goal.goal_id} style={[styles.goalCard, !isActive && styles.inactiveGoal]}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <Text style={styles.goalIcon}>{category.icon}</Text>
            <View style={styles.goalTitleContainer}>
              <Text style={styles.goalTitle}>{goal.name}</Text>
              {goal.description && (
                <Text style={styles.goalDescription}>{goal.description}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                Alert.alert(
                  'Goal Options',
                  goal.name,
                  [
                    {
                      text: isActive ? 'Pause Goal' : 'Activate Goal',
                      onPress: () => handleToggleGoal(goal.goal_id),
                    },
                    {
                      text: 'Cancel Goal',
                      style: 'destructive',
                      onPress: () => handleDeleteGoal(goal.goal_id),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={styles.menuButtonText}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: category.color }]} />
          </View>
          <Text style={styles.progressText}>{progress.toFixed(0)}% Complete</Text>
        </View>

        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.currentAmount}>{formatCurrency(goal.current_amount)}</Text>
            <Text style={styles.targetAmount}>of {formatCurrency(goal.target_amount)}</Text>
          </View>
          <Text style={styles.remainingAmount}>
            {formatCurrency(goal.target_amount - goal.current_amount)} remaining
          </Text>
        </View>

        <View style={styles.goalFooter}>
          <View style={styles.goalInfo}>
            {daysRemaining !== null && (
              <Text style={[styles.daysRemaining, daysRemaining < 30 && styles.urgentDays]}>
                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue'}
              </Text>
            )}
            {goal.lock_in_enabled && (
              <Text style={styles.roundUpBadge}>🔄 Round-up enabled</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.addFundsButton, { backgroundColor: category.color }]}
            onPress={() => openAddFundsModal(goal.goal_id)}
            disabled={!isActive || isCompleted}
          >
            <Text style={styles.addFundsButtonText}>
              {isCompleted ? '✓ Complete' : '+ Add Funds'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading on initial load
  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Savings Goals</Text>
          <View style={styles.createButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B4332" />
          <Text style={styles.loadingText}>Loading your goals...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const activeGoals = getActiveGoals();
  const totalSaved = getTotalSavedAmount();
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savings Goals</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ New Goal</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Savings</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalSaved)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active Goals</Text>
          <Text style={styles.summaryCount}>{activeGoals.length}</Text>
        </View>
      </View>

      {/* Goals List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.goalsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#1B4332']}
            tintColor="#1B4332"
          />
        }
      >
        {goals.length > 0 ? (
          goals.map(renderGoalCard)
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
                      <Text style={styles.categoryLabel}>{category.label}</Text>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
  },
  createButton: {
    backgroundColor: '#52B788',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4332',
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#52B788',
  },
  goalsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inactiveGoal: {
    opacity: 0.6,
  },
  goalHeader: {
    marginBottom: 16,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  goalIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: '#6C757D',
  },
  menuButton: {
    padding: 4,
  },
  menuButtonText: {
    fontSize: 20,
    color: '#6C757D',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
  },
  amountSection: {
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B4332',
    marginRight: 8,
  },
  targetAmount: {
    fontSize: 14,
    color: '#6C757D',
  },
  remainingAmount: {
    fontSize: 12,
    color: '#6C757D',
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
  },
  daysRemaining: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 4,
  },
  urgentDays: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  roundUpBadge: {
    fontSize: 11,
    color: '#52B788',
    backgroundColor: '#B7E4C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addFundsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addFundsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyActionButton: {
    backgroundColor: '#52B788',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalCancelButton: {
    padding: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6C757D',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: 16,
    color: '#52B788',
    fontWeight: '600',
  },
  modalForm: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1B4332',
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
    padding: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 80,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#1B4332',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    padding: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#6C757D',
  },
  switch: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#52B788',
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  addFundsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  selectedGoalInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  selectedGoalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 8,
  },
  selectedGoalProgress: {
    fontSize: 14,
    color: '#6C757D',
  },
  amountInput: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickAmountContainer: {
    marginTop: 24,
  },
  quickAmountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 12,
  },
  quickAmountButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickAmountButtonText: {
    fontSize: 14,
    color: '#1B4332',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    fontFamily: 'System',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default SavingsGoalsScreen;