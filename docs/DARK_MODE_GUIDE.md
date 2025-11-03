# Dark Mode Implementation Guide

## Overview

Zanari now supports comprehensive dark mode with three theme options:
- **Light Mode**: Traditional light theme
- **Dark Mode**: Dark theme optimized for low-light environments
- **System Default**: Automatically follows device system theme

## Architecture

### Core Components

1. **Theme Store** (`src/store/themeStore.ts`)
   - Manages theme state using Zustand
   - Persists user preference to AsyncStorage
   - Listens to system theme changes
   - Provides `themeMode` (user preference) and `currentTheme` (effective theme)

2. **Theme Colors** (`src/theme/colors.ts`)
   - Defines `lightColors` and `darkColors` palettes
   - Ensures WCAG AA accessibility contrast levels
   - Includes semantic colors (success, error, warning, info)

3. **Theme Hook** (`src/theme/index.ts`)
   - `useTheme()` hook returns dynamic theme based on current mode
   - Provides colors, fonts, spacing, and all design tokens
   - Includes `isDark` boolean for conditional logic

4. **App Integration** (`App.tsx`)
   - Subscribes to system theme changes via `Appearance` API
   - Updates StatusBar style dynamically

## Usage Guide

### For Screen Components

```typescript
import { useTheme } from '@/theme';
import theme from '@/theme'; // Static theme for StyleSheet
import { StatusBar } from 'react-native';

const MyScreen = () => {
  const themeColors = useTheme();
  
  return (
    <>
      {/* Dynamic StatusBar */}
      <StatusBar 
        barStyle={themeColors.colors.statusBarStyle} 
        backgroundColor={themeColors.colors.surface} 
      />
      
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.colors.surface }]}>
        {/* Dynamic text color */}
        <Text style={[styles.title, { color: themeColors.colors.textPrimary }]}>
          Hello World
        </Text>
        
        {/* Dynamic background */}
        <View style={[styles.card, { backgroundColor: themeColors.colors.gray50 }]}>
          <Text style={[styles.subtitle, { color: themeColors.colors.textSecondary }]}>
            Subtitle
          </Text>
        </View>
      </SafeAreaView>
    </>
  );
};

// Use static theme for StyleSheet (non-color properties)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.base,
  },
  title: {
    fontSize: theme.fontSizes['2xl'],
    fontFamily: theme.fonts.bold,
  },
  card: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
  },
});
```

### Color Properties

Use these dynamic color properties from `themeColors.colors`:

#### Primary Colors
- `primary` - Main brand color
- `accent` - Accent/highlight color
- `accentDarker` - Darker accent variant
- `accentDarkest` - Darkest accent variant

#### Text Colors
- `textPrimary` - Primary text (headlines, body)
- `textSecondary` - Secondary text (subtitles, captions)
- `textTertiary` - Tertiary text (hints, disabled)

#### Backgrounds
- `surface` - Card/component backgrounds
- `backgroundLight` - Screen backgrounds
- `backgroundDark` - Alternative dark backgrounds

