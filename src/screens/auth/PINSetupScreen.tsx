import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';

interface PINSetupScreenProps {}

interface RouteParams {
  phoneNumber: string;
}

const PINSetupScreen: React.FC<PINSetupScreenProps> = () => {
  const navigation = useNavigation<any>();
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

  const pinDisplayRef = useRef<string>('');

  // Security validation rules
  const validatePinSecurity = (pinValue: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check for sequential numbers
    const isSequential = (str: string) => {
      for (let i = 0; i < str.length - 1; i++) {
        const current = parseInt(str[i] || '0');
        const next = parseInt(str[i + 1] || '0');
        if (next !== current + 1) {
          return false;
        }
      }
      return true;
    };
    
    // Check for repeated digits
    const hasRepeatedDigits = (str: string) => {
      return str.split('').every(digit => digit === str[0]);
    };
    
    // Check for common patterns
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
      errors
    };
  };

  const handleNumberPress = (number: string) => {
    if (isBusy) return;
    const currentPin = step === 'create' ? pin : confirmPin;
    
    if (currentPin.length < 4) {
      const newPin = currentPin + number;
      
      if (step === 'create') {
        setPin(newPin);
        pinDisplayRef.current = newPin;
      } else {
        setConfirmPin(newPin);
        pinDisplayRef.current = newPin;
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
    
    pinDisplayRef.current = newPin;
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
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
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < currentPin.length && styles.pinDotFilled
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
      ['', '0', 'backspace']
    ];

    return (
      <View style={styles.keypadContainer}>
        {keypadNumbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.keypadButton,
                  item === '' && styles.keypadButtonEmpty
                ]}
                onPress={() => {
                  if (item === 'backspace') {
                    handleBackspace();
                  } else if (item !== '') {
                    handleNumberPress(item);
                  }
                }}
                disabled={item === '' || isBusy}
              >
                {item === 'backspace' ? (
                  <Text style={styles.keypadButtonText}>⌫</Text>
                ) : (
                  <Text style={styles.keypadButtonText}>{item}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const currentPin = step === 'create' ? pin : confirmPin;

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
              <Text style={styles.title}>
                {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'create' 
                  ? 'Choose a secure 4-digit PIN to protect your account' 
                  : 'Re-enter your PIN to confirm'
                }
              </Text>
            </View>

            {/* PIN Display */}
            <View style={styles.pinSection}>
              {renderPinDots()}
              
              {step === 'create' && pin.length > 0 && (
                <View style={styles.securityIndicator}>
                  <Text style={styles.securityText}>
                    {validatePinSecurity(pin).isValid ? '✓ Secure PIN' : '⚠ Choose a stronger PIN'}
                  </Text>
                </View>
              )}
            </View>

            {/* Keypad */}
            <View style={styles.keypadSection}>
              {renderKeypad()}
            </View>

            {/* Continue Button */}
            <View style={styles.buttonSection}>
              <TouchableOpacity 
                style={[
                  styles.continueButton, 
                  (currentPin.length !== 4 || isBusy) && styles.continueButtonDisabled
                ]}
                onPress={handleContinue}
                disabled={currentPin.length !== 4 || isBusy}
              >
                <Text
                  style={[
                    styles.continueButtonText,
                    (currentPin.length !== 4 || isBusy) && styles.continueButtonTextDisabled
                  ]}
                >
                  {isBusy ? 'Setting up...' : (step === 'create' ? 'Continue' : 'Complete Setup')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security Tips */}
            {step === 'create' && (
              <View style={styles.securityTips}>
                <Text style={styles.tipsTitle}>Security Tips:</Text>
                <Text style={styles.tipsText}>• Avoid sequential numbers (1234)</Text>
                <Text style={styles.tipsText}>• Don't use repeated digits (1111)</Text>
                <Text style={styles.tipsText}>• Avoid common patterns</Text>
              </View>
            )}
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
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: '#B7E4C7',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'System',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(183, 228, 199, 0.3)',
    marginHorizontal: 12,
  },
  pinDotFilled: {
    backgroundColor: '#52B788',
  },
  securityIndicator: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    borderRadius: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#B7E4C7',
    textAlign: 'center',
    fontFamily: 'System',
  },
  keypadSection: {
    flex: 1,
    justifyContent: 'center',
  },
  keypadContainer: {
    alignSelf: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  keypadButtonEmpty: {
    backgroundColor: 'transparent',
  },
  keypadButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'System',
  },
  buttonSection: {
    marginBottom: 24,
  },
  continueButton: {
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
  continueButtonDisabled: {
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  continueButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  securityTips: {
    backgroundColor: 'rgba(183, 228, 199, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'System',
  },
  tipsText: {
    fontSize: 12,
    color: '#B7E4C7',
    marginBottom: 4,
    fontFamily: 'System',
  },
});

export default PINSetupScreen;