import { renderHook, act } from '@testing-library/react-native';
import { useTheme } from '@/theme';
import { useThemeStore } from '@/store/themeStore';
import { lightColors, darkColors } from '@/theme/colors';

describe('useTheme Hook', () => {
  beforeEach(() => {
    // Reset theme store to system/light
    act(() => {
      useThemeStore.getState().setThemeMode('light');
    });
  });

  describe('Color Retrieval', () => {
    it('should return light colors when theme is light', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });

      const { result } = renderHook(() => useTheme());

      expect(result.current.colors.primary).toBe(lightColors.primary);
      expect(result.current.colors.surface).toBe(lightColors.surface);
      expect(result.current.colors.textPrimary).toBe(lightColors.textPrimary);
      expect(result.current.isDark).toBe(false);
    });

    it('should return dark colors when theme is dark', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });

      const { result } = renderHook(() => useTheme());

      expect(result.current.colors.primary).toBe(darkColors.primary);
      expect(result.current.colors.surface).toBe(darkColors.surface);
      expect(result.current.colors.textPrimary).toBe(darkColors.textPrimary);
      expect(result.current.isDark).toBe(true);
    });
  });

  describe('Theme Properties', () => {
    it('should include all theme properties', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current).toHaveProperty('colors');
      expect(result.current).toHaveProperty('fonts');
      expect(result.current).toHaveProperty('fontSizes');
      expect(result.current).toHaveProperty('spacing');
      expect(result.current).toHaveProperty('borderRadius');
      expect(result.current).toHaveProperty('shadows');
      expect(result.current).toHaveProperty('gradients');
      expect(result.current).toHaveProperty('iconSizes');
      expect(result.current).toHaveProperty('layout');
      expect(result.current).toHaveProperty('isDark');
    });

    it('should have correct gradient based on theme', () => {
      // Light theme
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });

      const { result: lightResult } = renderHook(() => useTheme());
      expect(lightResult.current.gradients.welcome).toEqual(['#1B4332', '#2D6A4F', '#f6f8f7']);

      // Dark theme
      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });

      const { result: darkResult } = renderHook(() => useTheme());
      expect(darkResult.current.gradients.welcome).toEqual(['#52B788', '#40916C', '#2D6A4F']);
    });
  });

  describe('Dynamic Theme Updates', () => {
    it('should update colors when theme mode changes', () => {
      const { result, rerender } = renderHook(() => useTheme());

      // Initially light
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });
      rerender();

      const lightPrimary = result.current.colors.primary;
      expect(result.current.isDark).toBe(false);

      // Switch to dark
      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });
      rerender();

      const darkPrimary = result.current.colors.primary;
      expect(result.current.isDark).toBe(true);

      // Colors should be different
      expect(lightPrimary).not.toBe(darkPrimary);
    });
  });

  describe('Immutable Theme Properties', () => {
    it('should have consistent font properties across themes', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });
      
      const { result: lightResult, rerender: rerenderLight } = renderHook(() => useTheme());
      rerenderLight();

      const lightFonts = lightResult.current.fonts;

      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });

      const { result: darkResult, rerender: rerenderDark } = renderHook(() => useTheme());
      rerenderDark();
      
      const darkFonts = darkResult.current.fonts;

      // Fonts should be the same regardless of theme
      expect(lightFonts).toEqual(darkFonts);
    });

    it('should have consistent spacing properties across themes', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });
      
      const { result: lightResult, rerender: rerenderLight } = renderHook(() => useTheme());
      rerenderLight();

      const lightSpacing = lightResult.current.spacing;

      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });

      const { result: darkResult, rerender: rerenderDark } = renderHook(() => useTheme());
      rerenderDark();
      
      const darkSpacing = darkResult.current.spacing;

      // Spacing should be the same regardless of theme
      expect(lightSpacing).toEqual(darkSpacing);
    });
  });

  describe('Status Bar Style', () => {
    it('should provide correct statusBarStyle for light theme', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('light');
      });

      const { result } = renderHook(() => useTheme());
      expect(result.current.colors.statusBarStyle).toBe('dark-content');
    });

    it('should provide correct statusBarStyle for dark theme', () => {
      act(() => {
        useThemeStore.getState().setThemeMode('dark');
      });

      const { result } = renderHook(() => useTheme());
      expect(result.current.colors.statusBarStyle).toBe('light-content');
    });
  });
});
