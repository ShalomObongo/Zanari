import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import PINInput from '@/components/PINInput';
import { useAuthStore } from '@/store/authStore';
import { PinLockError } from '@/utils/pinSecurity';

interface PinVerificationModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

const LOCK_REFRESH_INTERVAL = 1000;

const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  visible,
  title = 'Enter your PIN',
  subtitle = 'Authorize this action with your 4-digit PIN',
  onSuccess,
  onCancel,
}) => {
  const verifyPin = useAuthStore((state) => state.verifyPin);
  const isVerifyingPin = useAuthStore((state) => state.isVerifyingPin);
  const failedPinAttempts = useAuthStore((state) => state.failedPinAttempts);
  const getIsPinLocked = useAuthStore((state) => state.getIsPinLocked);
  const getRemainingLockTime = useAuthStore((state) => state.getRemainingLockTime);

  const [pinValue, setPinValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [lockSecondsRemaining, setLockSecondsRemaining] = useState(0);

  const isLocked = getIsPinLocked();

  useEffect(() => {
    if (!visible) {
      setPinValue('');
      setErrorMessage(null);
      setShowError(false);
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
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={isVerifyingPin}>
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
  },
  button: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
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
