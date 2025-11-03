import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePaystack } from 'react-native-paystack-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PinVerificationModal from '@/components/PinVerificationModal';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useRoundUpStore } from '@/store/roundUpStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import { calculateRoundUp, getRoundUpDescription } from '@/utils/roundUpCalculator';
import api, { ApiError } from '@/services/api';
import { useTheme } from '@/theme';
import theme from '@/theme';

interface TransferScreenProps {}

const TransferScreen: React.FC<TransferScreenProps> = () => {
  const themeColors = useTheme();
  const navigation = useNavigation<any>();
  const { popup } = usePaystack();

  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'savings' | 'mpesa' | 'card'>('wallet');
  const [recipientUser, setRecipientUser] = useState<{ exists: boolean; user_id?: string; name?: string } | null>(null);
  const [isValidatingRecipient, setIsValidatingRecipient] = useState(false);
  const [fee, setFee] = useState(0);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const pinRequestRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zustand stores
  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const transactions = useTransactionStore((state) => state.transactions);
  const refreshTransactions = useTransactionStore((state) => state.refreshTransactions);
  const user = useAuthStore((state) => state.user);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const consumePinToken = useAuthStore((state) => state.consumePinToken);
  const roundUpRule = useRoundUpStore((state) => state.rule);

  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const savingsWallet = wallets.find(w => w.wallet_type === 'savings');
  const availableBalance = paymentMethod === 'savings'
    ? (savingsWallet?.available_balance ?? 0)
    : (mainWallet?.available_balance ?? 0);

  // Calculate round-up for preview
  const amountCents = parseCentsFromInput(amount.replace(/,/g, ''));
  const roundUpCalculation = roundUpRule?.is_enabled && amountCents > 0
    ? calculateRoundUp(amountCents, roundUpRule)
    : null;
  const roundUpAmount = roundUpCalculation?.roundUpAmount ?? 0;
  const totalWithRoundUp = amountCents + fee + roundUpAmount;

  const formatAmount = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned) {
      const number = parseInt(cleaned);
      return number.toLocaleString();
    }
    return '';
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatAmount(text);
    setAmount(formatted);
  };

  const getNumericAmount = () => {
    return parseInt(amount.replace(/,/g, '')) || 0;
  };

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    
    return cleaned;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    if (formatted.length <= 12) {
      setRecipientPhone(formatted);
    }
  };

  const displayPhoneNumber = (number: string) => {
    if (number.startsWith('254') && number.length > 3) {
      return `+${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`;
    }
    return number;
  };

  const isValidKenyanNumber = (number: string) => {
    const kenyanRegex = /^254(7[0-9]{8}|1[0-9]{8})$/;
    return kenyanRegex.test(number);
  };

  const requestPinToken = () =>
    new Promise<string>((resolve, reject) => {
      pinRequestRef.current = { resolve, reject };
      setPinModalVisible(true);
    });

  const handlePinModalSuccess = (token: string) => {
    if (pinRequestRef.current) {
      pinRequestRef.current.resolve(token);
      pinRequestRef.current = null;
    }
    setPinModalVisible(false);
  };

  const handlePinModalCancel = () => {
    if (pinRequestRef.current) {
      pinRequestRef.current.reject(new Error('PIN entry cancelled'));
      pinRequestRef.current = null;
    }
    setPinModalVisible(false);
  };

  useEffect(() => () => {
    if (pinRequestRef.current) {
      pinRequestRef.current.reject(new Error('PIN entry cancelled'));
      pinRequestRef.current = null;
    }
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
  }, []);

  // Calculate fee based on payment method
  useEffect(() => {
    if (paymentMethod === 'wallet' || paymentMethod === 'savings') {
      setFee(0);
    } else {
      setFee(1000); // KES 10 in cents
    }
  }, [paymentMethod]);

  // Real-time recipient validation with debouncing
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (recipientPhone.length >= 12 && isValidKenyanNumber(recipientPhone)) {
      setIsValidatingRecipient(true);
      validationTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await api.get<{ exists: boolean; user_id?: string; name?: string; error?: string; }>(`/users/lookup?phone=${recipientPhone}`);

          if (response.error === 'SELF_TRANSFER_NOT_ALLOWED') {
            setRecipientUser({ exists: false });
            setRecipientName('');
            Alert.alert('Invalid Recipient', 'You cannot transfer money to yourself.');
          } else if (response.exists && response.name) {
            setRecipientUser(response);
            setRecipientName(response.name);
          } else {
            setRecipientUser({ exists: false });
            setRecipientName('');
          }
        } catch (error) {
          console.error('Recipient validation error:', error);
          setRecipientUser({ exists: false });
          setRecipientName('');
        } finally {
          setIsValidatingRecipient(false);
        }
      }, 500); // 500ms debounce
    } else {
      setRecipientUser(null);
      setRecipientName('');
      setIsValidatingRecipient(false);
    }

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [recipientPhone]);

  const handleSendTransfer = async () => {
    const amountCents = parseCentsFromInput(amount.replace(/,/g, ''));

    if (amountCents <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    // Check available balance for wallet/savings payments
    if ((paymentMethod === 'wallet' || paymentMethod === 'savings') && amountCents > availableBalance) {
      Alert.alert('Insufficient Balance', `Available: ${formatCurrency(availableBalance)}`);
      return;
    }

    // Transaction limits: KES 5,000 single, KES 20,000 daily
    if (amountCents > 500000) { // KES 5,000 in cents
      Alert.alert('Transaction Limit', 'Single transaction limit is KES 5,000');
      return;
    }

    if (amountCents < 1000) { // KES 10 in cents
      Alert.alert('Minimum Amount', 'Minimum transfer amount is KES 10');
      return;
    }

    if (!recipientPhone || !isValidKenyanNumber(recipientPhone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Kenyan mobile number');
      return;
    }

    if (!recipientUser?.exists || !recipientUser.user_id) {
      Alert.alert('Recipient Not Found', 'This user is not registered on Zanari. Please check the phone number.');
      return;
    }

    // PIN required for all transfers
    if (!isPinSet) {
      Alert.alert(
        'Set up your PIN',
        'You need a transaction PIN before you can send money.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Up PIN',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Settings' }),
          },
        ],
      );
      return;
    }

    let pinToken: string;
    try {
      pinToken = await requestPinToken();
    } catch {
      return;
    }

    setIsLoading(true);

    try {
      const trimmedMessage = message.trim();

      const response = await api.post<{
        status: 'completed' | 'pending';
        transfer_transaction_id: string;
        recipient_transaction_id?: string;
        total_charged: number;
        fee: number;
        payment_method: string;
        transfer_type: string;
        paystack_authorization_url?: string;
        paystack_reference?: string;
        paystack_access_code?: string;
        round_up_amount?: number;
      }>('/payments/transfer', {
        amount: amountCents,
        pin_token: pinToken,
        recipient_user_id: recipientUser.user_id,
        description: trimmedMessage || undefined,
        payment_method: paymentMethod,
      });

      if (response.status === 'pending' && response.paystack_reference) {
        // External payment - open Paystack checkout
        const paystackReference = response.paystack_reference;

        setIsLoading(false);

        // Calculate total charge including round-up
        const responseRoundUp = response.round_up_amount ?? 0;
        const totalCharge = amountCents + fee + responseRoundUp;

        popup.newTransaction({
          email: user?.email || 'user@zanari.app',
          amount: totalCharge / 100, // Convert back to currency units (includes amount + fee + round-up)
          reference: paystackReference,
          onSuccess: async (res: any) => {
            console.log('Payment successful:', res);

            // Verify payment with backend
            try {
              await api.post('/payments/verify', {
                reference: paystackReference,
              });

              // Refresh wallet and transactions
              await Promise.all([refreshWallets(), refreshTransactions()]);

              // Clear form
              setAmount('');
              setRecipientPhone('');
              setRecipientName('');
              setMessage('');
              setRecipientUser(null);

              const friendlyAmount = formatCurrency(amountCents);
              const roundUpAmount = response.round_up_amount ?? 0;
              const successFragments = [`Successfully sent ${friendlyAmount} to ${recipientName}.`];

              if (fee > 0) {
                successFragments.push(`Fee: ${formatCurrency(fee)}.`);
              }

              if (roundUpAmount > 0) {
                successFragments.push(`An extra ${formatCurrency(roundUpAmount)} was moved to your savings.`);
              }

              Alert.alert(
                'Transfer Complete',
                successFragments.join(' '),
                [
                  {
                    text: 'View History',
                    onPress: () => navigation.navigate('MainTabs', { screen: 'History' }),
                  },
                  {
                    text: 'Done',
                    onPress: () => navigation.goBack(),
                  },
                ],
                { cancelable: false },
              );
            } catch (verifyError) {
              console.error('Verification error:', verifyError);
              Alert.alert(
                'Verification Pending',
                'Payment received but verification is pending. Check your transaction history.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            }
          },
          onCancel: () => {
            console.log('Payment cancelled');
            Alert.alert('Payment Cancelled', 'You cancelled the payment');
          },
          onError: (err: any) => {
            console.error('Payment error:', err);
            Alert.alert('Payment Error', 'An error occurred during payment. Please try again.');
          },
        });

        return;
      }

      // Wallet transfer completed
      await Promise.all([refreshWallets(), refreshTransactions()]);

      setAmount('');
      setRecipientPhone('');
      setRecipientName('');
      setMessage('');
      setRecipientUser(null);

      const friendlyAmount = formatCurrency(amountCents);
      const roundUpAmount = response.round_up_amount ?? 0;
      const successFragments = [`Successfully sent ${friendlyAmount} to ${recipientName}.`];

      if (fee > 0) {
        successFragments.push(`Fee: ${formatCurrency(fee)}.`);
      }

      if (roundUpAmount > 0) {
        successFragments.push(`An extra ${formatCurrency(roundUpAmount)} was moved to your savings.`);
      }

      const successMessage = successFragments.join(' ');

      Alert.alert(
        'Transfer Complete',
        successMessage,
        [
          {
            text: 'View History',
            onPress: () => navigation.navigate('MainTabs', { screen: 'History' }),
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.code) {
          case 'INSUFFICIENT_FUNDS': {
            const available = typeof error.details?.available_balance === 'number'
              ? formatCurrency(error.details.available_balance as number)
              : formatCurrency(availableBalance);
            Alert.alert('Insufficient Balance', `You only have ${available} available.`);
            break;
          }
          case 'PIN_TOKEN_EXPIRED':
            Alert.alert('PIN Expired', 'Please try again and authorize with your PIN.');
            break;
          case 'PAYSTACK_TRANSFER_UNAVAILABLE':
            Alert.alert('Service Unavailable', 'Transfers are temporarily unavailable. Please try again shortly.');
            break;
          case 'DAILY_LIMIT_EXCEEDED': {
            const availableToday = typeof error.details?.available_today === 'number'
              ? formatCurrency(error.details.available_today as number)
              : 'KES 0.00';
            Alert.alert('Daily Limit Reached', `You can only send ${availableToday} more today.`);
            break;
          }
          case 'SELF_TRANSFER_NOT_ALLOWED':
            Alert.alert('Invalid Recipient', 'You cannot transfer money to yourself.');
            break;
          default:
            Alert.alert('Transfer Failed', error.message || 'Unable to process transfer. Please try again.');
            break;
        }
      } else {
        Alert.alert('Transfer Failed', 'Unable to process transfer. Please try again.');
      }
      console.error('Transfer error:', error);
    } finally {
      // Only consume PIN for wallet/savings transfers (external transfers consume PIN on backend)
      if (paymentMethod === 'wallet' || paymentMethod === 'savings') {
        consumePinToken();
      }
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const getPaymentMethodLabel = (method: 'wallet' | 'savings' | 'mpesa' | 'card') => {
    switch (method) {
      case 'wallet':
        return 'Main Wallet';
      case 'savings':
        return 'Savings Account';
      case 'mpesa':
        return 'M-Pesa';
      case 'card':
        return 'Debit Card';
      default:
        return 'Main Wallet';
    }
  };

  const getPaymentMethodIcon = (method: 'wallet' | 'savings' | 'mpesa' | 'card') => {
    switch (method) {
      case 'wallet':
        return 'account-balance-wallet';
      case 'savings':
        return 'savings';
      case 'mpesa':
        return 'phone-android';
      case 'card':
        return 'credit-card';
      default:
        return 'account-balance-wallet';
    }
  };

  return (
    <>
      <StatusBar barStyle={themeColors.colors.statusBarStyle} backgroundColor={themeColors.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color={themeColors.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transfer</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Payment Method Selector (Combined From + Method) */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Payment Method</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => setShowPaymentMethodModal(true)}
              >
                <View style={styles.accountIconContainer}>
                  <Icon name={getPaymentMethodIcon(paymentMethod)} size={24} color={themeColors.colors.primary} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{getPaymentMethodLabel(paymentMethod)}</Text>
                  <Text style={styles.accountBalance}>
                    {(paymentMethod === 'wallet' || paymentMethod === 'savings')
                      ? `Available: ${formatCurrency(availableBalance)}`
                      : fee > 0 ? `Fee: ${formatCurrency(fee)}` : 'No fees'}
                  </Text>
                </View>
                <Icon name="unfold-more" size={28} color={themeColors.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Phone Number Input (Primary field) */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recipient Phone Number</Text>
              <View style={styles.phoneInputWrapper}>
                <Text style={styles.countryCode}>+254</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={recipientPhone.startsWith('254') ? recipientPhone.slice(3) : recipientPhone}
                  onChangeText={(text) => handlePhoneChange('254' + text)}
                  placeholder="712 345 678"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={9}
                />
                {isValidatingRecipient && (
                  <ActivityIndicator size="small" color={themeColors.colors.primary} style={styles.validationIndicator} />
                )}
                {!isValidatingRecipient && recipientUser?.exists && (
                  <Icon name="check-circle" size={24} color={themeColors.colors.accent} style={styles.validationIndicator} />
                )}
              </View>
              {recipientUser?.exists && recipientName && (
                <View style={styles.recipientInfoBanner}>
                  <Icon name="person" size={20} color={themeColors.colors.accent} />
                  <Text style={styles.recipientInfoText}>{recipientName}</Text>
                </View>
              )}
            </View>

            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>KES</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={15}
                />
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.referenceInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a note"
                placeholderTextColor={themeColors.colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Transfer Preview */}
            {amountCents > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Transfer Summary</Text>

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Transfer Amount</Text>
                  <Text style={styles.previewValue}>{formatCurrency(amountCents)}</Text>
                </View>

                {fee > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Transaction Fee</Text>
                    <Text style={styles.previewValue}>{formatCurrency(fee)}</Text>
                  </View>
                )}

                {roundUpAmount > 0 && roundUpRule?.is_enabled && (
                  <View style={styles.previewRow}>
                    <View style={styles.previewLabelWithIcon}>
                      <Text style={styles.previewLabel}>Round-up to Savings</Text>
                      <Icon name="info-outline" size={16} color={themeColors.colors.textSecondary} />
                    </View>
                    <Text style={styles.previewValueAccent}>
                      +{formatCurrency(roundUpAmount)}
                    </Text>
                  </View>
                )}

                {roundUpRule?.is_enabled && roundUpCalculation && (
                  <View style={styles.roundUpInfoBanner}>
                    <Icon name="savings" size={16} color={themeColors.colors.accent} />
                    <Text style={styles.roundUpInfoText}>
                      {getRoundUpDescription(roundUpRule)}
                    </Text>
                  </View>
                )}

                <View style={styles.previewDivider} />

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabelBold}>Total Charge</Text>
                  <Text style={styles.previewValueBold}>
                    {formatCurrency(totalWithRoundUp)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.spacer} />
          </ScrollView>

          {/* Send Button */}
          <View style={styles.sendButtonSection}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!amount || !recipientUser?.exists || getNumericAmount() <= 0 || isLoading || isValidatingRecipient) && styles.sendButtonDisabled
              ]}
              onPress={handleSendTransfer}
              disabled={!amount || !recipientUser?.exists || getNumericAmount() <= 0 || isLoading || isValidatingRecipient}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? 'Sending...' : 'Send Funds'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Payment Method Selector Modal */}
        <Modal
          visible={showPaymentMethodModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPaymentMethodModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Method</Text>
                <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)}>
                  <Icon name="close" size={24} color={themeColors.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalList}>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setPaymentMethod('wallet');
                    setShowPaymentMethodModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="account-balance-wallet" size={24} color={themeColors.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Main Wallet</Text>
                    <Text style={styles.accountBalance}>Free, instant transfer</Text>
                  </View>
                  {paymentMethod === 'wallet' && (
                    <Icon name="check" size={20} color={themeColors.colors.accent} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setPaymentMethod('savings');
                    setShowPaymentMethodModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="savings" size={24} color={themeColors.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Savings Account</Text>
                    <Text style={styles.accountBalance}>Free, instant transfer</Text>
                  </View>
                  {paymentMethod === 'savings' && (
                    <Icon name="check" size={20} color={themeColors.colors.accent} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setPaymentMethod('mpesa');
                    setShowPaymentMethodModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="phone-android" size={24} color={themeColors.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>M-Pesa</Text>
                    <Text style={styles.accountBalance}>Fee: {formatCurrency(1000)}</Text>
                  </View>
                  {paymentMethod === 'mpesa' && (
                    <Icon name="check" size={20} color={themeColors.colors.accent} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setPaymentMethod('card');
                    setShowPaymentMethodModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="credit-card" size={24} color={themeColors.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Debit Card</Text>
                    <Text style={styles.accountBalance}>Fee: {formatCurrency(1000)}</Text>
                  </View>
                  {paymentMethod === 'card' && (
                    <Icon name="check" size={20} color={themeColors.colors.accent} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
      <PinVerificationModal
        visible={pinModalVisible}
        title="Authorize Transfer"
        subtitle="Enter your PIN to send money"
        onSuccess={handlePinModalSuccess}
        onCancel={handlePinModalCancel}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.colors.surface,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    backgroundColor: themeColors.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.colors.border,
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
  headerSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    backgroundColor: themeColors.colors.surface,
  },
  section: {
    marginBottom: theme.spacing.base,
  },
  sectionLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  accountSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    padding: theme.spacing.base,
    gap: theme.spacing.base,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: `${theme.colors.primary}1A`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  accountBalance: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  recipientInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    height: 56,
  },
  recipientInput: {
    flex: 1,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.base,
  },
  validationIndicator: {
    paddingHorizontal: theme.spacing.base,
  },
  recipientInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.accent}15`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  recipientInfoText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.accent,
    flex: 1,
  },
  contactIconButton: {
    paddingHorizontal: theme.spacing.base,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    height: 56,
    paddingHorizontal: theme.spacing.base,
  },
  countryCode: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.sm,
  },
  phoneInput: {
    flex: 1,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    height: 56,
    paddingHorizontal: theme.spacing.base,
  },
  currencySymbol: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textTertiary,
    marginRight: theme.spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  referenceInput: { backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    minHeight: 112,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
  },
  spacer: {
    height: theme.spacing['3xl'],
  },
  sendButtonSection: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    backgroundColor: themeColors.colors.surface,
  },
  sendButton: {
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: themeColors.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  sendButtonDisabled: { backgroundColor: themeColors.colors.disabled,
    ...theme.shadows.sm,
  },
  sendButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: { backgroundColor: themeColors.colors.surface,
    borderTopLeftRadius: theme.borderRadius['2xl'],
    borderTopRightRadius: theme.borderRadius['2xl'],
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['2xl'],
    maxHeight: '50%',
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
    paddingHorizontal: theme.spacing.base,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    gap: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.colors.divider,
  },
  previewCard: { backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
  },
  previewTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  previewLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  previewLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  previewValue: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
  },
  previewValueAccent: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.accent,
  },
  previewLabelBold: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  previewValueBold: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  previewDivider: {
    height: 1,
    backgroundColor: themeColors.colors.border,
    marginVertical: theme.spacing.md,
  },
  roundUpInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: `${theme.colors.accent}10`,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  roundUpInfoText: {
    flex: 1,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
});

export default TransferScreen;
