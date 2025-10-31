import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';
import theme from '@/theme';

const SettingsScreen: React.FC = () => {
  // Zustand stores
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigation = useNavigation<any>();

  // Preferences state
  const [preferences, setPreferences] = useState({
    twoFactorAuth: true,
    biometricAuth: false,
    dataSharing: true,
    emailNotifications: true,
    smsNotifications: false,
    transactionAlerts: true,
    savingsReminders: false,
    securityAlerts: true,
    hideBalance: false,
  });

  // Get user initials
  const getUserInitials = () => {
    if (!user) return 'JD';
    const firstInitial = user.first_name?.charAt(0) || '';
    const lastInitial = user.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'JD';
  };

  const getUserFullName = () => {
    if (!user) return 'John Doe';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'John Doe';
  };

  const getUserEmail = () => {
    return user?.email || 'john.doe@email.com';
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              useWalletStore.getState().reset();
              useTransactionStore.getState().resetTransactions();
              useSavingsStore.getState().resetGoals();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderSettingRow = (
    icon: string,
    title: string,
    subtitle?: string,
    rightElement?: 'arrow' | 'switch',
    switchValue?: boolean,
    onPress?: () => void,
    onSwitchChange?: (value: boolean) => void
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={rightElement === 'arrow' ? onPress : undefined}
      disabled={rightElement !== 'arrow'}
      activeOpacity={rightElement === 'arrow' ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={theme.colors.textSecondary} />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement === 'switch' && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.colors.gray200, true: theme.colors.accent }}
          thumbColor={theme.colors.surface}
          ios_backgroundColor={theme.colors.gray200}
        />
      )}
      {rightElement === 'arrow' && (
        <Icon name="arrow-forward-ios" size={20} color={theme.colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  const renderSimpleSettingRow = (
    title: string,
    rightElement: 'arrow' | 'switch',
    switchValue?: boolean,
    onPress?: () => void,
    onSwitchChange?: (value: boolean) => void
  ) => (
    <TouchableOpacity
      style={styles.simpleSettingRow}
      onPress={rightElement === 'arrow' ? onPress : undefined}
      disabled={rightElement !== 'arrow'}
      activeOpacity={rightElement === 'arrow' ? 0.7 : 1}
    >
      <Text style={styles.simpleSettingTitle}>{title}</Text>
      {rightElement === 'switch' && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.colors.gray200, true: theme.colors.accent }}
          thumbColor={theme.colors.surface}
          ios_backgroundColor={theme.colors.gray200}
        />
      )}
      {rightElement === 'arrow' && (
        <Icon name="arrow-forward-ios" size={20} color={theme.colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileRow}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{getUserInitials()}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{getUserFullName()}</Text>
                <Text style={styles.profileEmail}>{getUserEmail()}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Security Section */}
          {renderSectionHeader('Security')}
          <View style={styles.section}>
            {renderSettingRow(
              'pin',
              'Change PIN',
              undefined,
              'arrow',
              undefined,
              () => navigation.navigate('ChangePIN')
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              'verified-user',
              'Two-Factor Authentication',
              'Add an extra layer of security',
              'switch',
              preferences.twoFactorAuth,
              undefined,
              () => togglePreference('twoFactorAuth')
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              'fingerprint',
              'Biometric Authentication',
              undefined,
              'switch',
              preferences.biometricAuth,
              undefined,
              () => togglePreference('biometricAuth')
            )}
          </View>

          {/* Savings Section */}
          {renderSectionHeader('Savings')}
          <View style={styles.section}>
            {renderSettingRow(
              'savings',
              'Round-Up Savings',
              'Auto-save spare change on transactions',
              'arrow',
              undefined,
              () => navigation.navigate('RoundUpSettings')
            )}
          </View>

          {/* Privacy Section */}
          {renderSectionHeader('Privacy')}
          <View style={styles.section}>
            {renderSettingRow(
              'share',
              'Data Sharing Preferences',
              undefined,
              'switch',
              preferences.dataSharing,
              undefined,
              () => togglePreference('dataSharing')
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              'history',
              'Session Management',
              undefined,
              'arrow',
              undefined,
              () => Alert.alert('Session Management', 'Feature coming soon')
            )}
            <View style={styles.divider} />
            {renderSettingRow(
              'devices',
              'Manage Connected Devices',
              undefined,
              'arrow',
              undefined,
              () => Alert.alert('Connected Devices', 'Feature coming soon')
            )}
          </View>

          {/* Notifications Section */}
          {renderSectionHeader('Notifications')}
          <View style={styles.section}>
            {renderSimpleSettingRow(
              'Email',
              'switch',
              preferences.emailNotifications,
              undefined,
              () => togglePreference('emailNotifications')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'SMS',
              'switch',
              preferences.smsNotifications,
              undefined,
              () => togglePreference('smsNotifications')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Transaction Alerts',
              'switch',
              preferences.transactionAlerts,
              undefined,
              () => togglePreference('transactionAlerts')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Savings Reminders',
              'switch',
              preferences.savingsReminders,
              undefined,
              () => togglePreference('savingsReminders')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Security Alerts',
              'switch',
              preferences.securityAlerts,
              undefined,
              () => togglePreference('securityAlerts')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Hide Balance by Default',
              'switch',
              preferences.hideBalance,
              undefined,
              () => togglePreference('hideBalance')
            )}
          </View>

          {/* About Section */}
          {renderSectionHeader('About')}
          <View style={styles.section}>
            {renderSimpleSettingRow(
              'Privacy Policy',
              'arrow',
              undefined,
              () => Alert.alert('Privacy Policy', 'Opening privacy policy...')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Terms of Service',
              'arrow',
              undefined,
              () => Alert.alert('Terms of Service', 'Opening terms...')
            )}
            <View style={styles.divider} />
            {renderSimpleSettingRow(
              'Help & Support',
              'arrow',
              undefined,
              () => Alert.alert('Help & Support', 'Opening support...')
            )}
          </View>

          {/* Sign Out Button */}
          <View style={styles.signOutContainer}>
            <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>App Version 1.2.3</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  profileSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.base,
    marginBottom: theme.spacing['2xl'],
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${theme.colors.primary}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
    color: theme.colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  editProfileButton: {
    alignSelf: 'flex-end',
  },
  editProfileText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.primary,
  },
  sectionHeader: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.base,
    letterSpacing: -0.5,
  },
  section: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing['2xl'],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    minHeight: 72,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.base,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: theme.colors.textPrimary,
  },
  settingSubtitle: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  simpleSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    minHeight: 56,
  },
  simpleSettingTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray100,
    marginHorizontal: theme.spacing.base,
  },
  signOutContainer: {
    marginTop: theme.spacing['2xl'],
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  signOutButton: {
    width: '100%',
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
    color: '#EF4444',
  },
  versionText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textTertiary,
  },
});

export default SettingsScreen;
