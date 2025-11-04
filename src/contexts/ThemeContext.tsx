import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getTheme, Theme, ThemeMode } from '@/theme';
import { useThemeStore } from '@/store/themeStore';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const { themeMode, setThemeMode } = useThemeStore();

  // Resolve the actual theme mode based on preference and system
  const resolvedMode = themeMode === 'system'
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : themeMode;

  const [theme, setTheme] = useState<Theme>(getTheme(resolvedMode));

  // Update theme when mode or system preference changes
  useEffect(() => {
    setTheme(getTheme(resolvedMode));
  }, [resolvedMode]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access the current theme
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
