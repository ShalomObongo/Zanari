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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';
import theme from '@/theme';

interface OTPScreenProps {}

interface RouteParams {
  identifier: string;
  method: 'email' | 'phone';
}

const OTPScreen: React.FC<OTPScreenProps> = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { identifier, method } = (route.params as RouteParams) || { identifier: '', method: 'phone' };

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const sendLoginOtp = useAuthStore((state) => state.sendLoginOtp);
  const sessionId = useAuthStore((state) => state.sessionId);
  const isVerifyingOtp = useAuthStore((state) => state.isVerifyingOtp);

  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');

    if (digit.length > 1) {
      // Handle paste scenario
      const digits = digit.slice(0, 6).split('');
      const newOtp = [...otp];

      digits.forEach((d, i) => {
        if (index + i < 6) {
          newOtp[index + i] = d;
        }
      });

      setOtp(newOtp);

      // Focus on the next empty field or last field
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();

      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  const handleVerify = async () => {
    if (!isOtpComplete) {
      Alert.alert('Incomplete Code', 'Please enter the complete 6-digit code');
      return;
    }

    if (!sessionId) {
      Alert.alert('Session Expired', 'Please request a new verification code.');
      return;
    }

    const otpCode = otp.join('');

    try {
      await verifyOtp({ sessionId, otpCode });
      // The root navigator will redirect based on authentication and PIN state.
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : (error as Error).message ?? 'Unable to verify code. Please try again.';
      Alert.alert('Verification Failed', message);
    }
  };

  const contactLabel = method === 'email' ? 'email address' : 'phone number';

  const handleResend = async () => {
    if (!canResend) return;

    if (!identifier) {
      Alert.alert('Unable to resend', 'We could not determine your contact method. Please go back and try again.');
      return;
    }

    setTimer(30);
    setCanResend(false);

    const payload = method === 'email' ? { email: identifier } : { phone: identifier };

    try {
      await sendLoginOtp(payload);
      Alert.alert('Code Sent', `A new verification code has been sent to your ${contactLabel}`);
      // Restart timer
      const countdown = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : (error as Error).message ?? 'Unable to resend code. Please try again.';
      Alert.alert('Error', message);
      setCanResend(true);
      setTimer(0);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
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
            <Text style={styles.headerTitle}>Verify Your Identity</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Enter Code</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to your registered contact method.
              </Text>
            </View>

            {/* OTP Input Section */}
            <View style={styles.otpSection}>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[styles.otpInput, digit !== '' && styles.otpInputFilled]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus={true}
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {/* Timer Section */}
              <View style={styles.timerSection}>
                <Text style={styles.timerText}>Resend code in {formatTimer(timer)}</Text>
              </View>
            </View>
          </View>

          {/* Footer with buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.verifyButton, isVerifyingOtp && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              disabled={isVerifyingOtp}
              activeOpacity={0.8}
            >
              {isVerifyingOtp ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={canResend ? handleResend : undefined}
              style={styles.alternativeMethodButton}
              disabled={!canResend}
            >
              <Text style={[styles.alternativeMethodText, !canResend && styles.alternativeMethodTextDisabled]}>
                Use another method
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.xl,
    justifyContent: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: theme.spacing['3xl'],
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
    paddingHorizontal: theme.spacing.base,
    lineHeight: 24,
  },
  otpSection: {
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    textAlign: 'center',
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textSecondary,
  },
  otpInputFilled: {
    borderColor: theme.colors.accentDarkest,
    borderWidth: 2,
    color: theme.colors.textPrimary,
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  timerText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
  },
  footer: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.base,
    gap: theme.spacing.base,
  },
  verifyButton: {
    backgroundColor: theme.colors.accent,
    height: 56,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
  alternativeMethodButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  alternativeMethodText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.accentDarkest,
  },
  alternativeMethodTextDisabled: {
    color: theme.colors.textTertiary,
  },
});

export default OTPScreen;
