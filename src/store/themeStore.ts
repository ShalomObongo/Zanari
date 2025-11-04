import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from '@/theme';

interface ThemeState {
  // Theme mode preference
  themeMode: ThemeMode;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  reset: () => void;
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initial state - default to system
      themeMode: 'system',

      // Set theme mode
      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });
      },

      // Reset to default
      reset: () => {
        set({ themeMode: 'system' });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export { useThemeStore };
export default useThemeStore;
