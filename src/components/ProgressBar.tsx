import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle, TextStyle } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0-100
  total?: number;
  current?: number;
  color?: string;
  backgroundColor?: string;
  height?: number;
  borderRadius?: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  animationDuration?: number;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal';
  showTooltip?: boolean;
  tooltipText?: string;
  style?: ViewStyle;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  total,
  current,
  color = '#52B788',
  backgroundColor = '#E9ECEF',
  height,
  borderRadius,
  showPercentage = false,
  showLabel = false,
  label,
  animated = true,
  animationDuration = 800,
  size = 'medium',
  variant = 'default',
  showTooltip = false,
  tooltipText,
  style,
}) => {
  const [animatedProgress] = useState(new Animated.Value(0));
  const [displayProgress, setDisplayProgress] = useState(0);

  // Calculate actual progress
  const actualProgress = Math.min(Math.max(progress, 0), 100);

  // Get size-based styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: height || 4,
          borderRadius: borderRadius || 2,
        };
      case 'large':
        return {
          height: height || 12,
          borderRadius: borderRadius || 6,
        };
      default: // medium
        return {
          height: height || 8,
          borderRadius: borderRadius || 4,
        };
    }
  };

  // Get variant-specific styles
  const getVariantStyles = () => {
    const sizeStyles = getSizeStyles();
    
    switch (variant) {
      case 'minimal':
        return {
          container: {
            ...sizeStyles,
            backgroundColor: 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: backgroundColor,
          },
          fill: {
            backgroundColor: color,
            borderBottomWidth: 1,
            borderBottomColor: color,
          },
        };
      default:
        return {
          container: sizeStyles,
          fill: { backgroundColor: color },
        };
    }
  };

  // Animation effect
  useEffect(() => {
    if (animated) {
      const animation = Animated.timing(animatedProgress, {
        toValue: actualProgress,
        duration: animationDuration,
        useNativeDriver: false,
      });

      const listener = animatedProgress.addListener(({ value }) => {
        setDisplayProgress(Math.round(value));
      });

      animation.start();

      return () => {
        animatedProgress.removeListener(listener);
      };
    } else {
      setDisplayProgress(actualProgress);
      return undefined;
    }
  }, [actualProgress, animated, animationDuration]);

  // Format display values
  const formatValue = (value: number): string => {
    return new Intl.NumberFormat('en-KE').format(value);
  };

  const getProgressText = (): string => {
    if (current !== undefined && total !== undefined) {
      return `${formatValue(current)} / ${formatValue(total)}`;
    }
    return `${displayProgress}%`;
  };

  const variantStyles = getVariantStyles();

  return (
    <View style={[styles.wrapper, style]}>
      {/* Label */}
      {(showLabel || label) && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, getLabelTextStyle()]}>
            {label || 'Progress'}
          </Text>
          {showPercentage && (
            <Text style={[styles.percentage, getPercentageTextStyle()]}>
              {getProgressText()}
            </Text>
          )}
        </View>
      )}

      {/* Progress Bar Container */}
      <View
        style={[
          styles.container,
          { backgroundColor },
          variantStyles.container,
        ]}
      >
        {/* Progress Fill */}
        <Animated.View
          style={[
            styles.fill,
            variantStyles.fill,
            {
              width: animated 
                ? animatedProgress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  })
                : `${actualProgress}%`,
            },
          ]}
        />
      </View>

      {/* Tooltip */}
      {showTooltip && tooltipText && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{tooltipText}</Text>
        </View>
      )}

      {/* Percentage below bar (if not shown in label) */}
      {showPercentage && !showLabel && !label && (
        <Text style={[styles.percentageBelow, getPercentageTextStyle()]}>
          {getProgressText()}
        </Text>
      )}
    </View>
  );
};

// Helper functions for text styles
const getLabelTextStyle = (): TextStyle => ({
  fontSize: 14,
  fontWeight: '600',
  color: '#1B4332',
});

const getPercentageTextStyle = (): TextStyle => ({
  fontSize: 14,
  fontWeight: '500',
  color: '#6C757D',
});

