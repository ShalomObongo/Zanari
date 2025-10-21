import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Vibration,
  ViewStyle,
} from 'react-native';

interface PINInputProps {
  length?: 4 | 5 | 6;
  value?: string;
  onChangeText?: (pin: string) => void;
  onComplete?: (pin: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  success?: boolean;
  successMessage?: string;
  autoFocus?: boolean;
  keyboardType?: 'numeric' | 'number-pad';
  clearOnError?: boolean;
  maskDelay?: number; // milliseconds before showing masked character
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'underline' | 'filled';
  style?: ViewStyle;
  testID?: string;
}

const PINInput: React.FC<PINInputProps> = ({
  length = 4,
  value = '',
  onChangeText,
  onComplete,
  placeholder = '•',
  secureTextEntry = false,
  disabled = false,
  error = false,
  errorMessage,
  success = false,
  successMessage,
  autoFocus = false,
  keyboardType = 'number-pad',
  clearOnError = true,
  maskDelay = 500,
  size = 'medium',
  variant = 'default',
  style,
  testID = 'pin-input',
}) => {
  const [pin, setPin] = useState(value);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [tempValues, setTempValues] = useState<(string | undefined)[]>(Array(length).fill(''));
  const inputRef = useRef<TextInput>(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimations = useRef(
    Array(length).fill(0).map(() => new Animated.Value(1))
  ).current;

  // Handle PIN input change
  const handlePinChange = (newPin: string) => {
    // Only allow numeric input
    const numericPin = newPin.replace(/[^0-9]/g, '');
    
    // Limit to specified length
    const truncatedPin = numericPin.slice(0, length);
    
    setPin(truncatedPin);
    onChangeText?.(truncatedPin);

    // Show temporary unmasked values if secureTextEntry is enabled
    if (secureTextEntry) {
      const newTempValues = Array(length).fill('');
      for (let i = 0; i < truncatedPin.length; i++) {
        newTempValues[i] = truncatedPin[i];
      }
      setTempValues(newTempValues);

      // Mask the values after delay
      if (maskDelay > 0) {
        setTimeout(() => {
          setTempValues(Array(length).fill(''));
        }, maskDelay);
      }
    }

    // Animate the current input
    if (truncatedPin.length > pin.length && truncatedPin.length <= length) {
      const index = truncatedPin.length - 1;
      const animation = scaleAnimations[index];
      if (animation) {
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }

    // Check if PIN is complete
    if (truncatedPin.length === length) {
      onComplete?.(truncatedPin);
    }
  };

  // Handle focus
  const handleFocus = () => {
    setFocusedIndex(pin.length < length ? pin.length : length - 1);
  };

  // Handle blur
  const handleBlur = () => {
    setFocusedIndex(-1);
  };

  // Clear PIN
  const clear = () => {
    setPin('');
    setTempValues(Array(length).fill(''));
    onChangeText?.('');
    inputRef.current?.focus();
  };

  // Shake animation for errors
  const triggerShake = () => {
    Vibration.vibrate([0, 100, 50, 100]);
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // Clear PIN if clearOnError is enabled
    if (clearOnError) {
      setTimeout(clear, 200);
    }
  };

  // Effect to handle error state changes
  useEffect(() => {
    if (error) {
      triggerShake();
    }
  }, [error]);

  // Effect to handle external value changes
  useEffect(() => {
    if (value !== pin) {
      setPin(value);
    }
  }, [value]);

  // Get size-based styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          cellSize: 40,
          fontSize: 18,
          spacing: 8,
        };
      case 'large':
        return {
          cellSize: 60,
          fontSize: 28,
          spacing: 16,
        };
      default: // medium
        return {
          cellSize: 50,
          fontSize: 24,
          spacing: 12,
        };
    }
  };

  // Get variant-based styles
  const getVariantStyles = (index: number, sizeStyles: ReturnType<typeof getSizeStyles>) => {
    const isActive = index === focusedIndex;
    const hasValue = pin.length > index;
    const isError = error;
    const isSuccess = success && pin.length === length;

    const baseStyle = {
      width: sizeStyles.cellSize,
      height: sizeStyles.cellSize,
      marginHorizontal: sizeStyles.spacing / 2,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    switch (variant) {
      case 'outline':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderRadius: 8,
          borderColor: isError
            ? '#FF6B6B'
            : isSuccess
            ? '#52B788'
            : isActive
            ? '#1B4332'
            : hasValue
            ? '#6C757D'
            : '#E9ECEF',
          backgroundColor: 'transparent',
        };
      case 'underline':
        return {
          ...baseStyle,
          borderBottomWidth: 3,
          borderBottomColor: isError
            ? '#FF6B6B'
            : isSuccess
            ? '#52B788'
            : isActive
            ? '#1B4332'
            : hasValue
            ? '#6C757D'
            : '#E9ECEF',
          backgroundColor: 'transparent',
        };
      case 'filled':
        return {
          ...baseStyle,
          borderRadius: 8,
          backgroundColor: isError
            ? '#FFE6E6'
            : isSuccess
            ? '#E8F5E8'
            : isActive
            ? '#F0F8F0'
            : hasValue
            ? '#F8F9FA'
            : '#E9ECEF',
          borderWidth: 1,
          borderColor: 'transparent',
        };
      default: // default
        return {
          ...baseStyle,
          borderWidth: 1,
          borderRadius: 8,
          borderColor: isError
            ? '#FF6B6B'
            : isSuccess
            ? '#52B788'
            : isActive
            ? '#1B4332'
            : '#E9ECEF',
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        };
    }
  };

