import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@/theme';
import theme from '@/theme'; // Static theme for StyleSheet

const { width, height } = Dimensions.get('window');

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  iconBgColor: string;
  textPrimary: string;
  textSecondary: string;
  surface: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ 
  icon, 
  title, 
  description, 
  iconBgColor, 
  textPrimary, 
  textSecondary,
  surface 
}) => (
  <View style={[styles.featureItem, { backgroundColor: surface }]}>
    <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
      <Icon name={icon} size={24} color="#FFFFFF" />
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={[styles.featureTitle, { color: textPrimary }]}>{title}</Text>
      <Text style={[styles.featureDescription, { color: textSecondary }]}>{description}</Text>
    </View>
  </View>
);

interface WelcomeScreenProps {}

const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
  const navigation = useNavigation<any>();
  const themeColors = useTheme();

  return (
    <>
      <StatusBar barStyle={themeColors.colors.statusBarStyle} backgroundColor={themeColors.colors.backgroundLight} />
      <View style={[styles.container, { backgroundColor: themeColors.colors.backgroundLight }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={themeColors.gradients.welcome}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientHeader}
          />

          {/* Logo and Tagline */}
          <View style={styles.headerContent}>
            <Text style={[styles.appName, { color: themeColors.colors.textPrimary }]}>Zanari</Text>
            <Text style={[styles.tagline, { color: themeColors.colors.textSecondary }]}>
              Smart and simple banking at your fingertips.
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <FeatureItem
              icon="savings"
              title="Automated Savings"
              description="Effortlessly save with round-ups on every transaction."
              iconBgColor={themeColors.colors.accent}
              textPrimary={themeColors.colors.textPrimary}
              textSecondary={themeColors.colors.textSecondary}
              surface={themeColors.colors.surface}
            />
            <FeatureItem
              icon="shield"
              title="Secure Payments"
              description="Your transactions are always protected with top-tier security."
              iconBgColor={themeColors.colors.accentDarker}
              textPrimary={themeColors.colors.textPrimary}
              textSecondary={themeColors.colors.textSecondary}
              surface={themeColors.colors.surface}
            />
            <FeatureItem
              icon="verified-user"
              title="Quick Verification"
              description="Get verified in minutes with our streamlined KYC process."
              iconBgColor={themeColors.colors.accentDarkest}
              textPrimary={themeColors.colors.textPrimary}
              textSecondary={themeColors.colors.textSecondary}
              surface={themeColors.colors.surface}
            />
            <FeatureItem
              icon="wifi-off"
              title="Offline Access"
              description="Access your essential account information, even without internet."
              iconBgColor={themeColors.colors.primary}
              textPrimary={themeColors.colors.textPrimary}
              textSecondary={themeColors.colors.textSecondary}
              surface={themeColors.colors.surface}
            />
          </View>

          {/* Spacer for button area */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action Buttons - Fixed at bottom */}
        <View style={[styles.buttonContainer, { backgroundColor: themeColors.colors.backgroundLight }]}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: themeColors.colors.primary }]}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: themeColors.colors.onPrimaryText }]}>
              Get Started
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: themeColors.colors.primary }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gradientHeader: {
    width: '100%',
    height: Math.min(320, height * 0.36),
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  headerContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.base,
    alignItems: 'center',
  },
  appName: {
    fontSize: theme.fontSizes['4xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    minHeight: 72,
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.base,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
    lineHeight: 20,
  },
  featureDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.backgroundLight,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.base,
    borderTopWidth: 0,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.lg,
  },
  primaryButtonText: {
    color: theme.colors.onPrimaryText,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    height: 48,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.bold,
  },
});

export default WelcomeScreen;
