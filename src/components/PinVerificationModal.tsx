import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import PINInput from '@/components/PINInput';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { biometricAuthService } from '@/services/biometricAuth';
import { PinLockError } from '@/utils/pinSecurity';

interface PinVerificationModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  message?: string; // Optional message for biometric prompt
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

const LOCK_REFRESH_INTERVAL = 1000;

const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  visible,
  title = 'Enter your PIN',
  subtitle = 'Authorize this action with your 4-digit PIN',
  message,
  onSuccess,
  onCancel,
}) => {
  // Auth store
  const user = useAuthStore((state) => state.user);
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const isVerifyingPin = useAuthStore((state) => state.isVerifyingPin);
  const failedPinAttempts = useAuthStore((state) => state.failedPinAttempts);
  const getIsPinLocked = useAuthStore((state) => state.getIsPinLocked);
  const getRemainingLockTime = useAuthStore((state) => state.getRemainingLockTime);

  // Settings store
  const isBiometricEnabled = useSettingsStore((state) => state.isBiometricEnabled);

  const [pinValue, setPinValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [lockSecondsRemaining, setLockSecondsRemaining] = useState(0);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isAuthenticatingBiometric, setIsAuthenticatingBiometric] = useState(false);
  const hasAttemptedBiometric = useRef(false);

  const isLocked = getIsPinLocked();

  useEffect(() => {
    if (!visible) {
      setPinValue('');
      setErrorMessage(null);
      setShowError(false);
      hasAttemptedBiometric.current = false;
      setBiometricAvailable(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !isLocked) {
      setLockSecondsRemaining(0);
      return;
    }

    setLockSecondsRemaining(getRemainingLockTime());
    const timer = setInterval(() => {
      setLockSecondsRemaining(getRemainingLockTime());
    }, LOCK_REFRESH_INTERVAL);

    return () => clearInterval(timer);
  }, [getRemainingLockTime, isLocked, visible]);

  // Check biometric availability and auto-prompt
  useEffect(() => {
    const checkAndPromptBiometric = async () => {
      if (!visible || !user?.id) return;

      // Check if biometric is enabled for this user
      const enabled = isBiometricEnabled(user.id);
      if (!enabled) {
        setBiometricAvailable(false);
        return;
      }

      // Check if device supports biometric
      try {
        const canUse = await biometricAuthService.canUseBiometrics();
        if (!canUse) {
          setBiometricAvailable(false);
          return;
        }

        setBiometricAvailable(true);

        // Get biometric type for display
        const type = await biometricAuthService.getBiometricType();
        setBiometricType(type || 'Biometric');

        // Auto-prompt biometric if not locked and haven't attempted yet
        if (!isLocked && !hasAttemptedBiometric.current) {
          hasAttemptedBiometric.current = true;
          // Small delay to let modal settle
          setTimeout(() => {
            handleBiometricAuth();
          }, 300);
        }
      } catch (error) {
        setBiometricAvailable(false);
      }
    };

    checkAndPromptBiometric();
  }, [visible, user?.id, isLocked]);

  // Handle biometric authentication
  const handleBiometricAuth = async () => {
    if (!user?.id || isLocked || isVerifyingPin || isAuthenticatingBiometric) {
      return;
    }

    setIsAuthenticatingBiometric(true);
    setShowError(false);
    setErrorMessage(null);

    try {
      const success = await biometricAuthService.authenticate(user.id, {
        promptMessage: message || 'Verify your identity to authorize this action',
        cancelLabel: 'Use PIN',
        fallbackLabel: 'Use PIN Instead',
      });

      if (success) {
        // Biometric authentication successful
        // Verify PIN to get token (using cached hash if available)
        // For now, we'll call verifyPin with a special marker
        // In production, you'd want a backend endpoint for biometric → PIN token

        // Since we can't get the actual PIN from biometric,
        // we'll need to handle this differently
        // Option 1: Call a special endpoint that issues token based on biometric
        // Option 2: Generate a temporary token client-side (less secure)
        // Option 3: Store encrypted PIN with biometric (requires setup)

        // For MVP: We'll use the setPinVerificationToken approach
        // Generate a dummy token (in production, this should come from backend)
        const biometricToken = `biometric-${user.id}-${Date.now()}`;
        useAuthStore.getState().setPinVerificationToken(biometricToken);
        onSuccess(biometricToken);
      } else {
        // Biometric failed or cancelled
        setErrorMessage('Biometric authentication cancelled. Please use your PIN.');
        setShowError(true);
      }
    } catch (error) {
      // Error during biometric auth
      const errorMsg = error instanceof Error ? error.message : 'Biometric authentication failed';
      setErrorMessage(errorMsg + '. Please use your PIN.');
      setShowError(true);
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return 'a moment';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const handleComplete = async (enteredPin: string) => {
    if (isLocked) {
      setShowError(true);
      setErrorMessage(`PIN locked. Try again in ${formatRemaining(lockSecondsRemaining)}.`);
      return;
    }

    try {
      setShowError(false);
      setErrorMessage(null);
      const token = await verifyPin({ pin: enteredPin });
      onSuccess(token);
    } catch (error) {
      if (error instanceof PinLockError) {
        const seconds = Math.max(1, Math.ceil((error.unlockAt.getTime() - Date.now()) / 1000));
        setShowError(true);
        setErrorMessage(`Too many attempts. Try again in ${formatRemaining(seconds)}.`);
        setLockSecondsRemaining(seconds);
        return;
      }

      const message = error instanceof Error && error.message ? error.message : 'Incorrect PIN. Try again.';
      setShowError(true);
      setErrorMessage(message);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{isLocked ? `PIN locked. Try again in ${formatRemaining(lockSecondsRemaining)}.` : subtitle}</Text>

            <View style={styles.pinInputContainer}>
              <PINInput
                value={pinValue}
                onChangeText={setPinValue}
                onComplete={handleComplete}
                secureTextEntry
                autoFocus
                disabled={isLocked || isVerifyingPin}
                error={showError}
                errorMessage={errorMessage ?? undefined}
                size="large"
                variant="outline"
              />
              {isVerifyingPin && <Text style={styles.verifyingText}>Verifying…</Text>}
              {!isLocked && failedPinAttempts > 0 && (
                <Text style={styles.attemptsText}>
                  {`${Math.max(0, 3 - failedPinAttempts)} attempts remaining`}
                </Text>
              )}
            </View>

            <View style={styles.buttonRow}>
              {biometricAvailable && !isLocked && (
                <TouchableOpacity
                  style={[styles.button, styles.biometricButton]}
                  onPress={handleBiometricAuth}
                  disabled={isVerifyingPin || isAuthenticatingBiometric}
                >
                  <Icon name="fingerprint" size={20} color="#40916C" />
                  <Text style={[styles.buttonText, styles.biometricButtonText]}>
                    {isAuthenticatingBiometric ? 'Verifying...' : biometricType}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={isVerifyingPin}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B4332',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 24,
  },
  pinInputContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6C757D',
  },
  attemptsText: {
    marginTop: 8,
    fontSize: 13,
    color: '#FF6B6B',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#D8F3DC',
  },
  biometricButtonText: {
    color: '#40916C',
  },
  cancelButton: {
    backgroundColor: '#F1F3F5',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#1B4332',
  },
});

export default PinVerificationModal;
