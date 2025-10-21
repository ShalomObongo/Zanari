import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface WelcomeScreenProps {}

const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
  const navigation = useNavigation<any>();

  const handleGetStarted = () => {
    navigation.navigate('Signup');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1B4332" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Logo/Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>Z2</Text>
            </View>
            <Text style={styles.title}>Zanari</Text>
            <Text style={styles.subtitle}>Smart Savings, Seamless Payments</Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🪙</Text>
              </View>
              <Text style={styles.featureTitle}>Auto Round-Up</Text>
              <Text style={styles.featureText}>Save spare change automatically with every transaction</Text>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>📱</Text>
              </View>
              <Text style={styles.featureTitle}>Mobile Money</Text>
              <Text style={styles.featureText}>Send, receive, and pay bills with M-Pesa integration</Text>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🎯</Text>
              </View>
              <Text style={styles.featureTitle}>Savings Goals</Text>
              <Text style={styles.featureText}>Set and track your financial goals effortlessly</Text>
            </View>
          </View>

          {/* CTA Buttons */}
          <View style={styles.buttonSection}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignIn}>
              <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Secure • Trusted • Licensed</Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B4332', // Deep emerald green
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 60,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#52B788',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'System',
  },
  title: {
    fontSize: 32,
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
  featuresSection: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 40,
  },
  feature: {
    alignItems: 'center',
    marginBottom: 36,
    paddingHorizontal: 20,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(183, 228, 199, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconText: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  featureText: {
    fontSize: 14,
    color: '#B7E4C7',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'System',
  },
  buttonSection: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#52B788',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#B7E4C7',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  footerText: {
    color: '#95D5B2',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'System',
  },
});

export default WelcomeScreen;