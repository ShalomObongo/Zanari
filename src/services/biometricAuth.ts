import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const preferenceKey = (userId: string) => `biometric:preference:${userId}`;
const lastSuccessKey = (userId: string) => `biometric:last-success:${userId}`;

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
    ]);
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

    const fallback = options?.fallback;
    const fallbackErrors = new Set([
      'user_cancel',
      'system_cancel',
      'app_cancel',
      'user_fallback',
      'fallback',
    ]);

    if (fallbackErrors.has(result.error ?? '')) {
      if (fallback) {
        return fallback();
      }
      return false;
    }

    if (result.error === 'not_enrolled') {
      await this.disable(userId);
    }

    if (fallback) {
      return fallback();
    }

    throw new Error(result.error ?? 'Biometric authentication failed');
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
