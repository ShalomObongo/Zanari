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
import { useTheme } from '@/theme';
import theme from '@/theme'; // Static theme for StyleSheet

/**
 * GlassmorphismTabBar - A custom bottom tab bar with Apple-style glassmorphism effect
 * 
 * Features:
 * - Translucent background with blur effect (iOS) or semi-transparent fallback (Android)
 * - Floating appearance with rounded corners
 * - Subtle shadow for depth
 * - Responsive to safe area insets
 * - Adaptive to light/dark themes
 */
export const GlassmorphismTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const themeColors = useTheme();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={themeColors.isDark ? 'dark' : 'light'}
        style={[
          styles.blurContainer,
          {
            backgroundColor: themeColors.isDark 
              ? (Platform.OS === 'ios' ? 'rgba(31, 41, 55, 0.7)' : 'rgba(31, 41, 55, 0.92)')
              : (Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.92)'),
            borderColor: themeColors.isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(255, 255, 255, 0.3)',
          }
        ]}
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
                  color: isFocused ? themeColors.colors.accent : themeColors.colors.textSecondary, 
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
                    isFocused && [
                      styles.iconContainerActive,
                      { backgroundColor: `${themeColors.colors.accent}12` }
                    ],
                  ]}
                >
                  <Icon
                    name={iconName}
                    size={24}
                    color={isFocused ? themeColors.colors.accent : themeColors.colors.textSecondary}
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

const styles = StyleSheet.create({
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
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
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
    // backgroundColor is set dynamically based on theme
  },
});
