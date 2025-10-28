import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import theme from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatKenyanPhoneNumber = (input: string) => {
  const cleaned = input.replace(/\D/g, '');

  if (cleaned.startsWith('254')) {
    return cleaned.slice(0, 12);
  }

  if (cleaned.startsWith('0')) {
    return `254${cleaned.substring(1, 12)}`.slice(0, 12);
  }

  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return `254${cleaned}`.slice(0, 12);
  }

  return cleaned.slice(0, 12);
};

const isValidKenyanPhone = (value: string) => /^254(7[0-9]{8}|1[0-9]{8})$/.test(value);

const MIN_NAME_LENGTH = 2;

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isUpdatingProfile = useAuthStore((state) => state.isUpdatingProfile);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user.first_name ?? '');
    setLastName(user.last_name ?? '');
    setEmail(user.email ?? '');
    setPhoneNumber(user.phone ?? '');
  }, [user?.id]);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = useMemo(() => formatKenyanPhoneNumber(phoneNumber), [phoneNumber]);

  useEffect(() => {
    if (phoneNumber !== normalizedPhone) {
      setPhoneNumber(normalizedPhone);
    }
  }, [normalizedPhone]);

  const hasChanges = useMemo(() => {
    if (!user) {
      return false;
    }

    return (
      firstName.trim() !== (user.first_name ?? '') ||
      lastName.trim() !== (user.last_name ?? '') ||
      normalizedEmail !== (user.email ?? '') ||
      normalizedPhone !== (user.phone ?? '')
    );
  }, [firstName, lastName, normalizedEmail, normalizedPhone, user]);

  const isFormValid = useMemo(() => {
    return (
      firstName.trim().length >= MIN_NAME_LENGTH &&
      lastName.trim().length >= MIN_NAME_LENGTH &&
      EMAIL_REGEX.test(normalizedEmail) &&
      isValidKenyanPhone(normalizedPhone)
    );
  }, [firstName, lastName, normalizedEmail, normalizedPhone]);

  const canSave = isFormValid && hasChanges && !isUpdatingProfile;

  const handleBack = () => {
    navigation.goBack();
  };

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(formatKenyanPhoneNumber(value));
  };

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length < MIN_NAME_LENGTH) {
      Alert.alert('Invalid First Name', 'Please enter at least 2 characters for your first name.');
      return;
    }

    if (trimmedLast.length < MIN_NAME_LENGTH) {
      Alert.alert('Invalid Last Name', 'Please enter at least 2 characters for your last name.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!isValidKenyanPhone(normalizedPhone)) {
      Alert.alert('Invalid Phone Number', 'Enter a valid Kenyan mobile number (2547XXXXXXXX).');
      return;
    }

    try {
      await updateProfile({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: normalizedEmail,
        phone: normalizedPhone,
      });

      Alert.alert('Profile Updated', 'Your profile information has been saved successfully.', [
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message
            ? error.message
            : 'Unable to update your profile. Please try again.';
      Alert.alert('Update Failed', message);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.backgroundLight} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityLabel="Go back">
              <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <Text style={styles.sectionSubtitle}>
                Keep your contact details up to date so we can reach you when it matters.
              </Text>
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter your first name"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter your last name"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <View style={[styles.inputGroup, styles.lastInputGroup]}>
                <View style={styles.labelRow}>
                  <Text style={[styles.inputLabel, styles.inlineLabel]}>Phone Number</Text>
                  <Text style={styles.helperLabel}>Kenyan MSISDN (2547XXXXXXXX)</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  placeholder="2547XXXXXXXX"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  maxLength={12}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, (!canSave || isUpdatingProfile) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave || isUpdatingProfile}
              testID="edit-profile-save-button"
            >
              {isUpdatingProfile ? (
                <ActivityIndicator color={theme.colors.onPrimaryText} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundLight,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray100,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.semiBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionHeading: {
    marginTop: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  lastInputGroup: {
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inputLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  inlineLabel: {
    marginBottom: 0,
  },
  helperLabel: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.disabled,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 16,
    color: theme.colors.onPrimaryText,
  },
});

export default EditProfileScreen;
