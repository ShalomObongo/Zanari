import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePaystack } from 'react-native-paystack-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PinVerificationModal from '@/components/PinVerificationModal';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/utils/formatters';
import { useTheme } from '@/theme';
import theme from '@/theme';
import api from '../../services/api';

interface PaymentScreenProps {}

interface RouteParams {
  mode?: 'payment' | 'topup';
}

interface PaymentOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const PaymentScreen: React.FC<PaymentScreenProps> = () => {
  const themeColors = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { mode = 'payment' } = (route.params as RouteParams) || {};
  const { popup } = usePaystack();
  
  // Stores
  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const user = useAuthStore((state) => state.user);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const consumePinToken = useAuthStore((state) => state.consumePinToken);
  
  // Get main wallet balance
  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const availableBalance = mainWallet?.available_balance ?? 0;
  
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [merchantCode, setMerchantCode] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const pinRequestRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

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
  
  // Fetch wallets on mount to get current balance
  useEffect(() => {
    refreshWallets();

    return () => {
      if (pinRequestRef.current) {
        pinRequestRef.current.reject(new Error('PIN entry cancelled'));
        pinRequestRef.current = null;
      }
    };
  }, [refreshWallets]);

  const paymentOptions: PaymentOption[] = [
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: 'phone-android',
      description: 'Pay via M-Pesa mobile money',
    },
    {
      id: 'airtel',
      name: 'Airtel Money',
      icon: 'smartphone',
      description: 'Pay via Airtel Money',
    },
    {
      id: 'card',
      name: 'Debit Card',
      icon: 'credit-card',
      description: 'Pay with your debit card',
    },
    {
      id: 'wallet',
      name: 'Wallet Balance',
      icon: 'account-balance-wallet',
      description: 'Pay from your Zanari wallet',
    },
  ];

  const formatAmount = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Convert to number and format
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

  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
  };

  const handleProceedToPay = async () => {
    const numericAmount = getNumericAmount();
    
    if (numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (numericAmount > 500000) {
      Alert.alert('Amount Limit Exceeded', 'Maximum transaction limit is KES 500,000');
      return;
    }

    if (numericAmount < 10) {
      Alert.alert('Minimum Amount', 'Minimum transaction amount is KES 10');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Select Payment Method', 'Please choose a payment method');
      return;
    }

    // Only validate merchant code for payment mode
    if (mode === 'payment' && !merchantCode.trim()) {
      Alert.alert('Merchant Code Required', 'Please enter the merchant code or scan QR code');
      return;
    }

    // Convert to cents for API
    const amountInCents = numericAmount * 100;
    
    // Only check wallet balance for merchant payments (not for top-up)
    // Top-up uses external payment (M-Pesa/Card) to ADD money to wallet
    if (mode === 'payment') {
      // For merchant payments, we need sufficient wallet balance
      if (amountInCents > availableBalance) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${formatCurrency(amountInCents)} but only have ${formatCurrency(availableBalance)} available.\n\nPlease top up your wallet first.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Top Up',
              onPress: () => {
                navigation.replace('Payment', { mode: 'topup' });
              }
            }
          ]
        );
        return;
      }
    }

    if (!isPinSet) {
      Alert.alert(
        'Set up your PIN',
        'You need to create a transaction PIN before authorizing payments.',
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
      let response: any;

      if (mode === 'topup') {
        // Top-up: Use Paystack to receive external payment and credit wallet
        // This is a DEPOSIT transaction - user pays with M-Pesa/Card to add money
        response = await api.post('/payments/topup', {
          amount: amountInCents,
          payment_method: selectedPaymentMethod,
          description: description || 'Wallet top-up',
          pin_token: pinToken,
        });
      } else {
        // Merchant payment: Deduct from wallet and pay merchant
        const merchantInfo: any = { name: 'Merchant payment' };
        const code = merchantCode.trim();

        // Simple validation: if numeric, treat as till_number
        if (/^\d{4,10}$/.test(code)) {
          merchantInfo.till_number = code;
          merchantInfo.name = `Merchant ${code}`; // Auto-generate name from till
        } else {
          Alert.alert(
            'Invalid Merchant Code',
            'Please enter a valid till number (4-10 digits) or paybill number.\n\nExample: 123456'
          );
          return;
        }

        response = await api.post('/payments/merchant', {
          amount: amountInCents,
          pin_token: pinToken,
          merchant_info: merchantInfo,
          description: description || undefined,
        });
      }

      // Extract Paystack data from response
      const responseData = response.data || response;
      const {
        paystack_access_code,
        paystack_reference,
        payment_transaction_id,
      } = responseData;

      if (!paystack_access_code || !paystack_reference) {
        throw new Error('Invalid payment initialization response');
      }

      // Open Paystack checkout for both top-up and merchant payments
      // For top-up: User pays with M-Pesa/Card to credit their wallet
      // For merchant: Wallet is debited, Paystack processes the merchant payment
      popup.newTransaction({
        email: user?.email || 'user@zanari.app',
        amount: numericAmount,
        reference: paystack_reference,
        onSuccess: async (res: any) => {
          console.log('Payment successful:', res);
          
          // Verify payment with backend
          try {
            await api.post('/payments/verify', {
              reference: paystack_reference,
            });

            // Refresh wallet balance after successful payment
            await refreshWallets();

            const successMessage = mode === 'topup'
              ? `KES ${amount} has been added to your wallet successfully`
              : `KES ${amount} has been paid successfully`;

            Alert.alert(
              'Payment Successful',
              successMessage,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    navigation.goBack();
                  }
                }
              ]
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
                }
              ]
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
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      
      // Handle specific error codes
      if (error.response?.status === 402) {
        // Only show insufficient balance for merchant payments, not top-up
        if (mode === 'payment') {
          Alert.alert(
            'Insufficient Balance',
            `You need ${formatCurrency(amountInCents)} but only have ${formatCurrency(availableBalance)} available.\n\nPlease top up your wallet or reduce the amount.`,
            [
              { text: 'Reduce Amount', style: 'cancel' },
              {
                text: 'Top Up Wallet',
                onPress: () => navigation.replace('Payment', { mode: 'topup' })
              }
            ]
          );
        } else {
          Alert.alert(
            'Payment Failed',
            error.response?.data?.message || 'Unable to process top-up. Please try again.'
          );
        }
      } else if (error.response?.status === 400) {
        Alert.alert(
          'Invalid Input',
          error.response?.data?.message || 'Please check your input and try again.'
        );
      } else if (error.response?.status === 404 && mode === 'topup') {
        // Top-up endpoint might not exist yet - show helpful message
        Alert.alert(
          'Feature Coming Soon',
          'Wallet top-up is currently being implemented. For now, you can receive money from transfers or use the demo wallet balance.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        const failureMessage = mode === 'topup'
          ? 'Unable to initialize top-up. Please try again.'
          : 'Unable to initialize payment. Please try again.';
        
        Alert.alert(
          'Payment Failed',
          error.response?.data?.message || failureMessage
        );
      }
    } finally {
      consumePinToken();
      setIsLoading(false);
    }
  };

  const handleScanQR = () => {
    Alert.alert('QR Scanner', 'QR code scanner will be available in a future update.');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderPaymentMethods = () => {
    return (
      <View style={styles.paymentMethodsContainer}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {paymentOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.paymentMethodItem,
              selectedPaymentMethod === option.id && styles.paymentMethodSelected,
            ]}
            onPress={() => handlePaymentMethodSelect(option.id)}
          >
            <View style={styles.paymentMethodIcon}>
              <Icon name={option.icon} size={24} color={themeColors.colors.primary} />
            </View>
            <View style={styles.paymentMethodDetails}>
              <Text style={styles.paymentMethodName}>{option.name}</Text>
              <Text style={styles.paymentMethodDescription}>{option.description}</Text>
            </View>
            <View style={styles.radioButton}>
              {selectedPaymentMethod === option.id && (
                <View style={styles.radioButtonSelected} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
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
            <Text style={styles.headerTitle}>
              {mode === 'topup' ? 'Top Up Wallet' : 'Make Payment'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Amount Section */}
            <View style={styles.amountSection}>
              <View style={styles.balanceHeader}>
                <Text style={styles.sectionTitle}>Amount</Text>
                {mode === 'payment' && (
                  <Text style={styles.availableBalanceText}>
                    Available: {formatCurrency(availableBalance)}
                  </Text>
                )}
              </View>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>KES</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={15}
                  autoFocus={true}
                />
              </View>
              <Text style={styles.amountHint}>
                {mode === 'topup'
                  ? 'Enter amount to add to your wallet (KES 10 - KES 500,000)'
                  : 'Enter amount between KES 10 - KES 500,000'}
              </Text>
            </View>

            {/* Merchant/Description Section */}
            {mode === 'payment' ? (
              <View style={styles.merchantSection}>
                <View style={styles.merchantHeader}>
                  <Text style={styles.sectionTitle}>Merchant Details</Text>
                  <TouchableOpacity style={styles.qrButton} onPress={handleScanQR}>
                    <Icon name="qr-code-scanner" size={16} color={themeColors.colors.surface} />
                    <Text style={styles.qrButtonText}>Scan QR</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.merchantInput}
                  value={merchantCode}
                  onChangeText={setMerchantCode}
                  placeholder="Enter till number (e.g., 123456)"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Payment description (optional)"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  multiline
                  numberOfLines={2}
                />
              </View>
            ) : (
              <View style={styles.topupSection}>
                <Text style={styles.sectionTitle}>Top Up Details</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add note (optional)"
                  placeholderTextColor={themeColors.colors.textTertiary}
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}

            {/* Payment Methods */}
            {renderPaymentMethods()}

            {/* Round-up Option */}
            <View style={styles.roundUpSection}>
              <View style={styles.roundUpHeader}>
                <Icon name="savings" size={20} color={themeColors.colors.accent} />
                <Text style={styles.roundUpTitle}>Auto Round-up</Text>
                <View style={styles.roundUpBadge}>
                  <Text style={styles.roundUpBadgeText}>NEW</Text>
                </View>
              </View>
              <Text style={styles.roundUpDescription}>
                Round up this payment and save the spare change
              </Text>
              <View style={styles.roundUpExample}>
                <Text style={styles.roundUpExampleText}>
                  Example: Pay KES {getNumericAmount() || 1250}, save KES{' '}
                  {getNumericAmount()
                    ? (Math.ceil(getNumericAmount() / 100) * 100 - getNumericAmount()).toFixed(2)
                    : '0.00'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Pay Button */}
          <View style={styles.payButtonSection}>
            <TouchableOpacity
              style={[
                styles.payButton,
                (!amount ||
                  !selectedPaymentMethod ||
                  getNumericAmount() <= 0 ||
                  isLoading) &&
                  styles.payButtonDisabled,
              ]}
              onPress={handleProceedToPay}
              disabled={!amount || !selectedPaymentMethod || getNumericAmount() <= 0 || isLoading}
            >
              <Text
                style={[
                  styles.payButtonText,
                  (!amount ||
                    !selectedPaymentMethod ||
                    getNumericAmount() <= 0 ||
                    isLoading) &&
                    styles.payButtonTextDisabled,
                ]}
              >
                {isLoading
                  ? 'Processing...'
                  : mode === 'topup'
                  ? `Add KES ${amount || '0'} to Wallet`
                  : `Pay KES ${amount || '0'}`}
              </Text>
            </TouchableOpacity>
            {mode === 'topup' && (
              <Text style={styles.topupHint}>
                💡 You'll pay with{' '}
                {selectedPaymentMethod === 'mpesa'
                  ? 'M-Pesa'
                  : selectedPaymentMethod === 'card'
                  ? 'your card'
                  : 'selected method'}{' '}
                to add money to your wallet
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>

        <PinVerificationModal
          visible={pinModalVisible}
          title={mode === 'topup' ? 'Authorize top-up' : 'Authorize payment'}
          subtitle={
            mode === 'topup'
              ? 'Enter your PIN to authorize this wallet top-up'
              : 'Enter your PIN to authorize this payment'
          }
          onSuccess={handlePinModalSuccess}
          onCancel={handlePinModalCancel}
        />
      </SafeAreaView>
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
    borderBottomColor: themeColors.colors.gray100,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  amountSection: {
    marginBottom: theme.spacing.xl,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  availableBalanceText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.accent,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
  },
  currencySymbol: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  amountHint: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  merchantSection: {
    marginBottom: theme.spacing.xl,
  },
  merchantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: themeColors.colors.accent,
    borderRadius: theme.borderRadius.DEFAULT,
  },
  qrButtonText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.surface,
  },
  merchantInput: { backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  descriptionInput: { backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  topupSection: {
    marginBottom: theme.spacing.xl,
  },
  paymentMethodsContainer: {
    marginBottom: theme.spacing.xl,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: themeColors.colors.border,
  },
  paymentMethodSelected: { borderColor: themeColors.colors.accent,
    backgroundColor: `${theme.colors.accent}15`,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.base,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  paymentMethodDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: themeColors.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: themeColors.colors.accent,
  },
  roundUpSection: {
    backgroundColor: `${theme.colors.accent}10`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: `${theme.colors.accent}30`,
  },
  roundUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  roundUpTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  roundUpBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: themeColors.colors.accent,
    borderRadius: theme.borderRadius.sm,
  },
  roundUpBadgeText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  roundUpDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  roundUpExample: { backgroundColor: themeColors.colors.backgroundLight,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.DEFAULT,
  },
  roundUpExampleText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  payButtonSection: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing['2xl'],
    paddingTop: theme.spacing.base,
    backgroundColor: themeColors.colors.surface,
    borderTopWidth: 1,
    borderTopColor: themeColors.colors.gray100,
  },
  payButton: { backgroundColor: themeColors.colors.primary,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    ...theme.shadows.DEFAULT,
  },
  payButtonDisabled: { backgroundColor: themeColors.colors.disabled,
    elevation: 0,
    shadowOpacity: 0,
  },
  payButtonText: { color: themeColors.colors.surface,
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
  },
  payButtonTextDisabled: { color: themeColors.colors.textTertiary,
  },
  topupHint: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
});

export default PaymentScreen;