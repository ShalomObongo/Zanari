import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * GlassmorphismTabBar - A custom bottom tab bar with Apple-style glassmorphism effect
 * 
 * Features:
 * - Translucent background with blur effect (iOS) or semi-transparent fallback (Android)
 * - Floating appearance with rounded corners
 * - Subtle shadow for depth
 * - Responsive to safe area insets
 */
// Lazy-load Liquid Glass to avoid crashing in environments without the native module (e.g., Expo Go)
let Liquid: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Liquid = require('@callstack/liquid-glass');
} catch {
  Liquid = null;
}
export const GlassmorphismTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const useLiquid = Platform.OS === 'ios' && Boolean(Liquid?.isLiquidGlassSupported);
  const styles = createStyles(theme);

  // No tinting on the glass itself; only icons adapt to theme
  const blurTint: 'light' | 'dark' | 'default' = 'default';

  const content = (
    <View style={styles.innerContainer}>
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;

        const { options } = descriptor;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Get icon name from options with proper type handling
        let iconName = 'help-outline';
        if (options.tabBarIcon && typeof options.tabBarIcon === 'function') {
          try {
            const iconElement = options.tabBarIcon({
              focused: isFocused,
              color: isFocused ? theme.colors.accent : theme.colors.textSecondary,
              size: 24,
            });
            if (iconElement && typeof iconElement === 'object' && 'props' in iconElement) {
              const props = (iconElement as any).props as Record<string, unknown>;
              if (props && typeof (props as any).name === 'string') {
                iconName = (props as any).name as string;
              }
            }
          } catch (error) {
            // Fallback to default icon if extraction fails
            iconName = 'help-outline';
          }
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            <View
              style={[
                styles.iconContainer,
                isFocused && styles.iconContainerActive,
              ]}
            >
              <Icon
                name={iconName}
                size={24}
                color={isFocused ? theme.colors.accent : theme.colors.textSecondary}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {useLiquid ? (
        <Liquid.LiquidGlassView
          style={styles.blurContainer}
          interactive
          effect="clear"
          tintColor="transparent"
          colorScheme="system"
        >
          {content}
        </Liquid.LiquidGlassView>
      ) : (
        <BlurView
          intensity={Platform.OS === 'ios' ? 100 : 0}
          tint={blurTint}
          style={[styles.blurContainer, styles.fallbackGlass]}
        >
          {content}
        </BlurView>
      )}
    </View>
  );
};
 

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    // Keep background transparent to allow LiquidGlassView to show native effect.
    // Fallback BlurView will override via `fallbackGlass` below.
    backgroundColor: 'transparent',
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.isDark ? 0.3 : 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  fallbackGlass: {
    // Keep background transparent to avoid tinting; rely on blur only.
    backgroundColor: 'transparent',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 64,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: theme.isDark
      ? 'rgba(82, 183, 136, 0.2)'
      : 'rgba(82, 183, 136, 0.12)',
  },
});
