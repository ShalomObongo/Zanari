import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { biometricAuthService } from '@/services/biometricAuth';

interface SettingsState {
  // Biometric preferences per user
  biometricEnabledUsers: Record<string, boolean>;

  // Loading states
  isEnablingBiometric: boolean;
  isDisablingBiometric: boolean;

  // Actions
  isBiometricEnabled: (userId: string) => boolean;
  enableBiometric: (userId: string) => Promise<void>;
  disableBiometric: (userId: string) => Promise<void>;
  checkBiometricCapability: () => Promise<boolean>;
  clearUserSettings: (userId: string) => void;
  reset: () => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      biometricEnabledUsers: {},
      isEnablingBiometric: false,
      isDisablingBiometric: false,

      // Check if biometric is enabled for a user
      isBiometricEnabled: (userId: string) => {
        const state = get();
        return state.biometricEnabledUsers[userId] === true;
      },

      // Enable biometric authentication for a user
      enableBiometric: async (userId: string) => {
        set({ isEnablingBiometric: true });
        try {
          // Enable in the biometric service (stores in SecureStore)
          await biometricAuthService.enable(userId);

          // Update local state
          set((state) => ({
            biometricEnabledUsers: {
              ...state.biometricEnabledUsers,
              [userId]: true,
            },
          }));
        } catch (error) {
          // If service fails, ensure local state is consistent
          set((state) => ({
            biometricEnabledUsers: {
              ...state.biometricEnabledUsers,
              [userId]: false,
            },
          }));
          throw error;
        } finally {
          set({ isEnablingBiometric: false });
        }
      },

      // Disable biometric authentication for a user
      disableBiometric: async (userId: string) => {
        set({ isDisablingBiometric: true });
        try {
          // Disable in the biometric service
          await biometricAuthService.disable(userId);

          // Update local state
          set((state) => ({
            biometricEnabledUsers: {
              ...state.biometricEnabledUsers,
              [userId]: false,
            },
          }));
        } catch (error) {
          throw error;
        } finally {
          set({ isDisablingBiometric: false });
        }
      },

      // Check if device supports biometric authentication
      checkBiometricCapability: async () => {
        return await biometricAuthService.canUseBiometrics();
      },

      // Clear settings for a specific user (e.g., on logout)
      clearUserSettings: (userId: string) => {
        set((state) => {
          const { [userId]: _, ...remaining } = state.biometricEnabledUsers;
          return { biometricEnabledUsers: remaining };
        });
      },

      // Reset all settings
      reset: () => {
        set({
          biometricEnabledUsers: {},
          isEnablingBiometric: false,
          isDisablingBiometric: false,
        });
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        biometricEnabledUsers: state.biometricEnabledUsers,
      }),
    }
  )
);

export { useSettingsStore };
export default useSettingsStore;
