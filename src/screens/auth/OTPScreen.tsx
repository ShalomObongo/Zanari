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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';

interface OTPScreenProps {}

interface RouteParams {
  phoneNumber: string;
}

const OTPScreen: React.FC<OTPScreenProps> = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { phoneNumber } = (route.params as RouteParams) || { phoneNumber: '' };
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const sendLoginOtp = useAuthStore((state) => state.sendLoginOtp);
  const sessionId = useAuthStore((state) => state.sessionId);
  const isVerifyingOtp = useAuthStore((state) => state.isVerifyingOtp);
  const isLoggingIn = useAuthStore((state) => state.isLoggingIn);

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

  const formatPhoneNumber = (number: string) => {
    if (number.startsWith('254') && number.length >= 12) {
      return `+${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6, 9)} ${number.slice(9)}`;
    }
    return number;
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

  const isOtpComplete = otp.every(digit => digit !== '');

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
      const { requiresPinSetup } = await verifyOtp({ sessionId, otpCode });
      if (requiresPinSetup) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'PINSetup', params: { phoneNumber } }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'PINEntry' }],
        });
      }
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : (error as Error).message ?? 'Unable to verify code. Please try again.';
      Alert.alert('Verification Failed', message);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setTimer(60);
    setCanResend(false);
    
    try {
      await sendLoginOtp({ phone: phoneNumber });
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
    } catch (error) {
      const message = error instanceof ApiError
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
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to{'\n'}
                <Text style={styles.phoneText}>{formatPhoneNumber(phoneNumber)}</Text>
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
                    style={[
                      styles.otpInput,
                      digit !== '' && styles.otpInputFilled
                    ]}
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

              {/* Resend Section */}
              <View style={styles.resendSection}>
                {!canResend ? (
                  <Text style={styles.timerText}>
                    Resend code in {timer}s
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendText}>Resend code</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Verify Button */}
              <TouchableOpacity 
                style={[
                  styles.verifyButton, 
                  (!isOtpComplete || isVerifyingOtp) && styles.verifyButtonDisabled
                ]}
                onPress={handleVerify}
                disabled={!isOtpComplete || isVerifyingOtp}
              >
                <Text style={[
                  styles.verifyButtonText,
                  (!isOtpComplete || isVerifyingOtp) && styles.verifyButtonTextDisabled
                ]}>
                  {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Didn't receive a code?{' '}
                <Text style={styles.footerLink}>Check your SMS</Text> or{' '}
                <Text style={styles.footerLink} onPress={handleGoBack}>
                  try a different number
                </Text>
              </Text>
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
  phoneText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  otpSection: {
    flex: 1,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 45,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.3)',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'System',
  },
  otpInputFilled: {
    backgroundColor: 'rgba(82, 183, 136, 0.2)',
    borderColor: '#52B788',
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerText: {
    fontSize: 14,
    color: '#95D5B2',
    fontFamily: 'System',
  },
  resendText: {
    fontSize: 14,
    color: '#52B788',
    fontWeight: '600',
    fontFamily: 'System',
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
    elevation: 0,
    shadowOpacity: 0,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  verifyButtonTextDisabled: {
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
});

export default OTPScreen;