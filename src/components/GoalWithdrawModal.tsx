import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavingsStore } from '@/store/savingsStore';
import { useWalletStore } from '@/store/walletStore';
import { formatCurrency } from '@/utils/formatters';
import { useTheme } from '@/contexts/ThemeContext';

interface GoalWithdrawModalProps {
  visible: boolean;
  goalId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const GoalWithdrawModal: React.FC<GoalWithdrawModalProps> = ({
  visible,
  goalId,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [selectedWallet, setSelectedWallet] = useState<'main' | 'savings'>('main');
  const [isProcessing, setIsProcessing] = useState(false);

  const goals = useSavingsStore((state) => state.goals);
  const withdrawFromGoal = useSavingsStore((state) => state.withdrawFromGoal);
  const wallets = useWalletStore((state) => state.wallets);

  const currentGoal = goalId ? goals.find((g) => g.goal_id === goalId) : null;
  const mainWallet = wallets.find((w) => w.wallet_type === 'main');
  const savingsWallet = wallets.find((w) => w.wallet_type === 'savings');
  const styles = createStyles(theme);

  const handleClose = () => {
    setSelectedWallet('main');
    onClose();
  };

  const handleWithdraw = async () => {
    if (!currentGoal) return;

    if (currentGoal.current_amount <= 0) {
      Alert.alert('Error', 'No funds available to withdraw');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await withdrawFromGoal(currentGoal.goal_id, selectedWallet);

      Alert.alert(
        'Withdrawal Successful',
        `${formatCurrency(response.amount_withdrawn)} has been transferred to your ${
          selectedWallet === 'main' ? 'main' : 'savings'
        } wallet!`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              onSuccess?.();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Withdrawal Failed', error.message || 'Failed to withdraw funds. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentGoal) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.content}edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Withdraw Funds</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Icon name="info-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>
                Withdraw your savings from this completed goal to your main or savings wallet
              </Text>
            </View>

            {/* Goal Card */}
            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Icon name="emoji-events" size={28} color={theme.colors.accent} />
                <Text style={styles.goalName}>{currentGoal.name}</Text>
              </View>
              {currentGoal.description && (
                <Text style={styles.goalDescription}>{currentGoal.description}</Text>
              )}
              <View style={styles.completionBadge}>
                <Icon name="check-circle" size={16} color={theme.colors.success} />
                <Text style={styles.completionText}>Goal Completed!</Text>
              </View>
            </View>

            {/* Amount Card */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Available to Withdraw</Text>
              <Text style={styles.amountValue}>{formatCurrency(currentGoal.current_amount)}</Text>
            </View>

            {/* Wallet Selection */}
            <View style={styles.walletSection}>
              <Text style={styles.walletSectionLabel}>Select Destination Wallet</Text>

              {/* Main Wallet Option */}
              <TouchableOpacity
                style={[
                  styles.walletOption,
                  selectedWallet === 'main' && styles.walletOptionSelected,
                ]}
                onPress={() => setSelectedWallet('main')}
              >
                <View style={styles.walletOptionLeft}>
                  <View
                    style={[
                      styles.radioButton,
                      selectedWallet === 'main' && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedWallet === 'main' && <View style={styles.radioButtonInner} />}
                  </View>
                  <View>
                    <Text style={styles.walletOptionTitle}>Main Wallet</Text>
                    <Text style={styles.walletOptionBalance}>
                      Current: {formatCurrency(mainWallet?.available_balance ?? 0)}
                    </Text>
                  </View>
                </View>
                <Icon
                  name="account-balance-wallet"
                  size={24}
                  color={
                    selectedWallet === 'main' ? theme.colors.accent : theme.colors.textTertiary
                  }
                />
              </TouchableOpacity>

              {/* Savings Wallet Option */}
              <TouchableOpacity
                style={[
                  styles.walletOption,
                  selectedWallet === 'savings' && styles.walletOptionSelected,
                ]}
                onPress={() => setSelectedWallet('savings')}
              >
                <View style={styles.walletOptionLeft}>
                  <View
                    style={[
                      styles.radioButton,
                      selectedWallet === 'savings' && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedWallet === 'savings' && <View style={styles.radioButtonInner} />}
                  </View>
                  <View>
                    <Text style={styles.walletOptionTitle}>Savings Wallet</Text>
                    <Text style={styles.walletOptionBalance}>
                      Current: {formatCurrency(savingsWallet?.available_balance ?? 0)}
                    </Text>
                  </View>
                </View>
                <Icon
                  name="savings"
                  size={24}
                  color={
                    selectedWallet === 'savings' ? theme.colors.accent : theme.colors.textTertiary
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Withdrawal Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Withdrawal Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>From</Text>
                <Text style={styles.summaryValue}>{currentGoal.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>To</Text>
                <Text style={styles.summaryValue}>
                  {selectedWallet === 'main' ? 'Main Wallet' : 'Savings Wallet'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelBold}>Total Amount</Text>
                <Text style={styles.summaryValueBold}>
                  {formatCurrency(currentGoal.current_amount)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Withdraw Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (currentGoal.current_amount <= 0 || isProcessing) && styles.withdrawButtonDisabled,
              ]}
              onPress={handleWithdraw}
              disabled={currentGoal.current_amount <= 0 || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Text style={styles.withdrawButtonText}>Withdraw Funds</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
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
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.primary}10`,
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  goalCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  goalName: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  goalDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: `${theme.colors.success}15`,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  completionText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.success,
  },
  amountCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  amountValue: {
    fontSize: 36,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
  walletSection: {
    marginTop: theme.spacing.xl,
  },
  walletSectionLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  walletOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  walletOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: `${theme.colors.accent}08`,
  },
  walletOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: theme.colors.accent,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  walletOptionTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  walletOptionBalance: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  summaryLabelBold: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accent,
    letterSpacing: -0.5,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  withdrawButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  withdrawButtonDisabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.6,
  },
  withdrawButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
});

export default GoalWithdrawModal;
