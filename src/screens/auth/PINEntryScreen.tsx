import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';

interface PINEntryScreenProps {}

const PINEntryScreen: React.FC<PINEntryScreenProps> = () => {
  const navigation = useNavigation<any>();
  
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Progressive PIN delay: 30s → 2min → 5min → 15min
  const getBlockDuration = (attemptCount: number): number => {
    const delays = [0, 30, 120, 300, 900]; // seconds
    const index = Math.min(attemptCount, delays.length - 1);
    return (delays[index] || 0) * 1000; // convert to milliseconds
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    
    if (isBlocked && remainingTime > 0) {
      timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1000) {
            setIsBlocked(false);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBlocked, remainingTime]);

  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleNumberPress = (number: string) => {
    if (isBlocked || isLoading) return;
    
    if (pin.length < 4) {
      setPin(pin + number);
    }
  };

  const handleBackspace = () => {
    if (isBlocked || isLoading) return;
    setPin(pin.slice(0, -1));
  };

  const handlePINSubmit = async () => {
    if (pin.length !== 4 || isBlocked || isLoading) return;

    setIsLoading(true);
    
    try {
      // Simulate PIN verification API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, accept "1234" as correct PIN
      if (pin === '1234') {
        // Successful authentication
        setAttempts(0);
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        // Failed attempt
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');
        
        Vibration.vibrate([0, 400, 200, 400]);
        
        if (newAttempts >= 3) {
          // Block user with progressive delay
          const blockDuration = getBlockDuration(newAttempts);
          setRemainingTime(blockDuration);
          setIsBlocked(true);
          
          Alert.alert(
            'Account Temporarily Locked',
            `Too many failed attempts. Please wait ${formatTime(blockDuration)} before trying again.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Incorrect PIN',
            `Wrong PIN. ${3 - newAttempts} attempts remaining.`,
            [{ text: 'Try Again' }]
          );
        }
      }
    } catch (error) {
      Alert.alert('Authentication Error', 'Unable to verify PIN. Please try again.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPIN = () => {
    Alert.alert(
      'Reset PIN',
      'To reset your PIN, you will need to verify your identity using your registered phone number.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset PIN', 
          onPress: () => {
            navigation.navigate('Login');
          }
        }
      ]
    );
  };

  const handleBiometric = () => {
    Alert.alert('Coming Soon', 'Biometric authentication will be available in a future update.');
  };

  const renderPinDots = () => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < pin.length && styles.pinDotFilled,
              attempts > 0 && !isBlocked && styles.pinDotError
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
                  item === '' && styles.keypadButtonEmpty,
                  (isBlocked || isLoading) && styles.keypadButtonDisabled
                ]}
                onPress={() => {
                  if (item === 'backspace') {
                    handleBackspace();
                  } else if (item !== '') {
                    handleNumberPress(item);
                    // Auto-submit when 4 digits entered
                    if (pin.length === 3) {
                      setTimeout(() => handlePINSubmit(), 100);
                    }
                  }
                }}
                disabled={item === '' || isBlocked || isLoading}
              >
                {item === 'backspace' ? (
                  <Text style={[
                    styles.keypadButtonText,
                    (isBlocked || isLoading) && styles.keypadButtonTextDisabled
                  ]}>⌫</Text>
                ) : (
                  <Text style={[
                    styles.keypadButtonText,
                    (isBlocked || isLoading) && styles.keypadButtonTextDisabled
                  ]}>{item}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
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
          <View style={styles.content}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>Z2</Text>
              </View>
              <Text style={styles.appName}>Zanari</Text>
            </View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Enter your PIN</Text>
              {isBlocked ? (
                <Text style={styles.blockedText}>
                  Account locked. Try again in {formatTime(remainingTime)}
                </Text>
              ) : (
                <Text style={styles.subtitle}>
                  {attempts > 0 
                    ? `${3 - attempts} attempts remaining`
                    : 'Enter your 4-digit PIN to continue'
                  }
                </Text>
              )}
            </View>

            {/* PIN Display */}
            <View style={styles.pinSection}>
              {renderPinDots()}
              
              {isLoading && (
                <Text style={styles.loadingText}>Verifying...</Text>
              )}
            </View>

            {/* Keypad */}
            <View style={styles.keypadSection}>
              {renderKeypad()}
            </View>

            {/* Footer Actions */}
            <View style={styles.footerSection}>
              <TouchableOpacity 
                style={styles.footerButton}
                onPress={handleBiometric}
                disabled={isBlocked}
              >
                <Text style={[
                  styles.footerButtonText,
                  isBlocked && styles.footerButtonTextDisabled
                ]}>
                  👆 Use Biometrics
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.footerButton}
                onPress={handleForgotPIN}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#52B788',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'System',
  },
  appName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'System',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
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
  pinDotError: {
    backgroundColor: '#FF6B6B',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#B7E4C7',
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
  keypadButtonDisabled: {
    backgroundColor: 'rgba(183, 228, 199, 0.05)',
    opacity: 0.5,
  },
  keypadButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'System',
  },
  keypadButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 32,
  },
  footerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  footerButtonText: {
    fontSize: 14,
    color: '#52B788',
    fontWeight: '500',
    fontFamily: 'System',
  },
  footerButtonTextDisabled: {
    color: 'rgba(82, 183, 136, 0.3)',
  },
});

export default PINEntryScreen;