/**
 * Zanari Design System
 * Centralized theme configuration matching the new UI designs
 */

import { lightColors, darkColors, ThemeColors } from './colors';
import { useThemeStore } from '@/store/themeStore';

// Default to light colors for backward compatibility
// NOTE: Prefer using useTheme() hook for dynamic theming instead of this static export
export const colors = lightColors;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
};

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const borderRadius = {
  sm: 4,
  DEFAULT: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  DEFAULT: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const gradients = {
  welcome: ['#1B4332', '#2D6A4F', '#f6f8f7'],
  welcomeDark: ['#52B788', '#40916C', '#2D6A4F'],
};

// Icon sizes
export const iconSizes = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
};

// Layout constants
export const layout = {
  tabBarBottomPadding: 100, // Extra space for floating glassmorphism tab bar
};

export const theme = {
  colors,
  fonts,
  fontSizes,
  spacing,
  borderRadius,
  shadows,
  gradients,
  iconSizes,
  layout,
};

// Custom hook to get dynamic theme based on current theme mode
export const useTheme = () => {
  const currentTheme = useThemeStore((state) => state.currentTheme);
  
  const themeColors = currentTheme === 'dark' ? darkColors : lightColors;
  const themeGradients = currentTheme === 'dark' 
    ? { ...gradients, welcome: gradients.welcomeDark }
    : gradients;
  
  return {
    colors: themeColors,
    fonts,
    fontSizes,
    spacing,
    borderRadius,
    shadows,
    gradients: themeGradients,
    iconSizes,
    layout,
    isDark: currentTheme === 'dark',
  };
};

// Export color palettes for direct use
export { lightColors, darkColors };
export type { ThemeColors };

export default theme;
