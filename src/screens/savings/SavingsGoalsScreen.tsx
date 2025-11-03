import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SectionList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavingsStore } from '@/store/savingsStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import { apiClient } from '@/services/api';
import TransferToSavingsWalletModal from '@/components/TransferToSavingsWalletModal';
import EditGoalModal from '@/components/EditGoalModal';
import GoalWithdrawModal from '@/components/GoalWithdrawModal';
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
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [withdrawingGoalId, setWithdrawingGoalId] = useState<string | null>(null);
  const [selectedSourceWallet, setSelectedSourceWallet] = useState<'main' | 'savings'>('main');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zustand stores
  const goals = useSavingsStore((state) => state.goals);
  const fetchGoals = useSavingsStore((state) => state.fetchGoals);
  const refreshGoals = useSavingsStore((state) => state.refreshGoals);
  const createGoal = useSavingsStore((state) => state.createGoal);
  const updateGoal = useSavingsStore((state) => state.updateGoal);
  const deleteGoal = useSavingsStore((state) => state.deleteGoal);
  const depositToGoal = useSavingsStore((state) => state.depositToGoal);
  const getTotalSavedAmount = useSavingsStore((state) => state.getTotalSavedAmount);
  const getTotalAllocatedToGoals = useSavingsStore((state) => state.getTotalAllocatedToGoals);
  // const getActiveGoals = useSavingsStore((state) => state.getActiveGoals);
  const isRefreshing = useSavingsStore((state) => state.isRefreshing);

  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const getSavingsWalletSummary = useWalletStore((state) => state.getSavingsWalletSummary);

  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const savingsWallet = wallets.find(w => w.wallet_type === 'savings');

  const totalAllocated = getTotalAllocatedToGoals();
  const savingsSummary = getSavingsWalletSummary(totalAllocated);

  const selectedWallet = selectedSourceWallet === 'main' ? mainWallet : savingsWallet;
  const selectedBalance = selectedWallet?.available_balance ?? 0;

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
  const scrollViewRef = useRef<ScrollView>(null); // kept for minimal diff; no longer used by SectionList

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
    if (amountCents > selectedBalance) {
      const walletName = selectedSourceWallet === 'main' ? 'Main wallet' : 'Savings wallet';
      Alert.alert('Error', `Insufficient balance in ${walletName}. Available: ${formatCurrency(selectedBalance)}`);
      return;
    }

    if (amountCents > 100000000) { // KES 1M limit in cents
      Alert.alert('Error', 'Maximum deposit amount is KES 1,000,000');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await depositToGoal(selectedGoal.goal_id, amountCents, selectedSourceWallet);

      // Show milestone achievements
      if (result.milestonesReached && result.milestonesReached.length > 0) {
        const milestones = result.milestonesReached.map((m: any) => `${m.percentage}%`).join(', ');
        Alert.alert('Milestone Achieved!', `You hit ${milestones} on your savings goal!`);
      }

      // Show completion
      if (result.completed) {
        Alert.alert('Goal Completed!', `Congratulations! You've reached your savings goal.`);
      }

      // Refresh wallets to show updated balance
      await refreshWallets();

      setAddAmount('');
      setShowAddFundsModal(false);
      setSelectedGoalId(null);
      setSelectedSourceWallet('main'); // Reset to main
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
            <View style={styles.goalHeaderRight}>
              {goal.lock_in_enabled && (
                <View style={styles.roundUpBadge}>
                  <Icon name="all-inclusive" size={14} color={theme.colors.primary} />
                  <Text style={styles.roundUpBadgeText}>Round-up</Text>
                </View>
              )}
              {(isActive || goal.status === 'paused') && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setEditingGoalId(goal.goal_id);
                    setShowEditModal(true);
                  }}
                >
                  <Icon name="edit" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
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
            {isCompleted ? (
            <TouchableOpacity
              style={[styles.addFundsButton, styles.withdrawButton]}
              onPress={() => {
                setWithdrawingGoalId(goal.goal_id);
                setShowWithdrawModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addFundsButton}
              onPress={() => openAddFundsModal(goal.goal_id)}
              disabled={!isActive}
              activeOpacity={0.8}
            >
              <Text style={styles.addFundsButtonText}>Add Funds</Text>
            </TouchableOpacity>
          )}
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
        <SafeAreaView style={styles.container} edges={['top']}>
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

  const totalSaved = getTotalSavedAmount();

  // Sorting helpers
  const toTime = (s: string | null) => (s ? new Date(s).getTime() : Infinity);
  const toTimeDesc = (s: string | null) => (s ? new Date(s).getTime() : -Infinity);

  const activeGoalsSorted = goals
    .filter((g) => g.status === 'active')
    .sort((a, b) => {
      const aDate = toTime(a.target_date);
      const bDate = toTime(b.target_date);
      if (aDate !== bDate) return aDate - bDate; // earliest target date first
      if (a.progress_percentage !== b.progress_percentage) return b.progress_percentage - a.progress_percentage; // higher progress next
      return toTimeDesc(b.updated_at) - toTimeDesc(a.updated_at); // most recently updated last tie-break
    });

  const completedNotCashed = goals
    .filter((g) => g.status === 'completed' && (g.current_amount ?? 0) > 0)
    .sort((a, b) => {
      const aCompleted = toTimeDesc(a.completed_at);
      const bCompleted = toTimeDesc(b.completed_at);
      if (aCompleted !== bCompleted) return bCompleted - aCompleted; // most recently completed first
      return toTimeDesc(b.updated_at) - toTimeDesc(a.updated_at);
    });

  const cashedOutGoals = goals
    .filter((g) => g.status === 'completed' && (g.current_amount ?? 0) <= 0)
    .sort((a, b) => toTimeDesc(b.updated_at) - toTimeDesc(a.updated_at));

  const sections = [
    { key: 'active', title: `Active Goals (${activeGoalsSorted.length})`, data: activeGoalsSorted },
    { key: 'completed', title: `Completed (Ready to Cash Out) (${completedNotCashed.length})`, data: completedNotCashed },
    { key: 'cashedOut', title: `Cashed Out (${cashedOutGoals.length})`, data: cashedOutGoals },
  ];

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenuModal(true)}
          >
            <Icon name="more-vert" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.goal_id}
          renderItem={({ item, index }) => renderGoalCard(item, index)}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) => {
            if (section.data.length > 0) return null;
            if (section.key === 'active') {
              return (
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
              );
            }
            if (section.key === 'completed') {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🏁</Text>
                  <Text style={styles.emptyTitle}>No Completed Goals Yet</Text>
                  <Text style={styles.emptyDescription}>
                    Once you complete a goal, it will appear here and you can withdraw to your preferred wallet.
                  </Text>
                </View>
              );
            }
            if (section.key === 'cashedOut') {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📈</Text>
                  <Text style={styles.emptyTitle}>No Cashed Out Goals Yet</Text>
                  <Text style={styles.emptyDescription}>Withdraw your completed goals to see them here.</Text>
                </View>
              );
            }
            return null;
          }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
          }
          ListHeaderComponent={
            savingsSummary ? (
              <View style={styles.savingsWalletCard}>
                <View style={styles.walletHeader}>
                  <Icon name="account-balance-wallet" size={24} color={theme.colors.accent} />
                  <Text style={styles.walletTitle}>Savings Wallet</Text>
                </View>

                <View style={styles.walletBalanceRow}>
                  <Text style={styles.walletMainBalance}>{formatCurrency(savingsSummary.totalBalance)}</Text>
                </View>

                <View style={styles.walletBreakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Allocated to Goals</Text>
                    <Text style={styles.breakdownAmount}>{formatCurrency(savingsSummary.allocatedToGoals)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Available</Text>
                    <Text style={[styles.breakdownAmount, styles.availableAmount]}>{formatCurrency(savingsSummary.availableBalance)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.transferToSavingsButton}
                  onPress={() => setShowTransferModal(true)}
                >
                  <Icon name="add-circle-outline" size={20} color={theme.colors.surface} />
                  <Text style={styles.transferButtonText}>Transfer to Savings</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />

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
            <SafeAreaView style={styles.modalContent}edges={['top']}>
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
                  <Text style={styles.formLabel}>Target Date (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newGoal.targetDate}
                    onChangeText={(text) => setNewGoal(prev => ({ ...prev, targetDate: text }))}
                    placeholder="YYYY-MM-DD (e.g., 2025-12-31)"
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <Text style={styles.helpText}>Leave empty if you don't have a specific deadline</Text>
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
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Text style={styles.switchLabel}>Enable Round-up Savings</Text>
                      <Text style={styles.switchDescription}>
                        Automatically save spare change from transactions
                      </Text>
                    </View>
                    <Switch
                      value={newGoal.roundUpEnabled}
                      onValueChange={(value) => setNewGoal(prev => ({ ...prev, roundUpEnabled: value }))}
                      trackColor={{ false: theme.colors.gray200, true: theme.colors.accent }}
                      thumbColor={theme.colors.surface}
                      ios_backgroundColor={theme.colors.gray200}
                    />
                  </View>
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
            <SafeAreaView style={styles.modalContent}edges={['top']}>
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

              <ScrollView style={styles.addFundsContent} showsVerticalScrollIndicator={false}>
                {selectedGoal && (
                  <>
                    <View style={styles.selectedGoalCard}>
                      <View style={styles.goalIconContainer}>
                        <Icon name="savings" size={32} color={theme.colors.accent} />
                      </View>
                      <Text style={styles.selectedGoalTitle}>{selectedGoal.name}</Text>
                      <View style={styles.goalProgressInfo}>
                        <Text style={styles.goalProgressLabel}>Current Progress</Text>
                        <Text style={styles.goalProgressAmount}>
                          {formatCurrency(selectedGoal.current_amount)}
                        </Text>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(selectedGoal.progress_percentage, 100)}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.goalTargetText}>
                          Target: {formatCurrency(selectedGoal.target_amount)} ({Math.round(selectedGoal.progress_percentage)}%)
                        </Text>
                      </View>
                    </View>

                    {/* Source Wallet Selector */}
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Transfer From</Text>
                      <View style={styles.walletSelectorRow}>
                        <TouchableOpacity
                          style={[
                            styles.walletSelectorOption,
                            selectedSourceWallet === 'main' && styles.walletSelectorOptionSelected
                          ]}
                          onPress={() => setSelectedSourceWallet('main')}
                        >
                          <Icon
                            name="account-balance-wallet"
                            size={20}
                            color={selectedSourceWallet === 'main' ? theme.colors.accent : theme.colors.textSecondary}
                          />
                          <View style={styles.walletSelectorInfo}>
                            <Text style={[
                              styles.walletSelectorLabel,
                              selectedSourceWallet === 'main' && styles.walletSelectorLabelSelected
                            ]}>
                              Main Wallet
                            </Text>
                            <Text style={styles.walletSelectorBalance}>
                              {formatCurrency(mainWallet?.available_balance ?? 0)}
                            </Text>
                          </View>
                          {selectedSourceWallet === 'main' && (
                            <Icon name="check-circle" size={20} color={theme.colors.accent} />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.walletSelectorOption,
                            selectedSourceWallet === 'savings' && styles.walletSelectorOptionSelected
                          ]}
                          onPress={() => setSelectedSourceWallet('savings')}
                        >
                          <Icon
                            name="savings"
                            size={20}
                            color={selectedSourceWallet === 'savings' ? theme.colors.accent : theme.colors.textSecondary}
                          />
                          <View style={styles.walletSelectorInfo}>
                            <Text style={[
                              styles.walletSelectorLabel,
                              selectedSourceWallet === 'savings' && styles.walletSelectorLabelSelected
                            ]}>
                              Savings Wallet
                            </Text>
                            <Text style={styles.walletSelectorBalance}>
                              {formatCurrency(savingsWallet?.available_balance ?? 0)}
                            </Text>
                          </View>
                          {selectedSourceWallet === 'savings' && (
                            <Icon name="check-circle" size={20} color={theme.colors.accent} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Amount to Add</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencyPrefix}>KES</Text>
                    <TextInput
                      style={styles.amountInputField}
                      value={addAmount}
                      onChangeText={(text) => setAddAmount(text.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textTertiary}
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                  {addAmount && parseInt(addAmount) > 0 && (
                    <Text style={styles.amountPreview}>
                      {formatCurrency(parseCentsFromInput(addAmount))}
                    </Text>
                  )}
                </View>

                <View style={styles.quickAmountSection}>
                  <Text style={styles.quickAmountLabel}>Quick Amount</Text>
                  <View style={styles.quickAmountGrid}>
                    {[1000, 5000, 10000, 25000].map(amount => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.quickAmountChip,
                          addAmount === amount.toString() && styles.quickAmountChipSelected
                        ]}
                        onPress={() => setAddAmount(amount.toString())}
                      >
                        <Text style={[
                          styles.quickAmountChipText,
                          addAmount === amount.toString() && styles.quickAmountChipTextSelected
                        ]}>
                          {formatCurrency(amount * 100)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Menu Modal */}
        <Modal
          visible={showMenuModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowMenuModal(false)}
        >
          <TouchableOpacity
            style={styles.menuModalOverlay}
            activeOpacity={1}
            onPress={() => setShowMenuModal(false)}
          >
            <View style={styles.menuModalContent}>
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowMenuModal(false);
                  navigation.navigate('SavingsInsights');
                }}
              >
                <Icon name="pie-chart" size={24} color={theme.colors.textPrimary} />
                <Text style={styles.menuOptionText}>View Total Saved</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setShowMenuModal(false);
                  setShowTransferModal(true);
                }}
              >
                <Icon name="arrow-forward" size={24} color={theme.colors.textPrimary} />
                <Text style={styles.menuOptionText}>Transfer to Savings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOption, styles.menuOptionLast]}
                onPress={() => {
                  setShowMenuModal(false);
                  navigation.navigate('RoundUpSettings');
                }}
              >
                <Icon name="settings" size={24} color={theme.colors.textPrimary} />
                <Text style={styles.menuOptionText}>Round-up Settings</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Transfer to Savings Modal */}
        <TransferToSavingsWalletModal
          visible={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onSuccess={async () => {
            await handleRefresh();
          }}
        />

        {/* Edit Goal Modal */}
        <EditGoalModal
          visible={showEditModal}
          goalId={editingGoalId}
          onClose={() => {
            setShowEditModal(false);
            setEditingGoalId(null);
          }}
          onSuccess={async () => {
            await handleRefresh();
          }}
        />

        <GoalWithdrawModal
          visible={showWithdrawModal}
          goalId={withdrawingGoalId}
          onClose={() => {
            setShowWithdrawModal(false);
            setWithdrawingGoalId(null);
          }}
          onSuccess={async () => {
            await handleRefresh();
          }}
        />
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
    paddingBottom: 100, // Extra space for floating glassmorphism tab bar
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
  goalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  editButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
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
  withdrawButton: {
    backgroundColor: theme.colors.success,
  },
  withdrawButtonText: {
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
  selectedGoalCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: `${theme.colors.accent}1A`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  selectedGoalTitle: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.base,
    textAlign: 'center',
  },
  goalProgressInfo: {
    width: '100%',
    alignItems: 'center',
  },
  goalProgressLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  goalProgressAmount: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
  },
  goalTargetText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.success}10`,
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: `${theme.colors.success}30`,
    gap: theme.spacing.md,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs / 2,
  },
  balanceAmount: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xs,
  },
  currencyPrefix: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  amountInputField: {
    flex: 1,
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    padding: theme.spacing.sm,
  },
  amountPreview: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.accent,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  quickAmountSection: {
    marginTop: theme.spacing.xl,
  },
  quickAmountLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  quickAmountChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  quickAmountChipSelected: {
    backgroundColor: `${theme.colors.accent}15`,
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  quickAmountChipText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  quickAmountChipTextSelected: {
    color: theme.colors.accent,
  },
  helpText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  // Savings Wallet Summary Card
  savingsWalletCard: {
    marginHorizontal: theme.spacing.base,
    marginVertical: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  walletTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  walletBalanceRow: {
    marginBottom: theme.spacing.base,
  },
  walletMainBalance: {
    fontSize: 32,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },
  walletBreakdown: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.base,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  breakdownAmount: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  availableAmount: {
    color: theme.colors.success,
  },
  transferToSavingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentDarker,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  transferButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  // Wallet Selector
  walletSelectorRow: {
    gap: theme.spacing.md,
  },
  walletSelectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.base,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  walletSelectorOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: `${theme.colors.accent}08`,
  },
  walletSelectorInfo: {
    flex: 1,
  },
  walletSelectorLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs / 2,
  },
  walletSelectorLabelSelected: {
    color: theme.colors.accent,
  },
  walletSelectorBalance: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  // Menu Modal
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 60 : 60,
    paddingRight: theme.spacing.base,
  },
  menuModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    minWidth: 240,
    ...theme.shadows.lg,
    overflow: 'hidden',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuOptionLast: {
    borderBottomWidth: 0,
  },
  menuOptionText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
  },
});

export default SavingsGoalsScreen;
