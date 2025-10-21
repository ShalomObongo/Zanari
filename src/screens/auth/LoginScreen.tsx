import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const navigation = useNavigation<any>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const sendLoginOtp = useAuthStore((state) => state.sendLoginOtp);
  const isLoggingIn = useAuthStore((state) => state.isLoggingIn);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Format for Kenyan numbers
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return '254' + cleaned;
    }
    
    return cleaned;
  };

  const isValidKenyanNumber = (number: string) => {
    // Kenyan mobile numbers: 254 followed by 7XX, 1XX patterns
    const kenyanRegex = /^254(7[0-9]{8}|1[0-9]{8})$/;
    return kenyanRegex.test(number);
  };

  const handlePhoneNumberChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    if (formatted.length <= 12) { // Max length for 254XXXXXXXXX
      setPhoneNumber(formatted);
    }
  };

  const displayPhoneNumber = (number: string) => {
    if (number.startsWith('254') && number.length > 3) {
      return `+${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`;
    }
    return number;
  };

  const handleContinue = async () => {
    if (!phoneNumber || phoneNumber.length < 12) {
      Alert.alert('Invalid Number', 'Please enter a valid Kenyan mobile number');
      return;
    }

    if (!isValidKenyanNumber(phoneNumber)) {
      Alert.alert('Invalid Number', 'Please enter a valid Kenyan mobile number (07XX XXX XXX)');
      return;
    }

    try {
      await sendLoginOtp({ phone: phoneNumber });
      navigation.navigate('OTP', { phoneNumber });
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : (error as Error).message ?? 'Unable to send OTP. Please try again.';
      Alert.alert('Error', message);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleSignup = () => {
    navigation.navigate('Signup');
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
          </View>

          <View style={styles.content}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Enter your phone number to receive a verification code
              </Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.countryCode}>🇰🇪 +254</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber.startsWith('254') ? phoneNumber.slice(3) : phoneNumber}
                    onChangeText={(text) => handlePhoneNumberChange('254' + text)}
                    placeholder="7XX XXX XXX"
                    placeholderTextColor="#95D5B2"
                    keyboardType="phone-pad"
                    maxLength={9}
                    autoFocus={true}
                  />
                </View>
                <Text style={styles.inputHint}>
                  We'll send a 6-digit code to verify your number
                </Text>
              </View>

              {/* Continue Button */}
              <TouchableOpacity 
                style={[
                  styles.continueButton, 
                  (!phoneNumber || phoneNumber.length < 12 || isLoggingIn) && styles.continueButtonDisabled
                ]}
                onPress={handleContinue}
                disabled={!phoneNumber || phoneNumber.length < 12 || isLoggingIn}
              >
                <Text style={[
                  styles.continueButtonText,
                  (!phoneNumber || phoneNumber.length < 12 || isLoggingIn) && styles.continueButtonTextDisabled
                ]}>
                  {isLoggingIn ? 'Sending...' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              
              <TouchableOpacity style={styles.signupPrompt} onPress={handleSignup}>
                <Text style={styles.signupText}>
                  New to Zanari? <Text style={styles.signupLink}>Create an account</Text>
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 8,
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  titleSection: {
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: '#B7E4C7',
    lineHeight: 24,
    fontFamily: 'System',
  },
  formSection: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 12,
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
    height: 56,
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
  inputHint: {
    fontSize: 12,
    color: '#95D5B2',
    marginTop: 8,
    fontFamily: 'System',
  },
  continueButton: {
    backgroundColor: '#52B788',
    paddingVertical: 16,
    paddingHorizontal: 32,
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
  continueButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  continueButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footer: {
    paddingBottom: 32,
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#95D5B2',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'System',
  },
  footerLink: {
    color: '#B7E4C7',
    fontWeight: '500',
  },
  signupPrompt: {
    marginTop: 16,
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  signupLink: {
    color: '#52B788',
    fontWeight: '600',
  },
});

export default LoginScreen;