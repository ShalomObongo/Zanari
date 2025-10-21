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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const register = useAuthStore((state) => state.register);
  const isRegistering = useAuthStore((state) => state.isRegistering);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');

    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    if (cleaned.startsWith('0')) {
      return `254${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      return `254${cleaned}`;
    }
    return cleaned;
  };

  const isValidKenyanNumber = (value: string) => /^254(7[0-9]{8}|1[0-9]{8})$/.test(value);

  const displayPhoneNumber = (value: string) => {
    if (value.startsWith('254') && value.length > 3) {
      return `+${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6, 9)} ${value.slice(9)}`;
    }
    return value;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    if (formatted.length <= 12) {
      setPhoneNumber(formatted);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const handleRegister = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = formatPhoneNumber(phoneNumber);

    if (!trimmedFirst || trimmedFirst.length < 2) {
      Alert.alert('Missing Details', 'Please enter your first name.');
      return;
    }

    if (!trimmedLast || trimmedLast.length < 2) {
      Alert.alert('Missing Details', 'Please enter your last name.');
      return;
    }

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!isValidKenyanNumber(normalizedPhone)) {
      Alert.alert('Invalid Number', 'Enter a valid Kenyan mobile number (07XX XXX XXX).');
      return;
    }

    try {
      await register({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: normalizedEmail,
        phone: normalizedPhone,
      });

      navigation.navigate('OTP', { phoneNumber: normalizedPhone });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error as Error).message ?? 'Unable to create account. Please try again.';
      Alert.alert('Could not complete signup', message);
    }
  };

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    EMAIL_REGEX.test(email.trim().toLowerCase()) &&
    isValidKenyanNumber(phoneNumber);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Create your Zanari account</Text>
              <Text style={styles.subtitle}>
                Start building smart savings and seamless payments in just a few steps.
              </Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroupRow}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>First name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Sarah"
                    placeholderTextColor="#95D5B2"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Last name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Mutindi"
                    placeholderTextColor="#95D5B2"
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email address</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#95D5B2"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mobile number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.countryCode}>🇰🇪 +254</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber.startsWith('254') ? phoneNumber.slice(3) : phoneNumber}
                    onChangeText={(value) => handlePhoneChange(`254${value}`)}
                    placeholder="7XX XXX XXX"
                    placeholderTextColor="#95D5B2"
                    keyboardType="phone-pad"
                    maxLength={9}
                    returnKeyType="done"
                  />
                </View>
                <Text style={styles.inputHint}>We\'ll send a secure 6-digit code to verify this number.</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (!canSubmit || isRegistering) && styles.primaryButtonDisabled]}
                onPress={handleRegister}
                disabled={!canSubmit || isRegistering}
              >
                <Text style={[styles.primaryButtonText, (!canSubmit || isRegistering) && styles.primaryButtonTextDisabled]}>
                  {isRegistering ? 'Creating account...' : 'Create account'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                By continuing, you agree to Zanari&apos;s{' '}
                <Text style={styles.footerLink}>Terms of Service</Text> and{' '}
                <Text style={styles.footerLink}>Privacy Policy</Text>.
              </Text>
              <TouchableOpacity style={styles.signInPrompt} onPress={handleSignIn}>
                <Text style={styles.signInText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 32,
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
    backgroundColor: 'rgba(183, 228, 199, 0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.2)',
  },
  inputGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
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
  textInput: {
    backgroundColor: 'rgba(27, 67, 50, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'System',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 67, 50, 0.6)',
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
    marginTop: 6,
    fontFamily: 'System',
  },
  primaryButton: {
    backgroundColor: '#52B788',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.35)',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  primaryButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  footer: {
    alignItems: 'center',
    gap: 12,
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
  signInPrompt: {
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 14,
    color: '#B7E4C7',
    fontWeight: '500',
    fontFamily: 'System',
  },
});

export default SignupScreen;
