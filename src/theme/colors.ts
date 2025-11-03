/**
 * Zanari Color System
 * Comprehensive color palette for light and dark themes
 */

export const lightColors = {
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
  backgroundLight: '#f6f8f7',
  backgroundDark: '#11211b',
  
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
  
  // Status bar
  statusBarStyle: 'dark-content' as const,
};

export const darkColors = {
  // Primary Colors - adjusted for dark mode
  primary: '#52B788',
  
  // Accent Colors
  accent: '#52B788',
  accentDarker: '#40916C',
  accentDarkest: '#2D6A4F',
  onPrimaryText: '#95D5B2',
  
  // Text Colors - inverted for dark mode
  textPrimary: '#F3F4F6',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  
  // Surface & Background
  surface: '#1F2937',
  backgroundLight: '#111827',
  backgroundDark: '#0F172A',
  
  // Semantic Colors - adjusted for better contrast
  success: '#52B788',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  
  // Utility Colors
  border: '#374151',
  divider: '#2D3748',
  disabled: '#4B5563',
  
  // Additional Shades - reversed for dark mode
  gray50: '#111827',
  gray100: '#1F2937',
  gray200: '#374151',
  gray300: '#4B5563',
  gray400: '#6B7280',
  gray500: '#9CA3AF',
  gray600: '#D1D5DB',
  gray700: '#E5E7EB',
  gray800: '#F3F4F6',
  gray900: '#F9FAFB',
  
  // Status bar
  statusBarStyle: 'light-content' as const,
};

export type ThemeColors = typeof lightColors;
