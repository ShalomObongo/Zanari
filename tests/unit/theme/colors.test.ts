import { lightColors, darkColors } from '@/theme/colors';

describe('Theme Colors', () => {
  describe('Light Colors', () => {
    it('should have all required color properties', () => {
      expect(lightColors).toHaveProperty('primary');
      expect(lightColors).toHaveProperty('accent');
      expect(lightColors).toHaveProperty('textPrimary');
      expect(lightColors).toHaveProperty('textSecondary');
      expect(lightColors).toHaveProperty('textTertiary');
      expect(lightColors).toHaveProperty('surface');
      expect(lightColors).toHaveProperty('backgroundLight');
      expect(lightColors).toHaveProperty('backgroundDark');
      expect(lightColors).toHaveProperty('success');
      expect(lightColors).toHaveProperty('error');
      expect(lightColors).toHaveProperty('warning');
      expect(lightColors).toHaveProperty('info');
      expect(lightColors).toHaveProperty('border');
      expect(lightColors).toHaveProperty('divider');
      expect(lightColors).toHaveProperty('disabled');
      expect(lightColors).toHaveProperty('statusBarStyle');
    });

    it('should have correct status bar style for light theme', () => {
      expect(lightColors.statusBarStyle).toBe('dark-content');
    });

    it('should have light colored surfaces', () => {
      // Light theme should have light surface
      expect(lightColors.surface).toBe('#FFFFFF');
    });

    it('should have dark text on light backgrounds', () => {
      // Light theme should have dark text
      expect(lightColors.textPrimary).toBe('#333333');
    });

    it('should have valid hex colors', () => {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      
      Object.entries(lightColors).forEach(([key, value]) => {
        if (key !== 'statusBarStyle') {
          expect(value).toMatch(hexColorRegex);
        }
      });
    });
  });

  describe('Dark Colors', () => {
    it('should have all required color properties', () => {
      expect(darkColors).toHaveProperty('primary');
      expect(darkColors).toHaveProperty('accent');
      expect(darkColors).toHaveProperty('textPrimary');
      expect(darkColors).toHaveProperty('textSecondary');
      expect(darkColors).toHaveProperty('textTertiary');
      expect(darkColors).toHaveProperty('surface');
      expect(darkColors).toHaveProperty('backgroundLight');
      expect(darkColors).toHaveProperty('backgroundDark');
      expect(darkColors).toHaveProperty('success');
      expect(darkColors).toHaveProperty('error');
      expect(darkColors).toHaveProperty('warning');
      expect(darkColors).toHaveProperty('info');
      expect(darkColors).toHaveProperty('border');
      expect(darkColors).toHaveProperty('divider');
      expect(darkColors).toHaveProperty('disabled');
      expect(darkColors).toHaveProperty('statusBarStyle');
    });

    it('should have correct status bar style for dark theme', () => {
      expect(darkColors.statusBarStyle).toBe('light-content');
    });

    it('should have dark colored surfaces', () => {
      // Dark theme should have dark surface
      expect(darkColors.surface).toBe('#1F2937');
    });

    it('should have light text on dark backgrounds', () => {
      // Dark theme should have light text
      expect(darkColors.textPrimary).toBe('#F3F4F6');
    });

    it('should have valid hex colors', () => {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      
      Object.entries(darkColors).forEach(([key, value]) => {
        if (key !== 'statusBarStyle') {
          expect(value).toMatch(hexColorRegex);
        }
      });
    });
  });

  describe('Color Contrast', () => {
    it('light theme should have sufficient contrast for text', () => {
      // Basic check: dark text (#333) on light surface (#FFF) should be readable
      const textPrimary = lightColors.textPrimary;
      const surface = lightColors.surface;
      
      expect(textPrimary).not.toBe(surface);
      // Text should be darker than surface for light theme
      expect(parseInt(textPrimary.slice(1), 16)).toBeLessThan(
        parseInt(surface.slice(1), 16)
      );
    });

    it('dark theme should have sufficient contrast for text', () => {
      // Basic check: light text on dark surface should be readable
      const textPrimary = darkColors.textPrimary;
      const surface = darkColors.surface;
      
      expect(textPrimary).not.toBe(surface);
      // Text should be lighter than surface for dark theme
      expect(parseInt(textPrimary.slice(1), 16)).toBeGreaterThan(
        parseInt(surface.slice(1), 16)
      );
    });
  });

  describe('Semantic Colors', () => {
    it('should have consistent semantic colors across themes', () => {
      // Success should be greenish in both themes
      expect(lightColors.success).toBe('#52B788');
      expect(darkColors.success).toBe('#52B788');
      
      // Accent should be consistent
      expect(lightColors.accent).toBe('#52B788');
      expect(darkColors.accent).toBe('#52B788');
    });

    it('should have appropriate error colors for both themes', () => {
      // Error colors should be reddish
      expect(lightColors.error).toBe('#DC2626');
      // Dark theme error should be lighter for visibility
      expect(darkColors.error).toBe('#F87171');
    });
  });

  describe('Gray Scale', () => {
    it('should have inverted gray scales for light and dark themes', () => {
      // In light theme, gray50 should be lightest
      expect(lightColors.gray50).toBe('#F9FAFB');
      expect(lightColors.gray900).toBe('#111827');
      
      // In dark theme, grays should be inverted
      expect(darkColors.gray50).toBe('#111827');
      expect(darkColors.gray900).toBe('#F9FAFB');
    });
  });
});
