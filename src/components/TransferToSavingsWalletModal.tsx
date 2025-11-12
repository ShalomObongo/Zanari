import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useWalletStore } from '@/store/walletStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import PinVerificationModal from './PinVerificationModal';
import { useTheme } from '@/contexts/ThemeContext';

interface TransferToSavingsWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TransferToSavingsWalletModal: React.FC<TransferToSavingsWalletModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const wallets = useWalletStore((state) => state.wallets);
  const transferToSavings = useWalletStore((state) => state.transferToSavings);

  const mainWallet = wallets.find((w) => w.wallet_type === 'main');
  const availableBalance = mainWallet?.available_balance ?? 0;
  const styles = createStyles(theme);

  const handleClose = () => {
    setAmount('');
    setShowPinModal(false);
    onClose();
  };

  const handleContinue = () => {
    console.log('TransferToSavingsWalletModal: handleContinue called', { amount });

    if (!amount.trim()) {
      Alert.alert('Error', 'Please enter an amount');
      return;
    }

    const amountCents = parseCentsFromInput(amount);
    console.log('TransferToSavingsWalletModal: Parsed amount', { amountCents, availableBalance });

    if (amountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amountCents < 100) {
      // Minimum KES 1.00
      Alert.alert('Error', 'Minimum transfer amount is KES 1.00');
      return;
    }

    if (amountCents > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You don't have enough funds in your main wallet. Available: ${formatCurrency(availableBalance)}`
      );
      return;
    }

    // Show PIN verification modal
    console.log('TransferToSavingsWalletModal: Opening PIN modal');
    setShowPinModal(true);
  };

  const handlePinVerified = async (pinToken: string) => {
    console.log('TransferToSavingsWalletModal: PIN verified', { pinToken: pinToken.substring(0, 10) + '...' });
    const amountCents = parseCentsFromInput(amount);
    setIsProcessing(true);

    try {
      console.log('TransferToSavingsWalletModal: Calling transferToSavings', { amountCents });
      const result = await transferToSavings(amountCents, pinToken);
      console.log('TransferToSavingsWalletModal: Transfer successful', result);

      Alert.alert(
        'Transfer Successful',
        `${formatCurrency(amountCents)} has been transferred to your savings wallet!`,
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
      console.error('TransferToSavingsWalletModal: Transfer failed', error);
      Alert.alert('Transfer Failed', error.message || 'Failed to transfer funds. Please try again.');
    } finally {
      setIsProcessing(false);
      setShowPinModal(false);
    }
  };

  useEffect(() => {
    const onShow = (e: any) => setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <>
      <Modal visible={visible && !showPinModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.content} edges={['bottom']}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Transfer to Savings</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Info Card */}
              <View style={styles.infoCard}>
                <Icon name="info-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.infoText}>
                  Transfer money from your main wallet to your savings wallet for safekeeping
                </Text>
              </View>

              {/* Balance Card */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceHeader}>
                  <Icon name="account-balance-wallet" size={24} color={theme.colors.success} />
                  <Text style={styles.balanceLabel}>Main Wallet Balance</Text>
                </View>
                <Text style={styles.balanceAmount}>{formatCurrency(availableBalance)}</Text>
              </View>

              {/* Amount Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount to Transfer</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencyPrefix}>KES</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>
                {amount && parseInt(amount) > 0 && (
                  <Text style={styles.amountPreview}>{formatCurrency(parseCentsFromInput(amount))}</Text>
                )}
              </View>

              {/* Quick Amounts */}
              <View style={styles.quickAmountSection}>
                <Text style={styles.quickAmountLabel}>Quick Amount</Text>
                <View style={styles.quickAmountGrid}>
                  {[1000, 5000, 10000, 25000].map((quickAmount) => (
                    <TouchableOpacity
                      key={quickAmount}
                      style={[
                        styles.quickAmountChip,
                        amount === quickAmount.toString() && styles.quickAmountChipSelected,
                      ]}
                      onPress={() => setAmount(quickAmount.toString())}
                    >
                      <Text
                        style={[
                          styles.quickAmountChipText,
                          amount === quickAmount.toString() && styles.quickAmountChipTextSelected,
                        ]}
                      >
                        {formatCurrency(quickAmount * 100)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Transfer Summary */}
              {amount && parseInt(amount) > 0 && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Transfer Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>From</Text>
                    <Text style={styles.summaryValue}>Main Wallet</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>To</Text>
                    <Text style={styles.summaryValue}>Savings Wallet</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelBold}>Total Amount</Text>
                    <Text style={styles.summaryValueBold}>
                      {formatCurrency(parseCentsFromInput(amount))}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) + (keyboardHeight > 0 ? theme.spacing.xs : 0) },
              ]}
            >
              <TouchableOpacity
                style={[styles.continueButton, (!amount || parseInt(amount) <= 0) && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!amount || parseInt(amount) <= 0 || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Text style={styles.continueButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <PinVerificationModal
        visible={visible && showPinModal}
        onCancel={() => setShowPinModal(false)}
        onSuccess={handlePinVerified}
      />
    </>
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
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
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
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.primary,
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
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
  balanceCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  balanceLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },
  formGroup: {
    marginTop: theme.spacing.xl,
  },
  formLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
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
  amountInput: {
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
  continueButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  continueButtonDisabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
});

export default TransferToSavingsWalletModal;
