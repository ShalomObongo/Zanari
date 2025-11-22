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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import PINInput from '@/components/PINInput';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';
import { evaluatePinSecurity, PinLockError } from '@/utils/pinSecurity';

type ChangePinStep = 'verify' | 'new' | 'confirm';

const formatRemaining = (seconds: number) => {
  if (seconds <= 0) {
    return 'a moment';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

const ChangePINScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const setupPin = useAuthStore((state) => state.setupPin);
  const isVerifyingPin = useAuthStore((state) => state.isVerifyingPin);
  const isSettingUpPin = useAuthStore((state) => state.isSettingUpPin);

  const [step, setStep] = useState<ChangePinStep>('verify');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = isVerifyingPin || isSettingUpPin;

  const newPinEvaluation = useMemo(() => evaluatePinSecurity(newPin), [newPin]);

  const resetFlow = () => {
    setStep('verify');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (step === 'verify') {
      navigation.goBack();
      return;
    }

    if (step === 'new') {
      setStep('verify');
      setCurrentPin('');
    } else {
      setStep('new');
      setConfirmPin('');
    }
    setErrorMessage(null);
  };

  const handlePrimaryAction = async () => {
    if (step === 'verify') {
      if (currentPin.length !== 4) {
        setErrorMessage('Enter your current 4-digit PIN to continue.');
        return;
      }

      try {
        setErrorMessage(null);
        await verifyPin({ pin: currentPin });
        setCurrentPin('');
        setStep('new');
      } catch (error) {
        if (error instanceof PinLockError) {
          const remainingSeconds = Math.max(
            1,
            Math.ceil((error.unlockAt.getTime() - Date.now()) / 1000),
          );
          setErrorMessage(`Too many attempts. Try again in ${formatRemaining(remainingSeconds)}.`);
          return;
        }

        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error && error.message
              ? error.message
              : 'Unable to verify PIN. Please try again.';
        setErrorMessage(message);
      }
      return;
    }

    if (step === 'new') {
      if (newPin.length !== 4) {
        setErrorMessage('PIN must be exactly 4 digits.');
        return;
      }

      if (!newPinEvaluation.isValid) {
        setErrorMessage(newPinEvaluation.errors[0] ?? 'Choose a stronger PIN.');
        return;
      }

      setStep('confirm');
      setErrorMessage(null);
      return;
    }

    if (confirmPin.length !== 4) {
      setErrorMessage('Confirm your new 4-digit PIN.');
      return;
    }

    if (confirmPin !== newPin) {
      setErrorMessage('The confirmation PIN does not match. Try again.');
      return;
    }

    try {
      setErrorMessage(null);
      await setupPin({ pin: newPin, confirmPin });
      await verifyPin({ pin: newPin });
      Alert.alert('PIN Updated', 'Your transaction PIN has been updated successfully.', [
        {
          text: 'Done',
          onPress: () => {
            resetFlow();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message
            ? error.message
            : 'Unable to update PIN. Please try again.';
      setErrorMessage(message);
    }
  };

  const primaryLabel =
    step === 'verify' ? 'Verify PIN' : step === 'new' ? 'Continue' : 'Update PIN';

  const isContinueDisabled = (() => {
    if (isBusy) return true;
    if (step === 'verify') {
      return currentPin.length !== 4;
    }
    if (step === 'new') {
      return newPin.length !== 4;
    }
    return confirmPin.length !== 4;
  })();

  const helperText = (() => {
    if (step === 'verify') {
      return 'Enter the PIN you currently use for approvals.';
    }
    if (step === 'new') {
      return 'Create a new 4-digit PIN that is hard to guess.';
    }
    return 'Re-enter the new PIN to confirm.';
  })();

  const stepLabel =
    step === 'verify' ? 'Step 1 of 3' : step === 'new' ? 'Step 2 of 3' : 'Step 3 of 3';

  const title =
    step === 'verify'
      ? 'Verify your current PIN'
      : step === 'new'
        ? 'Choose a new PIN'
        : 'Confirm new PIN';

  const pinValue = step === 'verify' ? currentPin : step === 'new' ? newPin : confirmPin;

  const onPinChange = (value: string) => {
    setErrorMessage(null);

    if (step === 'verify') {
      setCurrentPin(value);
    } else if (step === 'new') {
      setNewPin(value);
    } else {
      setConfirmPin(value);
    }
  };

  const styles = createStyles(theme);

  return (
    <>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.background} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              disabled={isBusy}
            >
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Change PIN</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <View style={styles.body}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>{stepLabel}</Text>
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{helperText}</Text>

              <View style={styles.pinContainer}>
                <PINInput
                  value={pinValue}
                  onChangeText={onPinChange}
                  length={4}
                  secureTextEntry
                  autoFocus
                  disabled={isBusy}
                  error={Boolean(errorMessage)}
                  errorMessage={errorMessage ?? undefined}
                  size="large"
                  variant="outline"
                />

                {step === 'new' && newPin.length === 4 && !newPinEvaluation.isValid && (
                  <View style={styles.validationCard}>
                    {newPinEvaluation.errors.map((item) => (
                      <Text key={item} style={styles.validationText}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isContinueDisabled || isBusy) && styles.primaryButtonDisabled,
              ]}
              onPress={handlePrimaryAction}
              disabled={isContinueDisabled || isBusy}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{isBusy ? 'Please wait…' : primaryLabel}</Text>
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
    backgroundColor: theme.colors.background,
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing['2xl'],
  },
  body: {
    paddingTop: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.base,
  },
  stepPillText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: theme.fontSizes['3xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  pinContainer: {
    marginTop: theme.spacing['2xl'],
    gap: theme.spacing.md,
  },
  validationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: theme.spacing.xs,
  },
  validationText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  primaryButton: {
    height: 56,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.colors.onPrimaryText,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
});

export default ChangePINScreen;
