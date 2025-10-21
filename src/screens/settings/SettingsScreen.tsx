import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';

const SettingsScreen: React.FC = () => {
  // Zustand stores  
  const user = useAuthStore((state) => state.user);
  const setupPin = useAuthStore((state) => state.setupPin);
  const logout = useAuthStore((state) => state.logout);
  
  // State management
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // User profile state
  const [userProfile, setUserProfile] = useState({
    name: user ? `${user.first_name} ${user.last_name}` : '',
    email: user?.email || '',
    phone: user?.phone || '',
    kycStatus: user?.kyc_status || 'not_started',
  });
  
  // Preferences state
  const [preferences, setPreferences] = useState({
    notifications: {
      pushEnabled: user?.notification_preferences?.push_enabled ?? true,
      emailEnabled: user?.notification_preferences?.email_enabled ?? true,
      smsEnabled: false,
      transactionAlerts: user?.notification_preferences?.transaction_alerts ?? true,
      savingsReminders: user?.notification_preferences?.savings_milestones ?? true,
      securityAlerts: true,
    },
    security: {
      twoFactorEnabled: false,
      pinLength: 4,
    },
    privacy: {
      biometricEnabled: false,
      autoLogoutTime: 15,
      hideBalance: false,
      dataSharing: false,
    },
    display: {
      theme: 'light' as 'light' | 'dark' | 'system',
      language: 'en' as 'en' | 'sw',
      currency: 'KES',
      showDecimals: true,
    },
  });
  
  // Helper to update nested preferences
  const updatePreference = <T extends keyof typeof preferences>(
    category: T,
    key: keyof typeof preferences[T],
    value: any
  ) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };
  
  // Simplified preferences (could be expanded with backend API)
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notification_preferences?.push_enabled ?? true
  );

  // PIN change form state
  const [pinForm, setPinForm] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: '',
  });

  // Helper functions
  const getKycStatusDisplay = () => {
    const status = user?.kyc_status || 'not_started';
    const statusMap = {
      not_started: { text: 'Not Started', color: '#999999' },
      pending: { text: 'Pending Review', color: '#FF8C00' },
      approved: { text: 'Verified', color: '#2D6A4F' },
      rejected: { text: 'Rejected', color: '#FF4444' },
    };
    return statusMap[status] || statusMap.not_started;
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
              // Clear all store data
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

  const handleChangePin = async () => {
    if (!pinForm.currentPin || !pinForm.newPin || !pinForm.confirmPin) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (pinForm.newPin !== pinForm.confirmPin) {
      Alert.alert('Error', 'New PIN and confirmation do not match');
      return;
    }

    if (pinForm.newPin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }

    setIsLoading(true);
    try {
      await setupPin({ pin: pinForm.newPin, confirmPin: pinForm.confirmPin });
      
      setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
      setShowChangePinModal(false);
      Alert.alert('Success', 'PIN changed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to change PIN. Please try again.');
      console.error('Change PIN error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setShowDeleteAccountModal(true);
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement account deletion API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Account Deleted', 'Your account has been deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsLoading(false);
      setShowDeleteAccountModal(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you would like to contact our support team:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email', onPress: () => Alert.alert('Email', 'Opening email client...') },
        { text: 'Phone', onPress: () => Alert.alert('Phone', 'Calling support...') },
        { text: 'Live Chat', onPress: () => Alert.alert('Live Chat', 'Opening live chat...') },
      ]
    );
  };

  const renderSettingItem = (
    title: string,
    subtitle?: string,
    rightComponent?: React.ReactNode,
    onPress?: () => void,
    showArrow?: boolean
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingItemContent}>
        <View style={styles.settingItemText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.settingItemRight}>
          {rightComponent}
          {showArrow && <Text style={styles.settingArrow}>›</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSwitchItem = (
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => renderSettingItem(
    title,
    subtitle,
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E9ECEF', true: '#B7E4C7' }}
      thumbColor={value ? '#52B788' : '#FFFFFF'}
      ios_backgroundColor="#E9ECEF"
    />
  );

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        {renderSectionHeader('Profile')}
        <View style={styles.section}>
          {renderSettingItem(
            userProfile.name,
            `${userProfile.email} • ${userProfile.phone}`,
            <View style={styles.kycBadge}>
              <Text style={styles.kycBadgeText}>
                {userProfile.kycStatus === 'approved' ? '✓ Verified' : 'Pending'}
              </Text>
            </View>,
            () => setShowProfileModal(true),
            true
          )}
        </View>

        {/* Notifications */}
        {renderSectionHeader('Notifications')}
        <View style={styles.section}>
          {renderSwitchItem(
            'Push Notifications',
            'Receive notifications on your device',
            preferences.notifications.pushEnabled,
            (value) => updatePreference('notifications', 'pushEnabled', value)
          )}
          {renderSwitchItem(
            'Email Notifications',
            'Receive notifications via email',
            preferences.notifications.emailEnabled,
            (value) => updatePreference('notifications', 'emailEnabled', value)
          )}
          {renderSwitchItem(
            'SMS Notifications',
            'Receive notifications via SMS',
            preferences.notifications.smsEnabled,
            (value) => updatePreference('notifications', 'smsEnabled', value)
          )}
          {renderSwitchItem(
            'Transaction Alerts',
            'Get notified for all transactions',
            preferences.notifications.transactionAlerts,
            (value) => updatePreference('notifications', 'transactionAlerts', value)
          )}
          {renderSwitchItem(
            'Savings Reminders',
            'Reminders to save towards your goals',
            preferences.notifications.savingsReminders,
            (value) => updatePreference('notifications', 'savingsReminders', value)
          )}
          {renderSwitchItem(
            'Security Alerts',
            'Important security notifications',
            preferences.notifications.securityAlerts,
            (value) => updatePreference('notifications', 'securityAlerts', value)
          )}
        </View>

        {/* Security & Privacy */}
        {renderSectionHeader('Security & Privacy')}
        <View style={styles.section}>
          {renderSwitchItem(
            'Biometric Authentication',
            'Use fingerprint or Face ID to sign in',
            preferences.privacy.biometricEnabled,
            (value) => updatePreference('privacy', 'biometricEnabled', value)
          )}
          {renderSwitchItem(
            'Two-Factor Authentication',
            'Add extra security to your account',
            preferences.security.twoFactorEnabled,
            (value) => updatePreference('security', 'twoFactorEnabled', value)
          )}
          {renderSettingItem(
            'Change PIN',
            'Update your transaction PIN',
            undefined,
            () => setShowChangePinModal(true),
            true
          )}
          {renderSettingItem(
            'Auto-Lock Timer',
            `Lock app after ${preferences.privacy.autoLogoutTime} minutes of inactivity`,
            <Text style={styles.settingValue}>{preferences.privacy.autoLogoutTime}m</Text>,
            () => {
              Alert.alert(
                'Auto-Lock Timer',
                'Select auto-lock duration:',
                [
                  { text: '5 minutes', onPress: () => updatePreference('privacy', 'autoLogoutTime', 5) },
                  { text: '15 minutes', onPress: () => updatePreference('privacy', 'autoLogoutTime', 15) },
                  { text: '30 minutes', onPress: () => updatePreference('privacy', 'autoLogoutTime', 30) },
                  { text: '1 hour', onPress: () => updatePreference('privacy', 'autoLogoutTime', 60) },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            },
            true
          )}
          {renderSwitchItem(
            'Hide Balance',
            'Hide balance on dashboard by default',
            preferences.privacy.hideBalance,
            (value) => updatePreference('privacy', 'hideBalance', value)
          )}
          {renderSwitchItem(
            'Data Sharing',
            'Share anonymized data for app improvement',
            preferences.privacy.dataSharing,
            (value) => updatePreference('privacy', 'dataSharing', value)
          )}
        </View>

        {/* Display & Language */}
        {renderSectionHeader('Display & Language')}
        <View style={styles.section}>
          {renderSettingItem(
            'Theme',
            `Currently using ${preferences.display.theme} theme`,
            <Text style={styles.settingValue}>{preferences.display.theme}</Text>,
            () => {
              Alert.alert(
                'Theme',
                'Select theme preference:',
                [
                  { text: 'Light', onPress: () => updatePreference('display', 'theme', 'light') },
                  { text: 'Dark', onPress: () => updatePreference('display', 'theme', 'dark') },
                  { text: 'System', onPress: () => updatePreference('display', 'theme', 'system') },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            },
            true
          )}
          {renderSettingItem(
            'Language',
            preferences.display.language === 'en' ? 'English' : 'Kiswahili',
            <Text style={styles.settingValue}>{preferences.display.language === 'en' ? 'EN' : 'SW'}</Text>,
            () => {
              Alert.alert(
                'Language',
                'Select language:',
                [
                  { text: 'English', onPress: () => updatePreference('display', 'language', 'en') },
                  { text: 'Kiswahili', onPress: () => updatePreference('display', 'language', 'sw') },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            },
            true
          )}
          {renderSettingItem(
            'Currency',
            `Display amounts in ${preferences.display.currency}`,
            <Text style={styles.settingValue}>{preferences.display.currency}</Text>,
            () => {
              Alert.alert(
                'Currency',
                'Select display currency:',
                [
                  { text: 'Kenyan Shilling (KES)', onPress: () => updatePreference('display', 'currency', 'KES') },
                  { text: 'US Dollar (USD)', onPress: () => updatePreference('display', 'currency', 'USD') },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            },
            true
          )}
          {renderSwitchItem(
            'Show Decimals',
            'Display decimal places in amounts',
            preferences.display.showDecimals,
            (value) => updatePreference('display', 'showDecimals', value)
          )}
        </View>

        {/* Support & About */}
        {renderSectionHeader('Support & About')}
        <View style={styles.section}>
          {renderSettingItem(
            'Contact Support',
            'Get help with your account',
            undefined,
            handleContactSupport,
            true
          )}
          {renderSettingItem(
            'FAQ',
            'Frequently asked questions',
            undefined,
            () => Alert.alert('FAQ', 'Opening FAQ page...'),
            true
          )}
          {renderSettingItem(
            'Privacy Policy',
            'Read our privacy policy',
            undefined,
            () => Alert.alert('Privacy Policy', 'Opening privacy policy...'),
            true
          )}
          {renderSettingItem(
            'Terms of Service',
            'Read our terms of service',
            undefined,
            () => Alert.alert('Terms of Service', 'Opening terms of service...'),
            true
          )}
          {renderSettingItem(
            'About',
            'App version 1.0.0 (Build 100)',
            undefined,
            () => Alert.alert(
              'About Zanari',
              'Version 1.0.0 (Build 100)\n\nZanari is your trusted financial companion for savings, payments, and financial growth.\n\n© 2024 Zanari Financial Services'
            )
          )}
        </View>

        {/* Account Actions */}
        {renderSectionHeader('Account')}
        <View style={styles.section}>
          {renderSettingItem(
            'Sign Out',
            'Sign out of your account',
            undefined,
            handleLogout
          )}
          {renderSettingItem(
            'Delete Account',
            'Permanently delete your account',
            undefined,
            handleDeleteAccount
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Change PIN Modal */}
      <Modal
        visible={showChangePinModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowChangePinModal(false);
                  setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Change PIN</Text>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleChangePin}
                disabled={isLoading}
              >
                <Text style={styles.modalSaveText}>
                  {isLoading ? 'Changing...' : 'Change'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pinChangeForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinForm.currentPin}
                  onChangeText={(text) => setPinForm(prev => ({ ...prev, currentPin: text.replace(/[^0-9]/g, '') }))}
                  placeholder="Enter current PIN"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={preferences.security.pinLength}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinForm.newPin}
                  onChangeText={(text) => setPinForm(prev => ({ ...prev, newPin: text.replace(/[^0-9]/g, '') }))}
                  placeholder="Enter new PIN"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={preferences.security.pinLength}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Confirm New PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinForm.confirmPin}
                  onChangeText={(text) => setPinForm(prev => ({ ...prev, confirmPin: text.replace(/[^0-9]/g, '') }))}
                  placeholder="Confirm new PIN"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={preferences.security.pinLength}
                />
              </View>

              <Text style={styles.pinHint}>
                PIN must be {preferences.security.pinLength} digits long
              </Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => {
                  setShowProfileModal(false);
                  Alert.alert('Success', 'Profile updated successfully');
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.profileForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={userProfile.name}
                  onChangeText={(text) => setUserProfile(prev => ({ ...prev, name: text }))}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  value={userProfile.email}
                  onChangeText={(text) => setUserProfile(prev => ({ ...prev, email: text }))}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  value={userProfile.phone}
                  onChangeText={(text) => setUserProfile(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.kycStatusContainer}>
                <Text style={styles.kycStatusLabel}>KYC Status</Text>
                <View style={[styles.kycStatusBadge, { backgroundColor: userProfile.kycStatus === 'approved' ? '#B7E4C7' : '#FFF3CD' }]}>
                  <Text style={[styles.kycStatusText, { color: userProfile.kycStatus === 'approved' ? '#1B4332' : '#856404' }]}>
                    {userProfile.kycStatus === 'approved' ? '✓ Verified' : '⏳ Pending Verification'}
                  </Text>
                </View>
                {userProfile.kycStatus !== 'approved' && (
                  <TouchableOpacity style={styles.uploadKycButton}>
                    <Text style={styles.uploadKycButtonText}>Upload Documents</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Account</Text>
            <Text style={styles.deleteModalText}>
              This action cannot be undone. All your data, including transaction history, savings goals, and personal information will be permanently deleted.
            </Text>
            <Text style={styles.deleteModalWarning}>
              Type "DELETE" to confirm:
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="Type DELETE"
              placeholderTextColor="#999"
            />
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setShowDeleteAccountModal(false)}
              >
                <Text style={styles.deleteCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={confirmDeleteAccount}
                disabled={isLoading}
              >
                <Text style={styles.deleteConfirmButtonText}>
                  {isLoading ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingItemText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1B4332',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6C757D',
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    color: '#6C757D',
    marginRight: 8,
  },
  settingArrow: {
    fontSize: 18,
    color: '#CED4DA',
    marginLeft: 8,
  },
  kycBadge: {
    backgroundColor: '#B7E4C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycBadgeText: {
    fontSize: 12,
    color: '#1B4332',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalCancelButton: {
    padding: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6C757D',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B4332',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: 16,
    color: '#52B788',
    fontWeight: '600',
  },
  pinChangeForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 8,
  },
  pinInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: '#1B4332',
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinHint: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 16,
  },
  profileForm: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1B4332',
  },
  kycStatusContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  kycStatusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 12,
  },
  kycStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  kycStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadKycButton: {
    backgroundColor: '#52B788',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  uploadKycButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteModalText: {
    fontSize: 16,
    color: '#1B4332',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  deleteModalWarning: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#DC3545',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default SettingsScreen;