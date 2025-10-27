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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PinVerificationModal from '@/components/PinVerificationModal';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';
import api, { ApiError } from '@/services/api';
import theme from '@/theme';

interface TransferScreenProps {}

const TransferScreen: React.FC<TransferScreenProps> = () => {
  const navigation = useNavigation<any>();

  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContactPhone, setSelectedContactPhone] = useState('');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<'main' | 'savings'>('main');
  const pinRequestRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  // Zustand stores
  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const transactions = useTransactionStore((state) => state.transactions);
  const refreshTransactions = useTransactionStore((state) => state.refreshTransactions);
  const isPinSet = useAuthStore((state) => state.isPinSet);
  const consumePinToken = useAuthStore((state) => state.consumePinToken);

  const selectedWallet = wallets.find(w => w.wallet_type === selectedAccountType);
  const availableBalance = selectedWallet?.available_balance ?? 0;

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
  }, []);

  const handleSendTransfer = async () => {
    const amountCents = parseCentsFromInput(amount.replace(/,/g, ''));
    
    if (amountCents <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    // Check available balance
    if (amountCents > availableBalance) {
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

    if (!recipientName.trim()) {
      Alert.alert('Recipient Name Required', 'Please enter the recipient\'s name');
      return;
    }

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
      const trimmedName = recipientName.trim();
      const trimmedMessage = message.trim();

      const response = await api.post('/payments/transfer', {
        amount: amountCents,
        pin_token: pinToken,
        recipient: {
          phone: recipientPhone,
          name: trimmedName,
        },
        description: trimmedMessage || undefined,
      });

      const payload = (response as Record<string, unknown>) ?? {};
      const status = typeof payload.status === 'string' ? payload.status : 'pending';
      const roundUpAmount = typeof payload.round_up_amount === 'number' ? payload.round_up_amount : 0;
      const transferId = typeof payload.transfer_transaction_id === 'string'
        ? payload.transfer_transaction_id
        : undefined;

      await Promise.all([refreshWallets(), refreshTransactions()]);

      setAmount('');
      setRecipientPhone('');
      setRecipientName('');
      setMessage('');
      setSelectedContactPhone('');

      const friendlyAmount = formatCurrency(amountCents);
      const successTitle = status === 'pending' ? 'Transfer Processing' : 'Transfer Sent';
      const successFragments = [`We've initiated your transfer of ${friendlyAmount} to ${trimmedName}.`];

      if (roundUpAmount > 0) {
        successFragments.push(`An extra ${formatCurrency(roundUpAmount)} was moved to your savings.`);
      }

      const successMessage = successFragments.join(' ');

      Alert.alert(
        successTitle,
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

      if (transferId) {
        console.log('Transfer initiated with transaction id:', transferId);
      }
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
      consumePinToken();
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const getAccountLabel = (type: 'main' | 'savings') => {
    return type === 'main' ? 'Main Wallet' : 'Savings Account';
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transfer</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* From Account Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>From</Text>
              <TouchableOpacity
                style={styles.accountSelector}
                onPress={() => setShowAccountModal(true)}
              >
                <View style={styles.accountIconContainer}>
                  <Icon name="account-balance" size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{getAccountLabel(selectedAccountType)}</Text>
                  <Text style={styles.accountBalance}>
                    Available Balance: {formatCurrency(availableBalance)}
                  </Text>
                </View>
                <Icon name="unfold-more" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Recipient Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>To</Text>
              <View style={styles.recipientInputContainer}>
                <TextInput
                  style={styles.recipientInput}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Name, phone, or account"
                  placeholderTextColor={theme.colors.textTertiary}
                />
                <TouchableOpacity style={styles.contactIconButton}>
                  <Icon name="contacts" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Phone Number</Text>
              <View style={styles.phoneInputWrapper}>
                <Text style={styles.countryCode}>+254</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={recipientPhone.startsWith('254') ? recipientPhone.slice(3) : recipientPhone}
                  onChangeText={(text) => handlePhoneChange('254' + text)}
                  placeholder="712 345 678"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={9}
                />
              </View>
            </View>

            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={15}
                />
              </View>
            </View>

            {/* Reference Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Reference (Optional)</Text>
              <TextInput
                style={styles.referenceInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a note for the recipient"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.spacer} />
          </ScrollView>

          {/* Send Button */}
          <View style={styles.sendButtonSection}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!amount || !recipientPhone || !recipientName || getNumericAmount() <= 0 || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleSendTransfer}
              disabled={!amount || !recipientPhone || !recipientName || getNumericAmount() <= 0 || isLoading}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? 'Sending...' : 'Send Funds'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Account Selector Modal */}
        <Modal
          visible={showAccountModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAccountModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Account</Text>
                <TouchableOpacity onPress={() => setShowAccountModal(false)}>
                  <Icon name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalList}>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setSelectedAccountType('main');
                    setShowAccountModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="account-balance-wallet" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Main Wallet</Text>
                    <Text style={styles.accountBalance}>
                      {formatCurrency(wallets.find(w => w.wallet_type === 'main')?.available_balance ?? 0)}
                    </Text>
                  </View>
                  {selectedAccountType === 'main' && (
                    <Icon name="check" size={20} color={theme.colors.accent} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.accountOption}
                  onPress={() => {
                    setSelectedAccountType('savings');
                    setShowAccountModal(false);
                  }}
                >
                  <View style={styles.accountIconContainer}>
                    <Icon name="savings" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>Savings Account</Text>
                    <Text style={styles.accountBalance}>
                      {formatCurrency(wallets.find(w => w.wallet_type === 'savings')?.available_balance ?? 0)}
                    </Text>
                  </View>
                  {selectedAccountType === 'savings' && (
                    <Icon name="check" size={20} color={theme.colors.accent} />
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
    backgroundColor: theme.colors.surface,
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
  headerSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 56,
  },
  recipientInput: {
    flex: 1,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.base,
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
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  referenceInput: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.surface,
  },
  sendButton: {
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.disabled,
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
  modalContent: {
    backgroundColor: theme.colors.surface,
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
    borderBottomColor: theme.colors.divider,
  },
});

export default TransferScreen;