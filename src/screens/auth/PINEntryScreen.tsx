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

    // Update every second
    const timer = setInterval(updateLockState, 1000);

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
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBack}
              disabled={isVerifyingPin}
            >
              <Icon name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.logoSection}>
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>Z</Text>
              </View>
              <Text style={styles.appName}>Zanari</Text>
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
                variant="dark"
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
    backgroundColor: '#1B4332',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#52B788',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'System',
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'System',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
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
    textAlign: 'center',
    fontFamily: 'System',
  },
  blockedText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    fontFamily: 'System',
    fontWeight: '600',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 32,
    minHeight: 120,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#B7E4C7',
    fontFamily: 'System',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 32,
  },
  footerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  footerButtonText: {
    fontSize: 15,
    color: '#52B788',
    fontWeight: '600',
    fontFamily: 'System',
  },
});

export default PINEntryScreen;