#### Semantic Colors
- `success` - Success states (#52B788)
- `error` - Error states (light: #DC2626, dark: #F87171)
- `warning` - Warning states (light: #F59E0B, dark: #FBBF24)
- `info` - Info states (light: #3B82F6, dark: #60A5FA)

#### Utility Colors
- `border` - Border colors
- `divider` - Divider lines
- `disabled` - Disabled states

#### Gray Scale
- `gray50` through `gray900` - Grayscale palette (inverted in dark mode)

#### Special
- `statusBarStyle` - React Native StatusBar style ('dark-content' or 'light-content')

### Conditional Rendering Based on Theme

```typescript
const MyComponent = () => {
  const themeColors = useTheme();
  
  return (
    <View>
      {themeColors.isDark ? (
        <DarkModeOnlyComponent />
      ) : (
        <LightModeOnlyComponent />
      )}
      
      <Icon 
        name="settings"
        color={themeColors.isDark ? '#FFFFFF' : '#000000'}
      />
    </View>
  );
};
```

### Using Gradients

```typescript
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';

const GradientComponent = () => {
  const themeColors = useTheme();
  
  return (
    <LinearGradient
      colors={themeColors.gradients.welcome as readonly [string, string, ...string[]]}
      style={styles.gradient}
    >
      <Text>Gradient Text</Text>
    </LinearGradient>
  );
};
```

## Theme Switching

Users can change theme in **Settings > Appearance > Theme**

Programmatically:
```typescript
import { useThemeStore } from '@/store/themeStore';

const MyComponent = () => {
  const setThemeMode = useThemeStore(state => state.setThemeMode);
  
  return (
    <View>
      <Button onPress={() => setThemeMode('light')}>Light</Button>
      <Button onPress={() => setThemeMode('dark')}>Dark</Button>
      <Button onPress={() => setThemeMode('system')}>System</Button>
    </View>
  );
};
```

## Testing

Theme tests are located in `tests/unit/theme/`:
- `themeStore.test.ts` - Theme store functionality
- `colors.test.ts` - Color palettes and contrast
- `useTheme.test.ts` - Theme hook behavior

Run tests:
```bash
npm test tests/unit/theme
```

## Accessibility

### Contrast Ratios
All color combinations meet WCAG AA standards:
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Testing Contrast
```typescript
// Example: Check if text is readable on background
const textColor = themeColors.colors.textPrimary;
const bgColor = themeColors.colors.surface;

// Light theme: #333333 on #FFFFFF = 12.63:1 ✓
// Dark theme: #F3F4F6 on #1F2937 = 11.58:1 ✓
```

## Migration Guide for Existing Screens

### Step 1: Add Imports
```typescript
import { useTheme } from '@/theme';
import theme from '@/theme'; // Keep for static properties
```

### Step 2: Add Hook
```typescript
const MyScreen = () => {
  const themeColors = useTheme();
  // ... rest of component
```

### Step 3: Update StatusBar
```typescript
<StatusBar barStyle={themeColors.colors.statusBarStyle} />
```

### Step 4: Update Dynamic Styles
Replace `theme.colors.*` with `themeColors.colors.*` in JSX:

**Before:**
```typescript
<View style={styles.container}>
  <Text style={styles.title}>Hello</Text>
</View>

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.textPrimary }
});
```

**After:**
```typescript
<View style={[styles.container, { backgroundColor: themeColors.colors.surface }]}>
  <Text style={[styles.title, { color: themeColors.colors.textPrimary }]}>Hello</Text>
</View>

const styles = StyleSheet.create({
  container: { /* structure only */ },
  title: { fontSize: theme.fontSizes.lg, fontFamily: theme.fonts.bold }
});
```

### Step 5: Update Icons
```typescript
// Before
<Icon name="home" color={theme.colors.primary} />

// After
<Icon name="home" color={themeColors.colors.primary} />
```

## Examples

See these files for complete examples:
- `src/screens/settings/SettingsScreen.tsx` - Complex screen with multiple sections
- `src/screens/auth/WelcomeScreen.tsx` - Screen with gradients and features
- `src/screens/main/DashboardScreen.tsx` - Dashboard with cards and dynamic content
- `src/components/GlassmorphismTabBar.tsx` - Component with glassmorphism effect

## Best Practices

1. **Always use `useTheme()` for colors** that should adapt to theme
2. **Use static `theme` import** for non-color properties (fonts, spacing, borderRadius)
3. **Apply colors via inline styles** with dynamic values
4. **Test both themes** when developing new screens
5. **Check contrast** in both light and dark modes
6. **Use semantic colors** (success, error) instead of hardcoding
7. **Avoid pure white/black** - use theme colors for better consistency

## Troubleshooting

### Issue: Colors not updating when theme changes
**Solution**: Ensure you're using `themeColors.colors.*` not `theme.colors.*`

### Issue: StatusBar wrong color
**Solution**: Use `themeColors.colors.statusBarStyle` not hardcoded strings

### Issue: Type error with gradients
**Solution**: Cast gradient array: `as readonly [string, string, ...string[]]`

### Issue: Component not re-rendering on theme change
**Solution**: Make sure `useTheme()` is called in the component (not in helpers/utils)

## Future Enhancements

- [ ] Automatic theme switching based on time of day
- [ ] Custom theme colors (user-defined palettes)
- [ ] High contrast mode for accessibility
- [ ] Theme preview in Settings
- [ ] Transition animations when switching themes
