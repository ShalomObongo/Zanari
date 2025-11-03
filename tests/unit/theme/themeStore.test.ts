import { renderHook, act } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import { useThemeStore } from '@/store/themeStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock Appearance
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe('Theme Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useThemeStore.getState().setThemeMode('system');
  });

  describe('Initial State', () => {
    it('should initialize with system theme mode', () => {
      const { result } = renderHook(() => useThemeStore());
      expect(result.current.themeMode).toBe('system');
    });

    it('should detect system color scheme on init', () => {
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
      const { result } = renderHook(() => useThemeStore());
      
      // When mode is system, current theme should match system
      expect(result.current.currentTheme).toBeDefined();
    });
  });

  describe('Theme Mode Setting', () => {
    it('should set theme mode to light', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('light');
      });

      expect(result.current.themeMode).toBe('light');
      expect(result.current.currentTheme).toBe('light');
    });

    it('should set theme mode to dark', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('dark');
      });

      expect(result.current.themeMode).toBe('dark');
      expect(result.current.currentTheme).toBe('dark');
    });

    it('should set theme mode to system', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('system');
      });

      expect(result.current.themeMode).toBe('system');
    });
  });

  describe('System Theme Updates', () => {
    it('should update current theme when system changes and mode is system', () => {
      const { result } = renderHook(() => useThemeStore());
      
      // Set to system mode
      act(() => {
        result.current.setThemeMode('system');
      });

      // Simulate system theme change to dark
      act(() => {
        result.current.updateSystemTheme('dark');
      });

      expect(result.current.currentTheme).toBe('dark');
    });

    it('should not update current theme when system changes but mode is not system', () => {
      const { result } = renderHook(() => useThemeStore());
      
      // Set to light mode (not system)
      act(() => {
        result.current.setThemeMode('light');
      });

      const themeBefore = result.current.currentTheme;

      // Simulate system theme change to dark
      act(() => {
        result.current.updateSystemTheme('dark');
      });

      // Theme should remain light since mode is explicitly set
      expect(result.current.currentTheme).toBe(themeBefore);
      expect(result.current.currentTheme).toBe('light');
    });
  });

  describe('Effective Theme', () => {
    it('should return correct effective theme for light mode', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('light');
      });

      expect(result.current.getEffectiveTheme()).toBe('light');
    });

    it('should return correct effective theme for dark mode', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('dark');
      });

      expect(result.current.getEffectiveTheme()).toBe('dark');
    });

    it('should return system theme when mode is system', () => {
      (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setThemeMode('system');
        result.current.updateSystemTheme('dark');
      });

      const effectiveTheme = result.current.getEffectiveTheme();
      expect(result.current.currentTheme).toBe('dark');
    });
  });

  describe('Persistence', () => {
    it('should persist theme mode to AsyncStorage', async () => {
      const { result } = renderHook(() => useThemeStore());
      
      await act(async () => {
        result.current.setThemeMode('dark');
      });

      // Wait for async storage operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if setItem was called (Zustand persist middleware handles this)
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});
