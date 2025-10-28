import React, { useEffect, useState, useRef } from 'react';
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
import { PinLockError } from '@/utils/pinSecurity';
import theme from '@/theme';

const LOCK_REFRESH_INTERVAL = 1000;

const PINEntryScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const verifyPin = useAuthStore((state) => state.verifyPin);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isVerifyingPin = useAuthStore((state) => state.isVerifyingPin);
  const failedPinAttempts = useAuthStore((state) => state.failedPinAttempts);
  const pinLockedUntil = useAuthStore((state) => state.pinLockedUntil);
  const getIsPinLocked = useAuthStore((state) => state.getIsPinLocked);
  const getRemainingLockTime = useAuthStore((state) => state.getRemainingLockTime);

  const [pinValue, setPinValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [remainingLockSeconds, setRemainingLockSeconds] = useState<number>(0);
  const [isLocked, setIsLocked] = useState(false);

  // Track previous lock state to detect transitions
  const prevLockedRef = useRef(false);

  // Update lock state periodically since pinLockedUntil is a Date we need to check against current time
  useEffect(() => {
    const updateLockState = () => {
      const locked = getIsPinLocked();
      const wasLocked = prevLockedRef.current;

      setIsLocked(locked);

      if (!locked) {
        setRemainingLockSeconds(0);

        // Lock just expired - clear error state
        if (wasLocked) {
          setShowError(false);
          setErrorMessage(null);
          setPinValue('');
        }
      } else {
        setRemainingLockSeconds(getRemainingLockTime());
      }

      prevLockedRef.current = locked;
    };

    // Initial update
    updateLockState();

    // Update lock state on a fixed cadence
    const timer = setInterval(updateLockState, LOCK_REFRESH_INTERVAL);

    return () => clearInterval(timer);
  }, [getIsPinLocked, getRemainingLockTime]);

  // Clear PIN value after verification completes
  useEffect(() => {
    if (!isVerifyingPin) {
      setPinValue('');
    }
  }, [isVerifyingPin]);

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

  const handlePinComplete = async (enteredPin: string) => {
    if (isLocked) {
      setShowError(true);
      setErrorMessage(`PIN temporarily locked. Try again in ${formatRemaining(remainingLockSeconds)}.`);
      return;
    }

    try {
      setShowError(false);
      setErrorMessage(null);
      await verifyPin({ pin: enteredPin });
    } catch (error) {
      if (error instanceof PinLockError) {
        setShowError(true);
        setErrorMessage(
          `Too many attempts. Try again in ${formatRemaining(
            Math.max(1, Math.ceil((error.unlockAt.getTime() - Date.now()) / 1000)),
          )}.`,
        );
        setRemainingLockSeconds(getRemainingLockTime());
        return;
      }

      const message = error instanceof Error && error.message ? error.message : 'Incorrect PIN. Please try again.';
      setShowError(true);
      setErrorMessage(message);
    }
  };

  const handleGoBack = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? You will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
          },
        },
      ],
    );
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset PIN',
      'To reset your PIN, you need to log out and log back in. This will verify your identity with OTP. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            // The AppNavigator will automatically redirect to Auth screens
          },
        },
      ],
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBack}
              disabled={isVerifyingPin}
            >
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Enter PIN</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <View style={styles.heroSection}>
              <View style={styles.heroIcon}>
                <Icon name="lock" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.heroLabel}>Zanari</Text>
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.title}>Enter your PIN</Text>
              {isLocked ? (
                <Text style={styles.blockedText}>
                  Account locked. Try again in {formatRemaining(remainingLockSeconds)}
                </Text>
              ) : (
                <Text style={styles.subtitle}>
                  {failedPinAttempts > 0
                    ? `${Math.max(0, 3 - failedPinAttempts)} attempts remaining`
                    : 'Enter your 4-digit PIN to continue'}
                </Text>
              )}
            </View>

            <View style={styles.pinSection}>
              <PINInput
                value={pinValue}
                onChangeText={setPinValue}
                onComplete={handlePinComplete}
                secureTextEntry
                autoFocus
                disabled={isLocked || isVerifyingPin}
                error={showError}
                errorMessage={errorMessage ?? undefined}
                size="large"
                variant="outline"
              />
              {isVerifyingPin && <Text style={styles.loadingText}>Verifying…</Text>}
            </View>

            <View style={styles.footerSection}>
              <TouchableOpacity
                style={styles.footerButton}
                onPress={handleForgotPin}
                disabled={isVerifyingPin}
              >
                <Text style={styles.footerButtonText}>Forgot PIN?</Text>
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
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing['3xl'],
  },
  heroSection: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  heroLabel: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  titleSection: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
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
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: theme.spacing.base,
  },
  blockedText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.error,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.base,
  },
  pinSection: {
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing['2xl'],
  },
  loadingText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textSecondary,
  },
  footerSection: {
    alignItems: 'center',
  },
  footerButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
  },
  footerButtonText: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.accentDarkest,
  },
});

export default PINEntryScreen;
