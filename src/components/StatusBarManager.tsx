import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * StatusBarManager - Automatically adjusts status bar based on theme
 */
export const StatusBarManager: React.FC = () => {
  const { theme } = useTheme();

  return (
    <StatusBar
      style={theme.isDark ? 'light' : 'dark'}
      backgroundColor={theme.colors.background}
    />
  );
};

export default StatusBarManager;
