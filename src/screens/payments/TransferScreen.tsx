import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { formatCurrency, parseCentsFromInput } from '@/utils/formatters';

interface TransferScreenProps {}

const TransferScreen: React.FC<TransferScreenProps> = () => {
  const navigation = useNavigation<any>();
  
  const [amount, setAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContactPhone, setSelectedContactPhone] = useState('');

  // Zustand stores
  const wallets = useWalletStore((state) => state.wallets);
  const refreshWallets = useWalletStore((state) => state.refreshWallets);
  const transactions = useTransactionStore((state) => state.transactions);
  
  const mainWallet = wallets.find(w => w.wallet_type === 'main');
  const availableBalance = mainWallet?.available_balance ?? 0;
  
  // Extract recent contacts from transfer transactions
  const recentContacts = transactions
    .filter(t => t.type === 'transfer_out' && t.recipient_info)
    .map(t => ({
      phone: (t.recipient_info as any)?.phone || '',
      name: (t.recipient_info as any)?.name || 'Contact',
      avatar: ((t.recipient_info as any)?.name || 'U')[0].toUpperCase(),
    }))
    .filter((contact, index, self) => 
      contact.phone && self.findIndex(c => c.phone === contact.phone) === index
    )
    .slice(0, 5);

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

  const handleContactSelect = (contact: typeof recentContacts[0]) => {
    setSelectedContactPhone(contact.phone);
    setRecipientPhone(contact.phone.replace('+', ''));
    setRecipientName(contact.name);
  };

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

    setIsLoading(true);

    try {
      // TODO: Implement actual transfer API call
      // await apiClient.post('/payments/transfer', {
      //   amount: amountCents,
      //   pin_token: pinToken,
      //   recipient: { phone: recipientPhone, name: recipientName }
      // });
      
      Alert.alert(
        'Coming Soon',
        'P2P transfers will be available soon. This feature requires PIN verification and backend API integration.'
      );
      
      // Refresh wallet balance after successful transfer
      await refreshWallets();
    } catch (error) {
      Alert.alert('Transfer Failed', 'Unable to process transfer. Please try again.');
      console.error('Transfer error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderRecentContacts = () => {
    if (recentContacts.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.recentContactsContainer}>
        <Text style={styles.sectionTitle}>Recent Contacts</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.contactsScrollContainer}
        >
          {recentContacts.map((contact, index) => (
            <TouchableOpacity
              key={`${contact.phone}-${index}`}
              style={[
                styles.contactItem,
                selectedContactPhone === contact.phone && styles.contactItemSelected
              ]}
              onPress={() => handleContactSelect(contact)}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{contact.avatar}</Text>
              </View>
              <Text style={styles.contactName}>{contact.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            <Text style={styles.headerTitle}>Send Money</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Amount Section */}
            <View style={styles.amountSection}>
              <View style={styles.balanceRow}>
                <Text style={styles.sectionTitle}>Amount to Send</Text>
                <Text style={styles.availableBalance}>
                  Available: {formatCurrency(availableBalance)}
                </Text>
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
                Daily limit: KES 20,000 • Single limit: KES 5,000
              </Text>
            </View>

            {/* Recent Contacts */}
            {renderRecentContacts()}

            {/* Recipient Section */}
            <View style={styles.recipientSection}>
              <Text style={styles.sectionTitle}>Recipient Details</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.countryCode}>🇰🇪 +254</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={recipientPhone.startsWith('254') ? recipientPhone.slice(3) : recipientPhone}
                    onChangeText={(text) => handlePhoneChange('254' + text)}
                    placeholder="7XX XXX XXX"
                    placeholderTextColor="#95D5B2"
                    keyboardType="phone-pad"
                    maxLength={9}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Recipient Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="Enter recipient's full name"
                  placeholderTextColor="#95D5B2"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Message (Optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Add a personal message"
                  placeholderTextColor="#95D5B2"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            {/* Transfer Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Transfer Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount</Text>
                  <Text style={styles.summaryValue}>KES {amount || '0'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Transfer Fee</Text>
                  <Text style={styles.summaryValue}>KES 0.00</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>KES {amount || '0'}</Text>
                </View>
              </View>
            </View>
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
              <Text style={[
                styles.sendButtonText,
                (!amount || !recipientPhone || !recipientName || getNumericAmount() <= 0 || isLoading) && styles.sendButtonTextDisabled
              ]}>
                {isLoading ? 'Sending...' : `Send KES ${amount || '0'}`}
              </Text>
            </TouchableOpacity>
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
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  availableBalance: {
    fontSize: 14,
    color: '#95D5B2',
    fontFamily: 'System',
  },
  amountSection: {
    marginBottom: 32,
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
  recentContactsContainer: {
    marginBottom: 32,
  },
  contactsScrollContainer: {
    paddingRight: 24,
  },
  contactItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(82, 183, 136, 0.2)',
    borderWidth: 1,
    borderColor: '#52B788',
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactAvatarText: {
    fontSize: 24,
  },
  contactName: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: 'System',
  },
  recipientSection: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'System',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 16,
    height: 50,
  },
  countryCode: {
    fontSize: 16,
    color: '#ffffff',
    marginRight: 12,
    fontFamily: 'System',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'System',
  },
  nameInput: {
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'System',
  },
  messageInput: {
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
    height: 80,
  },
  summarySection: {
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  summaryValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    fontFamily: 'System',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(183, 228, 199, 0.3)',
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  summaryTotalValue: {
    fontSize: 16,
    color: '#52B788',
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  sendButtonSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  sendButton: {
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
  sendButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
    elevation: 0,
    shadowOpacity: 0,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  sendButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default TransferScreen;