  // Get text color
  const getTextColor = () => {
    if (error) return '#FF6B6B';
    if (success) return '#52B788';
    return '#1B4332';
  };

  // Render individual PIN cell
  const renderCell = (index: number, sizeStyles: ReturnType<typeof getSizeStyles>) => {
    const cellStyles = getVariantStyles(index, sizeStyles);
    const hasValue = pin.length > index;
    const showTempValue = secureTextEntry && tempValues[index];
    
    let displayValue = '';
    if (showTempValue) {
      displayValue = tempValues[index] || '';
    } else if (hasValue) {
      displayValue = secureTextEntry ? placeholder : (pin[index] || '');
    }

    const scaleAnimation = scaleAnimations[index];
    const animatedStyle = scaleAnimation ? { transform: [{ scale: scaleAnimation }] } : {};

    return (
      <Animated.View
        key={index}
        style={[
          cellStyles,
          animatedStyle,
        ]}
      >
        <Text
          style={[
            styles.cellText,
            {
              fontSize: sizeStyles.fontSize,
              color: getTextColor(),
            },
          ]}
        >
          {displayValue}
        </Text>
        
        {/* Cursor indicator for active cell */}
        {index === focusedIndex && !hasValue && (
          <Animated.View
            style={[
              styles.cursor,
              {
                opacity: new Animated.Value(1),
              },
            ]}
          />
        )}
      </Animated.View>
    );
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Hidden TextInput for keyboard handling */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={pin}
        onChangeText={handlePinChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType={keyboardType}
        secureTextEntry={false} // We handle masking manually
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        testID={`${testID}-input`}
      />

      {/* PIN Cells Container */}
      <Animated.View
        style={[
          styles.cellsContainer,
          {
            transform: [{ translateX: shakeAnimation }],
          },
        ]}
      >
        {Array(length)
          .fill(0)
          .map((_, index) => renderCell(index, sizeStyles))}
      </Animated.View>

      {/* Error Message */}
      {error && errorMessage && (
        <Animated.View
          style={[
            styles.messageContainer,
            styles.errorMessageContainer,
          ]}
        >
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </Animated.View>
      )}

      {/* Success Message */}
      {success && successMessage && !error && (
        <Animated.View
          style={[
            styles.messageContainer,
            styles.successMessageContainer,
          ]}
        >
          <Text style={styles.successMessage}>{successMessage}</Text>
        </Animated.View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {pin.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clear}
            testID={`${testID}-clear`}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Biometric PIN Input Component (enhanced version)
interface BiometricPINInputProps extends PINInputProps {
  biometricEnabled?: boolean;
  onBiometricPress?: () => void;
  biometricType?: 'fingerprint' | 'face' | 'both';
  showBiometricPrompt?: boolean;
}

const BiometricPINInput: React.FC<BiometricPINInputProps> = ({
  biometricEnabled = false,
  onBiometricPress,
  biometricType = 'fingerprint',
  showBiometricPrompt = true,
  ...pinInputProps
}) => {
  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'face':
        return '👤';
      case 'both':
        return '🔒';
      default:
        return '👆';
    }
  };

  const getBiometricText = () => {
    switch (biometricType) {
      case 'face':
        return 'Use Face ID';
      case 'both':
        return 'Use Biometric';
      default:
        return 'Use Fingerprint';
    }
  };

  return (
    <View style={styles.biometricContainer}>
      <PINInput {...pinInputProps} />
      
      {biometricEnabled && (
        <View style={styles.biometricSection}>
          <View style={styles.orDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={onBiometricPress}
            testID="biometric-button"
          >
            <Text style={styles.biometricIcon}>{getBiometricIcon()}</Text>
            <Text style={styles.biometricText}>{getBiometricText()}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  hiddenInput: {
    position: 'absolute',
    left: -1000,
    top: -1000,
    opacity: 0,
  },
  cellsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: '60%',
    backgroundColor: '#1B4332',
  },
  messageContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  errorMessageContainer: {
    backgroundColor: '#FFE6E6',
  },
  errorMessage: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  successMessageContainer: {
    backgroundColor: '#E8F5E8',
  },
  successMessage: {
    color: '#52B788',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  clearButtonText: {
    color: '#6C757D',
    fontSize: 14,
    fontWeight: '500',
  },
  // Biometric styles
  biometricContainer: {
    width: '100%',
    alignItems: 'center',
  },
  biometricSection: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E9ECEF',
  },
  orText: {
    paddingHorizontal: 16,
    color: '#6C757D',
    fontSize: 14,
    fontWeight: '500',
  },
  biometricButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 120,
  },
  biometricIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  biometricText: {
    color: '#1B4332',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PINInput;
export { BiometricPINInput };