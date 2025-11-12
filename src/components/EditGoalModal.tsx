import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavingsStore } from '@/store/savingsStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import { useTheme } from '@/contexts/ThemeContext';

interface EditGoalModalProps {
  visible: boolean;
  goalId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

// Category icons and colors for modal
const GOAL_CATEGORIES = {
  emergency: { icon: '🚨', color: '#ef4444', label: 'Safety' },
  vacation: { icon: '✈️', color: '#f97316', label: 'Travel' },
  purchase: { icon: '🛍️', color: '#3b82f6', label: 'Technology' },
  education: { icon: '🎓', color: '#10b981', label: 'Education' },
  other: { icon: '💡', color: '#a855f7', label: 'Other' },
};

const EditGoalModal: React.FC<EditGoalModalProps> = ({ visible, goalId, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [goalData, setGoalData] = useState({
    name: '',
    description: '',
    targetAmount: '',
    targetDate: '',
    category: 'emergency' as keyof typeof GOAL_CATEGORIES,
  });

  const goals = useSavingsStore((state) => state.goals);
  const updateGoal = useSavingsStore((state) => state.updateGoal);

  const currentGoal = goalId ? goals.find((g) => g.goal_id === goalId) : null;
  const styles = createStyles(theme);

  // Initialize form data when goal changes
  useEffect(() => {
    if (currentGoal) {
      setGoalData({
        name: currentGoal.name,
        description: currentGoal.description || '',
        targetAmount: (currentGoal.target_amount / 100).toString(),
        targetDate: currentGoal.target_date || '',
        category: (currentGoal.category || 'emergency') as keyof typeof GOAL_CATEGORIES,
      });
    }
  }, [currentGoal]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!currentGoal) return;

    if (!goalData.name.trim()) {
      Alert.alert('Error', 'Please enter a goal name');
      return;
    }

    const targetAmountCents = parseCentsFromInput(goalData.targetAmount);
    if (targetAmountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    // Validate that target amount is not less than current amount
    if (targetAmountCents < currentGoal.current_amount) {
      Alert.alert(
        'Invalid Amount',
        `Target amount cannot be less than current saved amount (${formatCurrency(currentGoal.current_amount)})`
      );
      return;
    }

    // Validate target date if provided
    if (goalData.targetDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(goalData.targetDate)) {
        Alert.alert('Error', 'Please enter date in format YYYY-MM-DD');
        return;
      }

      const targetDate = new Date(goalData.targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (targetDate < today) {
        Alert.alert('Error', 'Target date cannot be in the past');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await updateGoal(currentGoal.goal_id, {
        name: goalData.name.trim(),
        description: goalData.description.trim() || undefined,
        target_amount: targetAmountCents,
        target_date: goalData.targetDate || null,
        category: goalData.category,
      });

      Alert.alert('Success', 'Goal updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            handleClose();
            onSuccess?.();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update goal. Please try again.');
      console.error('Update goal error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentGoal) {
    return null;
  }

  // Check if goal can be edited
  const canEdit = currentGoal.status === 'active' || currentGoal.status === 'paused';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.content} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Goal</Text>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSubmitting || !canEdit}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={[styles.saveText, !canEdit && styles.saveTextDisabled]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {!canEdit && (
              <View style={styles.warningCard}>
                <Icon name="info-outline" size={20} color={theme.colors.warning} />
                <Text style={styles.warningText}>
                  This goal cannot be edited because it is {currentGoal.status}
                </Text>
              </View>
            )}

            {/* Current Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Current Progress</Text>
                <Text style={styles.progressPercentage}>
                  {Math.round(currentGoal.progress_percentage)}%
                </Text>
              </View>
              <Text style={styles.progressAmount}>{formatCurrency(currentGoal.current_amount)}</Text>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(currentGoal.progress_percentage, 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Goal Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Goal Name *</Text>
              <TextInput
                style={[styles.formInput, !canEdit && styles.formInputDisabled]}
                value={goalData.name}
                onChangeText={(text) => setGoalData((prev) => ({ ...prev, name: text }))}
                placeholder="e.g., Emergency Fund, New Car, Vacation"
                placeholderTextColor={theme.colors.textTertiary}
                maxLength={50}
                editable={canEdit}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.formInput, styles.textArea, !canEdit && styles.formInputDisabled]}
                value={goalData.description}
                onChangeText={(text) => setGoalData((prev) => ({ ...prev, description: text }))}
                placeholder="Brief description of your savings goal"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={3}
                maxLength={200}
                editable={canEdit}
              />
            </View>

            {/* Target Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Target Amount (KES) *</Text>
              <TextInput
                style={[styles.formInput, !canEdit && styles.formInputDisabled]}
                value={goalData.targetAmount}
                onChangeText={(text) =>
                  setGoalData((prev) => ({ ...prev, targetAmount: text.replace(/[^0-9]/g, '') }))
                }
                placeholder="50000"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="numeric"
                editable={canEdit}
              />
              <Text style={styles.helpText}>
                Must be at least {formatCurrency(currentGoal.current_amount)} (current amount)
              </Text>
            </View>

            {/* Target Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Target Date (Optional)</Text>
              <TextInput
                style={[styles.formInput, !canEdit && styles.formInputDisabled]}
                value={goalData.targetDate}
                onChangeText={(text) => setGoalData((prev) => ({ ...prev, targetDate: text }))}
                placeholder="YYYY-MM-DD (e.g., 2025-12-31)"
                placeholderTextColor={theme.colors.textTertiary}
                editable={canEdit}
              />
              <Text style={styles.helpText}>Leave empty if you don't have a specific deadline</Text>
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryContainer}
              >
                {Object.entries(GOAL_CATEGORIES).map(([key, category]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryButton,
                      goalData.category === key && {
                        backgroundColor: category.color + '20',
                        borderColor: category.color,
                      },
                      !canEdit && styles.categoryButtonDisabled,
                    ]}
                    onPress={() =>
                      canEdit &&
                      setGoalData((prev) => ({ ...prev, category: key as keyof typeof GOAL_CATEGORIES }))
                    }
                    disabled={!canEdit}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text style={styles.categoryButtonLabel}>{category.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cancelButton: {
    padding: theme.spacing.sm,
  },
  cancelText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.primary,
  },
  saveButton: {
    padding: theme.spacing.sm,
  },
  saveText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.accent,
  },
  saveTextDisabled: {
    color: theme.colors.textTertiary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.warning}15`,
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: `${theme.colors.warning}30`,
  },
  warningText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.warning,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  progressPercentage: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accent,
  },
  progressAmount: {
    fontSize: 28,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
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
  formInputDisabled: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.textTertiary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
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
  categoryButtonDisabled: {
    opacity: 0.5,
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
});

export default EditGoalModal;
