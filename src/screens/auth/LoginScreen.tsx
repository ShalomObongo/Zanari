import { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  ScrollView,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPhoneNumber, formatPhoneForDisplay, isValidKenyanNumber } from '@/utils/phoneFormatting';

type AuthMethod = 'email' | 'phone';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Delay before focusing input after method switch (allows component to re-render)
const INPUT_FOCUS_DELAY_MS = 100;

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isValid, setIsValid] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const sendLoginOtp = useAuthStore((state) => state.sendLoginOtp);
  const isLoggingIn = useAuthStore((state) => state.isLoggingIn);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const checkReducedMotion = async () => {
      const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      setReduceMotion(isReduceMotionEnabled);
    };
    checkReducedMotion();
  }, []);

  // Compute phone display format directly; useMemo is unnecessary for lightweight formatting
  const displayValue =
    authMethod === 'phone' && emailOrPhone
      ? formatPhoneForDisplay(emailOrPhone)
      : emailOrPhone;

  const validateInput = (value: string, method: AuthMethod) => {
    if (!value.trim()) {
      setValidationError('');
      setIsValid(false);
      return false;
    }

    if (method === 'email') {
      const valid = EMAIL_REGEX.test(value.trim().toLowerCase());
      setIsValid(valid);
      setValidationError(valid ? '' : 'Invalid email format');
      return valid;
    } else {
      const formatted = formatPhoneNumber(value);
      const valid = isValidKenyanNumber(formatted);
      setIsValid(valid);
      setValidationError(valid ? '' : 'Invalid phone number');
      return valid;
    }
  };

  const handleInputChange = (text: string) => {
    if (authMethod === 'phone') {
      const cleaned = text.replace(/\D/g, '');
      if (cleaned.length <= 10 || (cleaned.startsWith('254') && cleaned.length <= 12)) {
        setEmailOrPhone(text);
        validateInput(text, authMethod);
      }
    } else {
      setEmailOrPhone(text);
      validateInput(text, authMethod);
    }
  };

  const handleMethodChange = (method: AuthMethod) => {
    setAuthMethod(method);
    setEmailOrPhone('');
    setValidationError('');
    setIsValid(false);
    setTimeout(() => inputRef.current?.focus(), INPUT_FOCUS_DELAY_MS);
  };

  const handleContinue = async () => {
    const trimmedValue = emailOrPhone.trim();
    const method = authMethod;

    if (!trimmedValue) {
      Alert.alert('Required', `Please enter your ${method === 'email' ? 'email address' : 'phone number'}`);
      triggerShakeAnimation();
      return;
    }

    let identifier: string;
    let payload: { email?: string; phone?: string };

    if (method === 'email') {
      const normalizedEmail = trimmedValue.toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        triggerShakeAnimation();
        return;
      }

      identifier = normalizedEmail;
      payload = { email: normalizedEmail };
    } else {
      const formattedPhone = formatPhoneNumber(trimmedValue);
      if (!isValidKenyanNumber(formattedPhone)) {
        Alert.alert('Invalid Number', 'Please enter a valid Kenyan mobile number (07XX XXX XXX)');
        triggerShakeAnimation();
        return;
      }

      identifier = formattedPhone;
      payload = { phone: formattedPhone };
    }

    try {
      await sendLoginOtp(payload);
      navigation.navigate('OTP', { method, identifier });
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : (error as Error).message ?? 'Unable to send OTP. Please try again.';
      Alert.alert('Error', message);
      triggerShakeAnimation();
    }
  };

  const triggerShakeAnimation = () => {
    // Skip animation if user has reduced motion enabled
    if (reduceMotion) {
      return;
    }

    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSignup = () => {
    navigation.navigate('Signup');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Back Button */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Logo Header */}
            <View style={styles.logoContainer}>
              <Icon name="account-balance" size={40} color={theme.colors.primary} />
              <Text style={styles.logoText}>Zanari</Text>
            </View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to access your account.</Text>
            </View>

            {/* Auth Method Switcher */}
            <View style={styles.switcherContainer}>
              <TouchableOpacity
                style={[styles.switcherButton, authMethod === 'email' && styles.switcherButtonActive]}
                onPress={() => handleMethodChange('email')}
                activeOpacity={0.7}
              >
                <Text style={[styles.switcherText, authMethod === 'email' && styles.switcherTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switcherButton, authMethod === 'phone' && styles.switcherButtonActive]}
                onPress={() => handleMethodChange('phone')}
                activeOpacity={0.7}
              >
                <Text style={[styles.switcherText, authMethod === 'phone' && styles.switcherTextActive]}>
                  Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Section */}
            <View style={styles.formSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {authMethod === 'email' ? 'Email address' : 'Phone number'}
                </Text>
                <Animated.View 
                  style={[
                    styles.inputWrapper,
                    { transform: [{ translateX: shakeAnimation }] }
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    style={[
                      styles.textInput,
                      isFocused && styles.textInputFocused,
                      validationError && emailOrPhone.trim() && styles.textInputError,
                      isValid && styles.textInputValid,
                    ]}
                    value={displayValue}
                    onChangeText={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={authMethod === 'email' ? 'Enter your email' : '0712 345 678'}
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType={authMethod === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    accessibilityLabel={authMethod === 'email' ? 'Email address input' : 'Phone number input'}
                    accessibilityHint={authMethod === 'email' ? 'Enter your email to receive a verification code' : 'Enter your phone number to receive a verification code'}
                  />
                  {emailOrPhone.trim().length > 0 && (
                    <>
                      {isValid && (
                        <Icon name="check-circle" size={20} color={theme.colors.success} style={styles.inputIcon} />
                      )}
                      {validationError && (
                        <Icon name="error" size={20} color={theme.colors.error} style={styles.inputIcon} />
                      )}
                    </>
                  )}
                </Animated.View>
                {validationError && emailOrPhone.trim() && (
                  <Text style={styles.helperTextError}>{validationError}</Text>
                )}
                {!validationError && !emailOrPhone.trim() && (
                  <Text style={styles.helperText}>
                    {authMethod === 'email' 
                      ? "We'll send you a verification code" 
                      : 'Enter your Kenyan mobile number'}
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer with button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, isLoggingIn && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={isLoggingIn}
              activeOpacity={0.8}
              accessibilityLabel="Continue"
              accessibilityHint="Send verification code"
              accessibilityRole="button"
            >
              {isLoggingIn ? (
                <ActivityIndicator color={theme.colors.onPrimaryText} />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleSignup} 
              style={styles.signupPrompt}
              accessibilityLabel="Create new account"
              accessibilityHint="Navigate to signup screen"
              accessibilityRole="button"
            >
              <Text style={styles.footerText}>
                Don't have an account? <Text style={styles.footerLink}>Create one</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing['3xl'],
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  logoText: {
    fontSize: theme.fontSizes['3xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.fontSizes['4xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  switcherContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  switcherButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.DEFAULT,
    alignItems: 'center',
  },
  switcherButtonActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  switcherText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  switcherTextActive: {
    color: theme.colors.textPrimary,
  },
  formSection: {
    gap: theme.spacing.base,
  },
  inputContainer: {
    marginBottom: theme.spacing.base,
  },
  inputLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
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
  helperTextError: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.error,
    marginTop: 6,
    marginLeft: 4,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: theme.colors.onPrimaryText,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
  footer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 0,
    gap: theme.spacing.sm,
  },
  signupPrompt: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  footerText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.accentDarker,
  },
  securityText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
});

export default LoginScreen;
