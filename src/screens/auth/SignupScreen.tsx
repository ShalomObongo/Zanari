import { useState, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';
import { useTheme } from '@/theme';
import theme from '@/theme';
import { formatPhoneNumber, formatPhoneForDisplay, isValidKenyanNumber } from '@/utils/phoneFormatting';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const themeColors = useTheme();
  const register = useAuthStore((state) => state.register);
  const isRegistering = useAuthStore((state) => state.isRegistering);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailError, setEmailError] = useState('');
  
  // Focus states for inputs
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // Validation states
  const [firstNameValid, setFirstNameValid] = useState(false);
  const [lastNameValid, setLastNameValid] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);
  
  // Refs for auto-focus
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  // Format phone display value directly; memoization is unnecessary for this simple operation
  const displayPhoneNumber = phoneNumber ? formatPhoneForDisplay(phoneNumber) : phoneNumber;

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    setFirstNameValid(value.trim().length >= 2);
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    setLastNameValid(value.trim().length >= 2);
  };

  const handlePhoneChange = (value: string) => {
    // Store the user input (which may contain spaces) for display formatting
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10 || (cleaned.startsWith('254') && cleaned.length <= 12)) {
      setPhoneNumber(value);
      // Validate using the formatted version
      const formatted = formatPhoneNumber(value);
      setPhoneValid(isValidKenyanNumber(formatted));
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const valid = EMAIL_REGEX.test(value.trim());
    setEmailValid(valid);
    if (emailError && valid) {
      setEmailError('');
    }
  };

  const handleEmailBlur = () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      setEmailValid(false);
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
      setEmailError('Please enter a valid email address');
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!normalizedPhone) {
      Alert.alert('Missing Details', 'Please enter your phone number.');
      return;
    }

    if (!isValidKenyanNumber(normalizedPhone)) {
      Alert.alert('Invalid Number', 'Enter a valid Kenyan mobile number (07XX XXX XXX).');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    try {
      await register({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: normalizedEmail,
        phone: normalizedPhone,
      });

      navigation.navigate('OTP', { method: 'phone', identifier: normalizedPhone });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error as Error).message ?? 'Unable to create account. Please try again.';
      Alert.alert('Could not complete signup', message);
    }
  };

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    EMAIL_REGEX.test(email.trim().toLowerCase()) &&
    isValidKenyanNumber(formatPhoneNumber(phoneNumber)) &&
    acceptedTerms;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.backgroundLight} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Create Your Zanari Account</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* First Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>First Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[
                      styles.textInput,
                      focusedField === 'firstName' && styles.textInputFocused,
                      firstNameValid && styles.textInputValid,
                    ]}
                    value={firstName}
                    onChangeText={handleFirstNameChange}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your first name"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                  {firstName.trim().length > 0 && firstNameValid && (
                    <Icon name="check-circle" size={20} color={theme.colors.success} style={styles.inputIcon} />
                  )}
                </View>
                {!firstName.trim() && (
                  <Text style={styles.helperText}>At least 2 characters</Text>
                )}
              </View>

              {/* Last Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={lastNameRef}
                    style={[
                      styles.textInput,
                      focusedField === 'lastName' && styles.textInputFocused,
                      lastNameValid && styles.textInputValid,
                    ]}
                    value={lastName}
                    onChangeText={handleLastNameChange}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your last name"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  {lastName.trim().length > 0 && lastNameValid && (
                    <Icon name="check-circle" size={20} color={theme.colors.success} style={styles.inputIcon} />
                  )}
                </View>
                {!lastName.trim() && (
                  <Text style={styles.helperText}>At least 2 characters</Text>
                )}
              </View>

              {/* Email Address with error state */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={emailRef}
                    style={[
                      styles.textInput,
                      focusedField === 'email' && styles.textInputFocused,
                      emailError && styles.textInputError,
                      emailValid && !emailError && styles.textInputValid,
                    ]}
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => {
                      setFocusedField(null);
                      handleEmailBlur();
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => phoneRef.current?.focus()}
                  />
                  {email.trim().length > 0 && (
                    <>
                      {emailValid && !emailError && (
                        <Icon name="check-circle" size={20} color={theme.colors.success} style={styles.inputIcon} />
                      )}
                      {emailError && (
                        <Icon name="error" size={20} color={theme.colors.error} style={styles.inputIcon} />
                      )}
                    </>
                  )}
                </View>
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : !email.trim() ? (
                  <Text style={styles.helperText}>We'll send you a verification code</Text>
                ) : null}
              </View>

              {/* Phone Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={phoneRef}
                    style={[
                      styles.textInput,
                      focusedField === 'phone' && styles.textInputFocused,
                      phoneValid && styles.textInputValid,
                    ]}
                    value={displayPhoneNumber}
                    onChangeText={handlePhoneChange}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="0712 345 678"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                  {phoneNumber.trim().length > 0 && phoneValid && (
                    <Icon name="check-circle" size={20} color={theme.colors.success} style={styles.inputIcon} />
                  )}
                </View>
                {!phoneNumber.trim() && (
                  <Text style={styles.helperText}>Enter your Kenyan mobile number</Text>
                )}
              </View>

              {/* Terms & Conditions */}
              <TouchableOpacity
                testID="signup-terms-toggle"
                style={styles.checkboxContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Icon name="check" size={16} color={theme.colors.surface} />}
                </View>
                <Text style={styles.checkboxText}>
                  By creating an account, you agree to our{' '}
                  <Text style={styles.linkText}>Terms of Service</Text> and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text>.
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer with button */}
          <View style={styles.footer}>
            <TouchableOpacity
              testID="signup-submit-button"
              style={[styles.primaryButton, (!canSubmit || isRegistering) && styles.primaryButtonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit || isRegistering}
              activeOpacity={0.8}
            >
              {isRegistering ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.colors.onPrimaryText} style={styles.spinner} />
                  <Text style={styles.primaryButtonText}>Creating account...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSignIn} style={styles.signInPrompt}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
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
    backgroundColor: theme.colors.backgroundLight,
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
    borderBottomWidth: 0,
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
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 48,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
  },
  titleSection: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSizes['4xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  formSection: {
    gap: theme.spacing.base,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    height: 56,
    paddingRight: 48,
  },
  textInputFocused: {
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  textInputError: {
    borderColor: theme.colors.error,
  },
  textInputValid: {
    borderColor: theme.colors.success,
  },
  inputIcon: {
    position: 'absolute',
    right: theme.spacing.base,
    top: 18,
  },
  helperText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.error,
    marginTop: 6,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  linkText: {
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.primary,
  },
  footer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundLight,
    borderTopWidth: 0,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
    ...theme.shadows.md,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.gray300,
  },
  primaryButtonText: {
    color: theme.colors.onPrimaryText,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  spinner: {
    marginRight: theme.spacing.sm,
  },
  signInPrompt: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  signInText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  signInLink: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
});

export default SignupScreen;
