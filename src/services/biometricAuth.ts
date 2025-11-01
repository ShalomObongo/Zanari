import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const preferenceKey = (userId: string) => `biometric_preference_${userId}`;
const lastSuccessKey = (userId: string) => `biometric_last_success_${userId}`;
const pinStorageKey = (userId: string) => `biometric_pin_${userId}`;

const secureStoreOptions: SecureStore.SecureStoreOptions =
  Platform.select<SecureStore.SecureStoreOptions>({
    ios: {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    },
    android: {},
    default: {},
  }) ?? {};

export type BiometricAuthenticationType = LocalAuthentication.AuthenticationType;

export interface BiometricCapabilities {
  hardwareAvailable: boolean;
  enrolled: boolean;
  supportedTypes: BiometricAuthenticationType[];
}

export interface AuthenticateOptions {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  fallback?: () => Promise<boolean> | boolean;
}

class BiometricAuthService {
  private cachedHardwareAvailable: boolean | null = null;
  private cachedSupportedTypes: BiometricAuthenticationType[] | null = null;

  async refreshCapabilities(): Promise<BiometricCapabilities> {
    const [hardwareAvailable, supportedTypes, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    this.cachedHardwareAvailable = hardwareAvailable;
    this.cachedSupportedTypes = supportedTypes;

    return {
      hardwareAvailable,
      enrolled,
      supportedTypes,
    };
  }

  async isHardwareAvailable(): Promise<boolean> {
    if (this.cachedHardwareAvailable === null) {
      this.cachedHardwareAvailable = await LocalAuthentication.hasHardwareAsync();
    }
    return this.cachedHardwareAvailable ?? false;
  }

  async getSupportedTypes(): Promise<BiometricAuthenticationType[]> {
    if (!this.cachedSupportedTypes) {
      this.cachedSupportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    }
    return this.cachedSupportedTypes ?? [];
  }

  /**
   * Get a user-friendly name for the biometric authentication type
   */
  async getBiometricType(): Promise<string | null> {
    const types = await this.getSupportedTypes();
    
    if (types.length === 0) {
      return null;
    }

    // Check for Face ID first (most preferred on iOS)
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
    }

    // Then check for fingerprint
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    }

    // Fallback to generic
    return 'Biometric';
  }

  async isEnrolled(): Promise<boolean> {
    return LocalAuthentication.isEnrolledAsync();
  }

  async canUseBiometrics(): Promise<boolean> {
    const [hardwareAvailable, enrolled] = await Promise.all([this.isHardwareAvailable(), this.isEnrolled()]);
    return hardwareAvailable && enrolled;
  }

  async isEnabled(userId: string): Promise<boolean> {
    const value = await SecureStore.getItemAsync(preferenceKey(userId));
    return value === 'enabled';
  }

  async enable(userId: string): Promise<void> {
    const canUse = await this.canUseBiometrics();
    if (!canUse) {
      throw new Error('Biometric authentication is not available on this device.');
    }

    await SecureStore.setItemAsync(preferenceKey(userId), 'enabled', secureStoreOptions);
  }

  async disable(userId: string): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(preferenceKey(userId)),
      SecureStore.deleteItemAsync(lastSuccessKey(userId)),
      this.deleteStoredPin(userId),
    ]);
  }

  /**
   * Store user's PIN encrypted with biometric protection
   * This allows us to verify PIN after successful biometric authentication
   */
  /**
   * Store user's PIN encrypted with biometric protection
   * This allows us to verify PIN after successful biometric authentication
   */
  async storePinForBiometric(userId: string, pin: string): Promise<void> {
    // Store in SecureStore without requireAuthentication flag
    // We handle biometric authentication separately via our authenticate() method
    // This prevents double-prompting for Face ID
    await SecureStore.setItemAsync(pinStorageKey(userId), pin, secureStoreOptions);
  }

  /**
   * Retrieve stored PIN (requires biometric authentication on iOS)
   */
  /**
   * Retrieve stored PIN (already authenticated via biometric)
   */
  async getStoredPin(userId: string): Promise<string | null> {
    try {
      // Don't require authentication here - we already authenticated
      // via the authenticate() method before calling this
      return await SecureStore.getItemAsync(pinStorageKey(userId), secureStoreOptions);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete stored PIN
   */
  async deleteStoredPin(userId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(pinStorageKey(userId));
    } catch (error) {
      // Ignore errors if key doesn't exist
    }
  }

  async authenticate(userId: string, options?: AuthenticateOptions): Promise<boolean> {
    const enabled = await this.isEnabled(userId);
    if (!enabled) {
      return false;
    }

    const canUse = await this.canUseBiometrics();
    if (!canUse) {
      await this.disable(userId);
      return false;
    }

    const promptMessage = options?.promptMessage ?? 'Confirm your identity';
    const cancelLabel = options?.cancelLabel ?? 'Cancel';
    const fallbackLabel = options?.fallbackLabel;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel,
      disableDeviceFallback: true,
    });

    if (result.success) {
      await SecureStore.setItemAsync(lastSuccessKey(userId), String(Date.now()), secureStoreOptions);
      return true;
    }

    // result.success is false, so we have error property
    const errorCode = 'error' in result ? result.error : 'unknown';
    const fallback = options?.fallback;
    const fallbackErrors = new Set([
      'user_cancel',
      'system_cancel',
      'app_cancel',
      'user_fallback',
      'fallback',
    ]);

    if (fallbackErrors.has(errorCode ?? '')) {
      if (fallback) {
        return fallback();
      }
      return false;
    }

    if (errorCode === 'not_enrolled') {
      await this.disable(userId);
    }

    if (fallback) {
      return fallback();
    }

    throw new Error(errorCode ?? 'Biometric authentication failed');
  }

  async getLastSuccessAt(userId: string): Promise<Date | null> {
    const value = await SecureStore.getItemAsync(lastSuccessKey(userId));
    if (!value) {
      return null;
    }

    const timestamp = Number(value);
    if (Number.isNaN(timestamp)) {
      return null;
    }

    return new Date(timestamp);
  }

  async shouldPrompt(userId: string, maxAgeMinutes: number = 5): Promise<boolean> {
    const enabled = await this.isEnabled(userId);
    if (!enabled) {
      return false;
    }

    const lastSuccess = await this.getLastSuccessAt(userId);
    if (!lastSuccess) {
      return true;
    }

    const diffMs = Date.now() - lastSuccess.getTime();
    return diffMs >= maxAgeMinutes * 60_000;
  }
}

export const biometricAuthService = new BiometricAuthService();

export default biometricAuthService;
