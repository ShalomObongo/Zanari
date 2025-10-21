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
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/utils/formatters';
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
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { mode = 'payment' } = (route.params as RouteParams) || {};
  const { popup } = usePaystack();
  
  // Stores
  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const user = useAuthStore((state) => state.user);
  
  // Get main wallet balance
  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const availableBalance = mainWallet?.available_balance ?? 0;
  
  const [amount, setAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [merchantCode, setMerchantCode] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [paystackData, setPaystackData] = useState<{
    accessCode: string;
    reference: string;
    email: string;
  } | null>(null);
  
  // Fetch wallets on mount to get current balance
  useEffect(() => {
    refreshWallets();
  }, []);

  const paymentOptions: PaymentOption[] = [
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: '📱',
      description: 'Pay via M-Pesa mobile money'
    },
    {
      id: 'airtel',
      name: 'Airtel Money',
      icon: '💰',
      description: 'Pay via Airtel Money'
    },
    {
      id: 'card',
      name: 'Debit Card',
      icon: '💳',
      description: 'Pay with your debit card'
    },
    {
      id: 'wallet',
      name: 'Wallet Balance',
      icon: '👛',
      description: 'Pay from your Zanari wallet'
    }
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
        });
      } else {
        // Merchant payment: Deduct from wallet and pay merchant
        const merchantInfo: any = {};
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
          pin_token: 'txn_' + Date.now(), // In production, get from PIN verification screen
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
              selectedPaymentMethod === option.id && styles.paymentMethodSelected
            ]}
            onPress={() => handlePaymentMethodSelect(option.id)}
          >
            <View style={styles.paymentMethodIcon}>
              <Text style={styles.paymentMethodIconText}>{option.icon}</Text>
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
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>←</Text>
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
                  placeholderTextColor="#95D5B2"
                  keyboardType="numeric"
                  maxLength={15}
                  autoFocus={true}
                />
              </View>
              <Text style={styles.amountHint}>
                {mode === 'topup' 
                  ? 'Enter amount to add to your wallet (KES 10 - KES 500,000)'
                  : 'Enter amount between KES 10 - KES 500,000'
                }
              </Text>
            </View>

            {/* Merchant/Description Section */}
            {mode === 'payment' ? (
              <View style={styles.merchantSection}>
                <View style={styles.merchantHeader}>
                  <Text style={styles.sectionTitle}>Merchant Details</Text>
                  <TouchableOpacity style={styles.qrButton} onPress={handleScanQR}>
                    <Text style={styles.qrButtonText}>📷 Scan QR</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.merchantInput}
                  value={merchantCode}
                  onChangeText={setMerchantCode}
                  placeholder="Enter till number (e.g., 123456)"
                  placeholderTextColor="#95D5B2"
                  autoCapitalize="none"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Payment description (optional)"
                  placeholderTextColor="#95D5B2"
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
                  placeholderTextColor="#95D5B2"
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
                <Text style={styles.roundUpTitle}>Auto Round-up</Text>
                <Text style={styles.roundUpBadge}>NEW</Text>
              </View>
              <Text style={styles.roundUpDescription}>
                Round up this payment and save the spare change
              </Text>
              <View style={styles.roundUpExample}>
                <Text style={styles.roundUpExampleText}>
                  Example: Pay KES {getNumericAmount() || 1250}, 
                  save KES {getNumericAmount() ? (Math.ceil(getNumericAmount() / 100) * 100 - getNumericAmount()).toFixed(2) : '0.00'} 
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Pay Button */}
          <View style={styles.payButtonSection}>
            <TouchableOpacity 
              style={[
                styles.payButton, 
                (!amount || !selectedPaymentMethod || getNumericAmount() <= 0 || isLoading) && styles.payButtonDisabled
              ]}
              onPress={handleProceedToPay}
              disabled={!amount || !selectedPaymentMethod || getNumericAmount() <= 0 || isLoading}
            >
              <Text style={[
                styles.payButtonText,
                (!amount || !selectedPaymentMethod || getNumericAmount() <= 0 || isLoading) && styles.payButtonTextDisabled
              ]}>
                {isLoading ? 'Processing...' : 
                 mode === 'topup' ? `Add KES ${amount || '0'} to Wallet` : `Pay KES ${amount || '0'}`}
              </Text>
            </TouchableOpacity>
            {mode === 'topup' && (
              <Text style={styles.topupHint}>
                💡 You'll pay with {selectedPaymentMethod === 'mpesa' ? 'M-Pesa' : selectedPaymentMethod === 'card' ? 'your card' : 'selected method'} to add money to your wallet
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B4332',
  },
  keyboardContainer: {
    flex: 1,
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
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    fontFamily: 'System',
  },
  amountSection: {
    marginBottom: 32,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  availableBalanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 12,
    fontFamily: 'System',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'System',
  },
  amountHint: {
    fontSize: 12,
    color: '#95D5B2',
    marginTop: 8,
    fontFamily: 'System',
  },
  merchantSection: {
    marginBottom: 32,
  },
  merchantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#52B788',
    borderRadius: 8,
  },
  qrButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'System',
  },
  merchantInput: {
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
    fontFamily: 'System',
  },
  descriptionInput: {
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'System',
    textAlignVertical: 'top',
  },
  topupSection: {
    marginBottom: 32,
  },
  paymentMethodsContainer: {
    marginBottom: 32,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
  },
  paymentMethodSelected: {
    borderColor: '#52B788',
    backgroundColor: 'rgba(82, 183, 136, 0.2)',
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentMethodIconText: {
    fontSize: 20,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'System',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#52B788',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#52B788',
  },
  roundUpSection: {
    backgroundColor: 'rgba(82, 183, 136, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  roundUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundUpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'System',
  },
  roundUpBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1B4332',
    backgroundColor: '#52B788',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    fontFamily: 'System',
  },
  roundUpDescription: {
    fontSize: 14,
    color: '#B7E4C7',
    marginBottom: 8,
    fontFamily: 'System',
  },
  roundUpExample: {
    backgroundColor: 'rgba(27, 67, 50, 0.3)',
    padding: 8,
    borderRadius: 6,
  },
  roundUpExampleText: {
    fontSize: 12,
    color: '#95D5B2',
    fontFamily: 'System',
  },
  payButtonSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  payButton: {
    backgroundColor: '#52B788',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  payButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
    elevation: 0,
    shadowOpacity: 0,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  payButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  topupHint: {
    fontSize: 13,
    color: '#B7E4C7',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'System',
    lineHeight: 18,
  },
});

export default PaymentScreen;