/**
 * Zanari Design System
 * Centralized theme configuration with light and dark mode support
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPalette {
  // Primary Colors
  primary: string;

  // Accent Colors
  accent: string;
  accentDarker: string;
  accentDarkest: string;
  onPrimaryText: string;

  // Text Colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Surface & Background
  surface: string;
  background: string;
  backgroundSecondary: string;

  // Semantic Colors
  success: string;
  error: string;
  warning: string;
  info: string;

  // Utility Colors
  border: string;
  divider: string;
  disabled: string;

  // Additional Shades
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;

  // Card & surface overlays
  card: string;
  overlay: string;

  // Status bar style
  statusBarStyle: 'light-content' | 'dark-content';
}

// Light mode color palette
export const lightColors: ColorPalette = {
  // Primary Colors
  primary: '#1B4332',

  // Accent Colors
  accent: '#52B788',
  accentDarker: '#2D6A4F',
  accentDarkest: '#40916C',
  onPrimaryText: '#B7E4C7',

  // Text Colors
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',

  // Surface & Background
  surface: '#FFFFFF',
  background: '#f6f8f7',
  backgroundSecondary: '#F9FAFB',

  // Semantic Colors
  success: '#52B788',
  error: '#DC2626',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Utility Colors
  border: '#E5E7EB',
  divider: '#F3F4F6',
  disabled: '#D1D5DB',

  // Additional Shades
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Card & surface overlays
  card: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Status bar style
  statusBarStyle: 'dark-content',
};

// Dark mode color palette
export const darkColors: ColorPalette = {
  // Primary Colors - brighter in dark mode for better visibility
  primary: '#2D6A4F',

  // Accent Colors
  accent: '#52B788',
  accentDarker: '#74C69D',
  accentDarkest: '#95D5B2',
  onPrimaryText: '#D8F3DC',

  // Text Colors - inverted for dark mode
  textPrimary: '#F3F4F6',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',

  // Surface & Background
  surface: '#1F2937',
  background: '#111827',
  backgroundSecondary: '#0F1419',

  // Semantic Colors - slightly adjusted for dark mode visibility
  success: '#52B788',
  error: '#EF4444',
  warning: '#FBBF24',
  info: '#60A5FA',

  // Utility Colors
  border: '#374151',
  divider: '#2D3748',
  disabled: '#4B5563',

  // Additional Shades - inverted
  gray50: '#1F2937',
  gray100: '#374151',
  gray200: '#4B5563',
  gray300: '#6B7280',
  gray400: '#9CA3AF',
  gray500: '#D1D5DB',
  gray600: '#E5E7EB',
  gray700: '#F3F4F6',
  gray800: '#F9FAFB',
  gray900: '#FFFFFF',

  // Card & surface overlays
  card: '#1F2937',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Status bar style
  statusBarStyle: 'light-content',
};

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
  welcome: {
    light: ['#1B4332', '#2D6A4F', '#f6f8f7'],
    dark: ['#0F1419', '#1F2937', '#2D6A4F'],
  },
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

export interface Theme {
  colors: ColorPalette;
  fonts: typeof fonts;
  fontSizes: typeof fontSizes;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  gradients: typeof gradients;
  iconSizes: typeof iconSizes;
  layout: typeof layout;
  isDark: boolean;
}

/**
 * Get theme based on mode
 * @param mode - 'light' or 'dark' (system is resolved before calling this)
 */
export const getTheme = (mode: 'light' | 'dark'): Theme => {
  const colors = mode === 'dark' ? darkColors : lightColors;

  return {
    colors,
    fonts,
    fontSizes,
    spacing,
    borderRadius,
    shadows,
    gradients,
    iconSizes,
    layout,
    isDark: mode === 'dark',
  };
};

// Default light theme for backwards compatibility
export const theme = getTheme('light');

export default theme;
