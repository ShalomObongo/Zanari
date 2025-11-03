import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { biometricAuthService } from '@/services/biometricAuth';
import PinVerificationModal from '@/components/PinVerificationModal';
import { useTheme } from '@/theme';
import theme from '@/theme'; // Static theme for StyleSheet

const SettingsScreen: React.FC = () => {
  // Zustand stores
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigation = useNavigation<any>();
  
  // Theme store
  const themeMode = useThemeStore((state) => state.themeMode);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const theme = useTheme();

  // Settings store
  const isBiometricEnabled = useSettingsStore((state) => state.isBiometricEnabled);
  const enableBiometric = useSettingsStore((state) => state.enableBiometric);
  const disableBiometric = useSettingsStore((state) => state.disableBiometric);
  const checkBiometricCapability = useSettingsStore((state) => state.checkBiometricCapability);
  const isEnablingBiometric = useSettingsStore((state) => state.isEnablingBiometric);
  const isDisablingBiometric = useSettingsStore((state) => state.isDisablingBiometric);
  
  // Theme selector modal
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState({
    twoFactorAuth: true,
    dataSharing: true,
    emailNotifications: true,
    smsNotifications: false,
    transactionAlerts: true,
    savingsReminders: false,
    securityAlerts: true,
    hideBalance: false,
  });

  // Biometric state
  const [biometricCapable, setBiometricCapable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const pinRequestRef = useRef<{
    resolve: (token: string) => void;
    reject: () => void;
  } | null>(null);
  
  const getThemeDisplayName = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System Default';
    }
  };

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

  // Check biometric capability on mount
  useEffect(() => {
    const checkCapability = async () => {
      try {
        const capable = await checkBiometricCapability();
        setBiometricCapable(capable);

        if (capable) {
          // Get biometric type for display
          const type = await biometricAuthService.getBiometricType();
          setBiometricType(type || 'Biometric');
        }
      } catch (error) {
        setBiometricCapable(false);
      }
    };

    checkCapability();
  }, [checkBiometricCapability]);

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
              if (user?.id) {
                useSettingsStore.getState().clearUserSettings(user.id);
              }
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

  // Request PIN for enabling biometric
  const [capturedPin, setCapturedPin] = useState<string | null>(null);

  const requestPinToken = () =>
    new Promise<string>((resolve, reject) => {
      pinRequestRef.current = { resolve, reject };
      setPinModalVisible(true);
    });

  // Handle biometric toggle
  const handleBiometricToggle = async (newValue: boolean) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    // Check if device supports biometric
    if (!biometricCapable) {
      Alert.alert(
        'Biometric Not Available',
        'Your device does not support biometric authentication or it is not set up.'
      );
      return;
    }

    if (newValue) {
      // Enabling biometric - require PIN verification first, then verify biometric works
      try {
        // Step 1: Verify PIN and capture it
        setCapturedPin(null); // Reset
        await requestPinToken();

        // Wait for PIN to be captured
        if (!capturedPin) {
          Alert.alert('Error', 'Failed to capture PIN. Please try again.');
          return;
        }

        // Step 2: Test biometric authentication to ensure it's set up and working
        // Note: We call LocalAuthentication directly here because the service's authenticate()
        // method requires biometric to already be enabled
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Verify your ${biometricType} to complete setup`,
          cancelLabel: 'Cancel',
          disableDeviceFallback: true,
        });

        if (!result.success) {
          // Biometric failed or was cancelled
          setCapturedPin(null); // Clear PIN for security
          const errorMessage = result.error === 'not_enrolled'
            ? `${biometricType} is not set up on this device. Please set it up in your device settings first.`
            : `${biometricType} verification was cancelled. Biometric authentication has not been enabled.`;

          Alert.alert('Setup Cancelled', errorMessage);
          return;
        }

        // Step 3: Store PIN with biometric protection
        await biometricAuthService.storePinForBiometric(user.id, capturedPin);

        // Step 4: Enable biometric in settings
        await enableBiometric(user.id);

        // Clear captured PIN from memory
        setCapturedPin(null);

        Alert.alert(
          'Success',
          `${biometricType} authentication has been enabled. You can now use it to unlock the app and authorize payments.`
        );
      } catch (error) {
        // PIN verification cancelled or biometric failed
        setCapturedPin(null); // Clear PIN for security
        if (error instanceof Error) {
          Alert.alert('Error', error.message || 'Failed to enable biometric authentication');
        }
      }
    } else {
      // Disabling biometric - just disable
      try {
        await disableBiometric(user.id);
        Alert.alert('Success', 'Biometric authentication has been disabled.');
      } catch (error) {
        if (error instanceof Error) {
          Alert.alert('Error', error.message || 'Failed to disable biometric authentication');
        }
      }
    }
  };

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: theme.colors.textPrimary }]}>{title}</Text>
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
        <Icon name={icon} size={24} color={themeColors.colors.textSecondary} />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement === 'switch' && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: themeColors.colors.gray200, true: themeColors.colors.accent }}
          thumbColor={themeColors.colors.surface}
          ios_backgroundColor={themeColors.colors.gray200}
        />
      )}
      {rightElement === 'arrow' && (
        <Icon name="arrow-forward-ios" size={20} color={themeColors.colors.textTertiary} />
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
      <Text style={[styles.simpleSettingTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {rightElement === 'switch' && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: themeColors.colors.gray200, true: themeColors.colors.accent }}
          thumbColor={themeColors.colors.surface}
          ios_backgroundColor={themeColors.colors.gray200}
        />
      )}
      {rightElement === 'arrow' && (
        <Icon name="arrow-forward-ios" size={20} color={themeColors.colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar barStyle={themeColors.colors.statusBarStyle} backgroundColor={themeColors.colors.surface} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.gray100 }]}>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Settings</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Section */}
          <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.profileRow}>
              <View style={[styles.avatarContainer, { backgroundColor: `${theme.colors.primary}33` }]}>
                <Text style={[styles.avatarText, { color: theme.colors.primary }]}>{getUserInitials()}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>{getUserFullName()}</Text>
                <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>{getUserEmail()}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={[styles.editProfileText, { color: theme.colors.primary }]}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Security Section */}
          {renderSectionHeader('Security')}
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSettingRow(
              'pin',
              'Change PIN',
              undefined,
              'arrow',
              undefined,
              () => navigation.navigate('ChangePIN')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSettingRow(
              'verified-user',
              'Two-Factor Authentication',
              'Add an extra layer of security',
              'switch',
              preferences.twoFactorAuth,
              undefined,
              () => togglePreference('twoFactorAuth')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSettingRow(
              'fingerprint',
              'Biometric Authentication',
              biometricCapable ? biometricType : 'Not available on this device',
              'switch',
              user?.id ? isBiometricEnabled(user.id) : false,
              undefined,
              handleBiometricToggle
            )}
          </View>

          {/* Savings Section */}
          {renderSectionHeader('Savings')}
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSettingRow(
              'savings',
              'Round-Up Savings',
              'Auto-save spare change on transactions',
              'arrow',
              undefined,
              () => navigation.navigate('RoundUpSettings')
            )}
          </View>

          {/* Appearance Section */}
          {renderSectionHeader('Appearance')}
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSettingRow(
              'palette',
              'Theme',
              getThemeDisplayName(themeMode),
              'arrow',
              undefined,
              () => setThemeModalVisible(true)
            )}
          </View>

          {/* Privacy Section */}
          {renderSectionHeader('Privacy')}
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSettingRow(
              'share',
              'Data Sharing Preferences',
              undefined,
              'switch',
              preferences.dataSharing,
              undefined,
              () => togglePreference('dataSharing')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSettingRow(
              'history',
              'Session Management',
              undefined,
              'arrow',
              undefined,
              () => Alert.alert('Session Management', 'Feature coming soon')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
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
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSimpleSettingRow(
              'Email',
              'switch',
              preferences.emailNotifications,
              undefined,
              () => togglePreference('emailNotifications')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSimpleSettingRow(
              'SMS',
              'switch',
              preferences.smsNotifications,
              undefined,
              () => togglePreference('smsNotifications')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSimpleSettingRow(
              'Transaction Alerts',
              'switch',
              preferences.transactionAlerts,
              undefined,
              () => togglePreference('transactionAlerts')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSimpleSettingRow(
              'Savings Reminders',
              'switch',
              preferences.savingsReminders,
              undefined,
              () => togglePreference('savingsReminders')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSimpleSettingRow(
              'Security Alerts',
              'switch',
              preferences.securityAlerts,
              undefined,
              () => togglePreference('securityAlerts')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
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
          <View style={[styles.section, { backgroundColor: theme.colors.gray50 }]}>
            {renderSimpleSettingRow(
              'Privacy Policy',
              'arrow',
              undefined,
              () => Alert.alert('Privacy Policy', 'Opening privacy policy...')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
            {renderSimpleSettingRow(
              'Terms of Service',
              'arrow',
              undefined,
              () => Alert.alert('Terms of Service', 'Opening terms...')
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.gray100 }]} />
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
            <Text style={[styles.versionText, { color: theme.colors.textTertiary }]}>App Version 1.2.3</Text>
          </View>
        </ScrollView>

        {/* PIN Verification Modal for enabling biometric */}
        <PinVerificationModal
          visible={pinModalVisible}
          onSuccess={(token) => {
            setPinModalVisible(false);
            if (pinRequestRef.current) {
              pinRequestRef.current.resolve(token);
              pinRequestRef.current = null;
            }
          }}
          onCancel={() => {
            setPinModalVisible(false);
            setCapturedPin(null);
            if (pinRequestRef.current) {
              pinRequestRef.current.reject();
              pinRequestRef.current = null;
            }
          }}
          onPinEntered={(pin) => {
            // Capture PIN for biometric storage
            setCapturedPin(pin);
          }}
          message="Verify your PIN to enable biometric authentication"
        />

        {/* Theme Selector Modal */}
        <Modal
          visible={themeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setThemeModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setThemeModalVisible(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Choose Theme
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: theme.colors.border },
                  themeMode === 'light' && { 
                    backgroundColor: `${theme.colors.accent}15`,
                    borderColor: theme.colors.accent 
                  }
                ]}
                onPress={() => {
                  setThemeMode('light');
                  setThemeModalVisible(false);
                }}
              >
                <Icon name="wb-sunny" size={24} color={themeColors.colors.textPrimary} />
                <Text style={[styles.themeOptionText, { color: theme.colors.textPrimary }]}>
                  Light Mode
                </Text>
                {themeMode === 'light' && (
                  <Icon name="check" size={24} color={themeColors.colors.accent} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: theme.colors.border },
                  themeMode === 'dark' && { 
                    backgroundColor: `${theme.colors.accent}15`,
                    borderColor: theme.colors.accent 
                  }
                ]}
                onPress={() => {
                  setThemeMode('dark');
                  setThemeModalVisible(false);
                }}
              >
                <Icon name="nights-stay" size={24} color={themeColors.colors.textPrimary} />
                <Text style={[styles.themeOptionText, { color: theme.colors.textPrimary }]}>
                  Dark Mode
                </Text>
                {themeMode === 'dark' && (
                  <Icon name="check" size={24} color={themeColors.colors.accent} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: theme.colors.border },
                  themeMode === 'system' && { 
                    backgroundColor: `${theme.colors.accent}15`,
                    borderColor: theme.colors.accent 
                  }
                ]}
                onPress={() => {
                  setThemeMode('system');
                  setThemeModalVisible(false);
                }}
              >
                <Icon name="phone-android" size={24} color={themeColors.colors.textPrimary} />
                <Text style={[styles.themeOptionText, { color: theme.colors.textPrimary }]}>
                  System Default
                </Text>
                {themeMode === 'system' && (
                  <Icon name="check" size={24} color={themeColors.colors.accent} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.colors.gray100 }]}
                onPress={() => setThemeModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textPrimary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
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
    paddingBottom: theme.layout.tabBarBottomPadding,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.base,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.fontSizes.xl,
    fontFamily: theme.fonts.bold,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    gap: theme.spacing.md,
  },
  themeOptionText: {
    flex: 1,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
  },
  cancelButton: {
    padding: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.medium,
  },
});

export default SettingsScreen;
