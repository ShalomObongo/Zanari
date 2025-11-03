import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Vibration,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';
import { useTheme } from '@/theme';
import theme from '@/theme';

interface PINSetupScreenProps {}

interface RouteParams {
  phoneNumber: string;
}

const PINSetupScreen: React.FC<PINSetupScreenProps> = () => {
  const navigation = useNavigation<any>();
  const themeColors = useTheme();
  const route = useRoute();
  const { phoneNumber } = (route.params as RouteParams) || { phoneNumber: '' };

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const setupPin = useAuthStore((state) => state.setupPin);
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const isSettingUpPin = useAuthStore((state) => state.isSettingUpPin);
  const isVerifyingPin = useAuthStore((state) => state.isVerifyingPin);
  const isBusy = isSettingUpPin || isVerifyingPin;

  const validatePinSecurity = (pinValue: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    const isSequential = (str: string) => {
      for (let i = 0; i < str.length - 1; i++) {
        const current = parseInt(str[i] || '0', 10);
        const next = parseInt(str[i + 1] || '0', 10);
        if (next !== current + 1) {
          return false;
        }
      }
      return true;
    };

    const hasRepeatedDigits = (str: string) => {
      return str.split('').every((digit) => digit === str[0]);
    };

    const commonPatterns = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1212', '0987', '4321'];

    if (pinValue.length !== 4) {
      errors.push('PIN must be exactly 4 digits');
    }

    if (!/^\d{4}$/.test(pinValue)) {
      errors.push('PIN must contain only numbers');
    }

    if (isSequential(pinValue)) {
      errors.push('Avoid sequential numbers (e.g., 1234)');
    }

    if (hasRepeatedDigits(pinValue)) {
      errors.push('Avoid repeating the same digit');
    }

    if (commonPatterns.includes(pinValue)) {
      errors.push('This PIN is too common. Choose a more secure one');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const pinSecurity = useMemo(() => validatePinSecurity(pin), [pin]);
  const isPinStrong = pinSecurity.isValid;

  const handleNumberPress = (number: string) => {
    if (isBusy) return;
    const currentPin = step === 'create' ? pin : confirmPin;

    if (currentPin.length < 4) {
      const newPin = currentPin + number;

      if (step === 'create') {
        setPin(newPin);
      } else {
        setConfirmPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isBusy) return;
    const currentPin = step === 'create' ? pin : confirmPin;
    const newPin = currentPin.slice(0, -1);

    if (step === 'create') {
      setPin(newPin);
    } else {
      setConfirmPin(newPin);
    }
  };

  const handleContinue = async () => {
    if (step === 'create') {
      if (pin.length !== 4) {
        Alert.alert('Incomplete PIN', 'Please enter a 4-digit PIN');
        return;
      }

      const validation = validatePinSecurity(pin);
      if (!validation.isValid) {
        Alert.alert('Weak PIN', validation.errors.join('\n\n'));
        return;
      }

      setStep('confirm');
      setConfirmPin('');
    } else {
      if (confirmPin.length !== 4) {
        Alert.alert('Incomplete PIN', 'Please confirm your 4-digit PIN');
        return;
      }

      if (pin !== confirmPin) {
        Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
        Vibration.vibrate(400);
        setConfirmPin('');
        return;
      }

      await handlePINSetupComplete();
    }
  };

  const handlePINSetupComplete = async () => {
    try {
      await setupPin({ pin, confirmPin });
      await verifyPin({ pin });
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : (error as Error).message ?? 'Unable to set up your PIN. Please try again.';
      Alert.alert('Setup Failed', message);
    }
  };

  const handleGoBack = () => {
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin('');
    } else {
      navigation.goBack();
    }
  };

  const renderPinDots = () => {
    const currentPin = step === 'create' ? pin : confirmPin;
    return (
      <View style={styles.pinDotsContainer} testID="pin-dots">
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < currentPin.length && styles.pinDotFilled,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const keypadNumbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'backspace'],
    ];

    return (
      <View style={styles.keypadContainer}>
        {keypadNumbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item, itemIndex) => {
              const isPlaceholder = item === '';
              const isDisabled = isBusy || isPlaceholder;

              return (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.keypadButton,
                    isPlaceholder && styles.keypadButtonEmpty,
                    isBusy && styles.keypadButtonDisabled,
                  ]}
                  onPress={() => {
                    if (item === 'backspace') {
                      handleBackspace();
                    } else if (!isPlaceholder) {
                      handleNumberPress(item);
                    }
                  }}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    item === 'backspace'
                      ? 'Delete last digit'
                      : !isPlaceholder
                        ? `Enter ${item}`
                        : undefined
                  }
                >
                  {item === 'backspace' ? (
                    <Icon name="backspace" size={28} color={theme.colors.textPrimary} />
                  ) : !isPlaceholder ? (
                    <Text style={styles.keypadButtonText}>{item}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.backgroundLight} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{step === 'create' ? 'Create PIN' : 'Confirm PIN'}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <View style={styles.infoWrapper}>
              <ScrollView
                style={styles.infoScroll}
                contentContainerStyle={styles.infoScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.infoCard}>
                  <View style={styles.heroSection}>
                    <View style={styles.heroIcon}>
                      <Icon
                        name={step === 'create' ? 'lock-outline' : 'verified-user'}
                        size={32}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.heroDetails}>
                      <Text style={styles.heroLabel}>Zanari</Text>
                      {phoneNumber ? (
                        <View style={styles.heroBadge}>
                          <Icon name="phone-iphone" size={16} color={theme.colors.accentDarkest} />
                          <Text style={styles.heroBadgeText}>{phoneNumber}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.titleSection}>
                    <Text style={styles.stepLabel}>{step === 'create' ? 'Step 1 of 2' : 'Step 2 of 2'}</Text>
                    <Text style={styles.title}>
                      {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
                    </Text>
                    <Text style={styles.subtitle}>
                      {step === 'create'
                        ? 'Use a 4-digit PIN that only you know. Keep it unique and avoid predictable patterns.'
                        : 'Enter the same 4-digit PIN again so we can confirm everything matches.'}
                    </Text>
                  </View>
                </View>

                {step === 'create' && (
                  <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>How to pick a strong PIN</Text>
                    <View style={styles.tipRow}>
                      <View style={styles.tipBullet} />
                      <Text style={styles.tipsText}>Mix up your digits; avoid sequences like 1234</Text>
                    </View>
                    <View style={styles.tipRow}>
                      <View style={styles.tipBullet} />
                      <Text style={styles.tipsText}>Skip repeated digits such as 1111 or 0000</Text>
                    </View>
                    <View style={styles.tipRow}>
                      <View style={styles.tipBullet} />
                      <Text style={styles.tipsText}>Keep it personal and never reuse old or common PINs</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.keypadCard}>
              <View style={styles.pinSection}>
                <Text style={styles.pinSectionLabel}>Your PIN</Text>
                {renderPinDots()}
                <Text style={styles.pinHelperText}>
                  {step === 'create'
                    ? 'Enter four digits to set up your secure PIN.'
                    : 'Re-enter the PIN you chose so we can double-check it.'}
                </Text>

                {step === 'create' && pin.length > 0 && (
                  <View
                    style={[
                      styles.securityIndicator,
                      isPinStrong ? styles.securityIndicatorPositive : styles.securityIndicatorWarning,
                    ]}
                  >
                    <Icon
                      name={isPinStrong ? 'verified' : 'warning'}
                      size={18}
                      color={isPinStrong ? theme.colors.success : theme.colors.error}
                    />
                    <Text
                      style={[
                        styles.securityIndicatorText,
                        isPinStrong
                          ? styles.securityIndicatorTextPositive
                          : styles.securityIndicatorTextWarning,
                      ]}
                    >
                      {isPinStrong
                        ? 'Great choice! This PIN looks strong.'
                        : 'Try mixing the numbers a little more for better security.'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.keypadSection}>{renderKeypad()}</View>

              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (currentPin.length !== 4 || isBusy) && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={currentPin.length !== 4 || isBusy}
                accessibilityRole="button"
                accessibilityLabel={step === 'create' ? 'Continue to confirm PIN' : 'Complete PIN setup'}
              >
                <Text style={styles.continueButtonText}>
                  {isBusy ? 'Setting up...' : step === 'create' ? 'Continue' : 'Complete Setup'}
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
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  infoWrapper: {
    flexShrink: 1,
  },
  infoScroll: {
    flexGrow: 0,
  },
  infoScrollContent: {
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDetails: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  heroLabel: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    gap: theme.spacing.xs,
  },
  heroBadgeText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  titleSection: {
    gap: theme.spacing.sm,
  },
  stepLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.accentDarker,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: theme.fontSizes['4xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  tipsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  tipsTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    marginTop: 6,
  },
  tipsText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  keypadCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  pinSection: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pinSectionLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pinHelperText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.gray200,
  },
  pinDotFilled: {
    backgroundColor: theme.colors.primary,
  },
  securityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
  },
  securityIndicatorPositive: {
    backgroundColor: 'rgba(82, 183, 136, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  securityIndicatorWarning: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  securityIndicatorText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
  },
  securityIndicatorTextPositive: {
    color: theme.colors.success,
  },
  securityIndicatorTextWarning: {
    color: theme.colors.error,
  },
  keypadSection: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  keypadContainer: {
    alignSelf: 'center',
    gap: theme.spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  keypadButton: {
    width: 78,
    height: 78,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  keypadButtonEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...theme.shadows.sm,
    shadowOpacity: 0,
    shadowColor: 'transparent',
    elevation: 0,
  },
  keypadButtonDisabled: {
    opacity: 0.4,
  },
  keypadButtonText: {
    fontSize: theme.fontSizes['3xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
  },
  continueButton: {
    marginTop: theme.spacing['2xl'],
    height: 56,
    width: '100%',
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.primary,
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
});

export default PINSetupScreen;
