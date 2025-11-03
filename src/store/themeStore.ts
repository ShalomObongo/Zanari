import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  // Theme mode setting
  themeMode: ThemeMode;
  
  // Computed current theme based on mode and system preference
  currentTheme: 'light' | 'dark';
  
  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  updateSystemTheme: (systemColorScheme: ColorSchemeName) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  const colorScheme = Appearance.getColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
};

const computeCurrentTheme = (mode: ThemeMode, systemTheme: 'light' | 'dark'): 'light' | 'dark' => {
  if (mode === 'system') {
    return systemTheme;
  }
  return mode;
};

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      themeMode: 'system',
      currentTheme: getSystemTheme(),
      
      // Set theme mode (light, dark, or system)
      setThemeMode: (mode: ThemeMode) => {
        const systemTheme = getSystemTheme();
        const newCurrentTheme = computeCurrentTheme(mode, systemTheme);
        
        set({
          themeMode: mode,
          currentTheme: newCurrentTheme,
        });
      },
      
      // Update system theme (called when system theme changes)
      updateSystemTheme: (systemColorScheme: ColorSchemeName) => {
        const state = get();
        const systemTheme = systemColorScheme === 'dark' ? 'dark' : 'light';
        
        // Only update current theme if mode is 'system'
        if (state.themeMode === 'system') {
          set({ currentTheme: systemTheme });
        }
      },
      
      // Get the effective theme
      getEffectiveTheme: () => {
        return get().currentTheme;
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, compute the current theme based on stored mode
        if (state) {
          const systemTheme = getSystemTheme();
          const currentTheme = computeCurrentTheme(state.themeMode, systemTheme);
          state.currentTheme = currentTheme;
        }
      },
    }
  )
);

export { useThemeStore };
export default useThemeStore;