// Circular Progress Bar Component (simplified for React Native)
interface CircularProgressBarProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  animated?: boolean;
  children?: React.ReactNode;
}

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({
  progress,
  size = 100,
  strokeWidth = 8,
  color = '#52B788',
  backgroundColor = '#E9ECEF',
  showPercentage = true,
  animated = true,
  children,
}) => {
  const [animatedProgress] = useState(new Animated.Value(0));
  const [displayProgress, setDisplayProgress] = useState(0);
  
  const actualProgress = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    if (animated) {
      const animation = Animated.timing(animatedProgress, {
        toValue: actualProgress,
        duration: 800,
        useNativeDriver: false,
      });

      const listener = animatedProgress.addListener(({ value }) => {
        setDisplayProgress(Math.round(value));
      });

      animation.start();

      return () => {
        animatedProgress.removeListener(listener);
      };
    } else {
      setDisplayProgress(actualProgress);
      return undefined;
    }
  }, [actualProgress, animated]);

  // Simplified circular progress using nested Views
  const innerSize = size - strokeWidth * 2;
  
  return (
    <View style={[styles.circularContainer, { width: size, height: size }]}>
      {/* Background Circle */}
      <View 
        style={[
          styles.circularBackground,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          }
        ]}
      />
      
      {/* Progress Indicator (simplified) */}
      <View 
        style={[
          styles.circularProgress,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            transform: [{ rotate: `${(displayProgress / 100) * 360 - 90}deg` }],
          }
        ]}
      />
      
      {/* Center Content */}
      <View style={[styles.circularContent, { width: innerSize, height: innerSize }]}>
        {children || (showPercentage && (
          <Text style={[styles.circularText, { fontSize: size * 0.15 }]}>
            {displayProgress}%
          </Text>
        ))}
      </View>
    </View>
  );
};

// Segmented Progress Bar Component
interface SegmentedProgressBarProps {
  segments: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  total?: number;
  height?: number;
  borderRadius?: number;
  showLabels?: boolean;
  animated?: boolean;
}

const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  segments,
  total,
  height = 8,
  borderRadius = 4,
  showLabels = false,
  animated = true,
}) => {
  const totalValue = total || segments.reduce((sum, segment) => sum + segment.value, 0);
  
  return (
    <View style={styles.segmentedWrapper}>
      <View style={[styles.segmentedContainer, { height, borderRadius }]}>
        {segments.map((segment, index) => {
          const percentage = (segment.value / totalValue) * 100;
          
          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: segment.color,
                  width: `${percentage}%`,
                  borderTopLeftRadius: index === 0 ? borderRadius : 0,
                  borderBottomLeftRadius: index === 0 ? borderRadius : 0,
                  borderTopRightRadius: index === segments.length - 1 ? borderRadius : 0,
                  borderBottomRightRadius: index === segments.length - 1 ? borderRadius : 0,
                },
              ]}
            />
          );
        })}
      </View>
      
      {showLabels && (
        <View style={styles.segmentLabels}>
          {segments.map((segment, index) => (
            <View key={index} style={styles.segmentLabel}>
              <View style={[styles.segmentDot, { backgroundColor: segment.color }]} />
              <Text style={styles.segmentLabelText}>
                {segment.label || `Segment ${index + 1}`}: {segment.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    flex: 1,
  },
  percentage: {
    textAlign: 'right',
  },
  container: {
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  tooltip: {
    position: 'absolute',
    top: -30,
    right: 0,
    backgroundColor: '#1B4332',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  percentageBelow: {
    textAlign: 'center',
    marginTop: 8,
  },
  // Circular styles
  circularContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circularBackground: {
    position: 'absolute',
  },
  circularProgress: {
    position: 'absolute',
  },
  circularContent: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  circularText: {
    fontWeight: '700',
    color: '#1B4332',
  },
  // Segmented styles
  segmentedWrapper: {
    width: '100%',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  segmentLabels: {
    marginTop: 12,
  },
  segmentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  segmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  segmentLabelText: {
    fontSize: 12,
    color: '#6C757D',
  },
});

export default ProgressBar;
export { CircularProgressBar, SegmentedProgressBar };