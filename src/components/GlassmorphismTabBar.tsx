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
export const GlassmorphismTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? (theme.isDark ? 100 : 80) : 0}
        tint={theme.isDark ? 'dark' : 'light'}
        style={styles.blurContainer}
      >
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
                  size: 24 
                });
                if (iconElement && typeof iconElement === 'object' && 'props' in iconElement) {
                  const props = iconElement.props as Record<string, unknown>;
                  if (props && typeof props.name === 'string') {
                    iconName = props.name;
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
      </BlurView>
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
    backgroundColor: Platform.OS === 'ios'
      ? (theme.isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.7)')
      : (theme.isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.92)'),
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
