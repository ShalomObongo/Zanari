import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface BalanceDisplayProps {
  balance: number;
  currency?: string;
  label?: string;
  isHidden?: boolean;
  showToggle?: boolean;
  onToggleVisibility?: (hidden: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'card' | 'minimal';
  showTrend?: boolean;
  previousBalance?: number;
  loading?: boolean;
  animated?: boolean;
}

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  currency = 'KES',
  label = 'Available Balance',
  isHidden = false,
  showToggle = true,
  onToggleVisibility,
  size = 'medium',
  variant = 'primary',
  showTrend = false,
  previousBalance,
  loading = false,
  animated = true,
}) => {
  const [hidden, setHidden] = useState(isHidden);
  const [displayBalance, setDisplayBalance] = useState(0);
  const animatedValue = new Animated.Value(0);

  // Format currency
  const formatCurrency = (amount: number, hiddenMode: boolean = false): string => {
    if (hiddenMode) {
      return '••••••';
    }

    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate trend
  const getTrend = (): { direction: 'up' | 'down' | 'neutral'; percentage: number; amount: number } => {
    if (!previousBalance || previousBalance === 0) {
      return { direction: 'neutral', percentage: 0, amount: 0 };
    }

    const difference = balance - previousBalance;
    const percentage = Math.abs((difference / previousBalance) * 100);
    
    if (difference > 0) {
      return { direction: 'up', percentage, amount: difference };
    } else if (difference < 0) {
      return { direction: 'down', percentage, amount: Math.abs(difference) };
    } else {
      return { direction: 'neutral', percentage: 0, amount: 0 };
    }
  };

  // Handle visibility toggle
  const handleToggle = () => {
    const newHiddenState = !hidden;
    setHidden(newHiddenState);
    onToggleVisibility?.(newHiddenState);
  };

  // Animate balance changes
  useEffect(() => {
    if (animated && !hidden && !loading) {
      const animateBalance = () => {
        Animated.timing(animatedValue, {
          toValue: balance,
          duration: 1500,
          useNativeDriver: false,
        }).start();
      };

      const listener = animatedValue.addListener(({ value }) => {
        setDisplayBalance(Math.round(value));
      });

      animateBalance();

      return () => {
        animatedValue.removeListener(listener);
      };
    } else {
      setDisplayBalance(balance);
      return undefined;
    }
  }, [balance, hidden, loading, animated]);

  // Get styles based on size and variant
  const getContainerStyles = () => {
    return [
      styles.container,
      variant === 'primary' && styles.primaryContainer,
      variant === 'secondary' && styles.secondaryContainer,
      variant === 'card' && styles.cardContainer,
      variant === 'minimal' && styles.minimalContainer,
      size === 'small' && styles.smallContainer,
      size === 'large' && styles.largeContainer,
    ].filter(Boolean);
  };

  const getAmountStyles = () => {
    return [
      styles.amount,
      size === 'small' && styles.smallAmount,
      size === 'large' && styles.largeAmount,
      variant === 'primary' && styles.primaryAmount,
      variant === 'secondary' && styles.secondaryAmount,
      variant === 'card' && styles.cardAmount,
      variant === 'minimal' && styles.minimalAmount,
    ].filter(Boolean);
  };

  const getLabelStyles = () => {
    return [
      styles.label,
      size === 'small' && styles.smallLabel,
      size === 'large' && styles.largeLabel,
      variant === 'primary' && styles.primaryLabel,
      variant === 'secondary' && styles.secondaryLabel,
      variant === 'card' && styles.cardLabel,
      variant === 'minimal' && styles.minimalLabel,
    ].filter(Boolean);
  };

  const trend = showTrend ? getTrend() : null;

  return (
    <View style={getContainerStyles()}>
      <View style={styles.header}>
        <Text style={getLabelStyles()}>{label}</Text>
        {showToggle && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={handleToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.toggleIcon}>
              {hidden ? '👁️' : '🙈'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.balanceContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, styles.loadingDotDelayed]} />
            <View style={[styles.loadingDot, styles.loadingDotDelayed2]} />
          </View>
        ) : (
          <>
            <Text style={getAmountStyles()}>
              {animated && !hidden ? 
                formatCurrency(displayBalance, hidden) : 
                formatCurrency(balance, hidden)
              }
            </Text>

            {showTrend && trend && trend.direction !== 'neutral' && !hidden && (
              <View style={styles.trendContainer}>
                <Text style={[
                  styles.trendIcon,
                  trend.direction === 'up' ? styles.trendUp : styles.trendDown
                ]}>
                  {trend.direction === 'up' ? '↗️' : '↘️'}
                </Text>
                <Text style={[
                  styles.trendText,
                  trend.direction === 'up' ? styles.trendUp : styles.trendDown
                ]}>
                  {formatCurrency(trend.amount)} ({trend.percentage.toFixed(1)}%)
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {variant === 'card' && !hidden && !loading && (
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>
            Last updated: {new Date().toLocaleTimeString('en-KE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  primaryContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
  },
  secondaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 4,
  },
  minimalContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  smallContainer: {
    paddingVertical: 8,
  },
  largeContainer: {
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cardLabel: {
    color: '#6C757D',
  },
  minimalLabel: {
    color: '#6C757D',
  },
  smallLabel: {
    fontSize: 12,
  },
  largeLabel: {
    fontSize: 16,
  },
  toggleButton: {
    padding: 4,
  },
  toggleIcon: {
    fontSize: 16,
  },
  balanceContainer: {
    alignItems: 'center',
    width: '100%',
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  primaryAmount: {
    color: '#FFFFFF',
  },
  secondaryAmount: {
    color: '#FFFFFF',
  },
  cardAmount: {
    color: '#1B4332',
  },
  minimalAmount: {
    color: '#1B4332',
  },
  smallAmount: {
    fontSize: 20,
  },
  largeAmount: {
    fontSize: 48,
    letterSpacing: -1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
    opacity: 0.3,
  },
  loadingDotDelayed: {
    opacity: 0.6,
  },
  loadingDotDelayed2: {
    opacity: 0.9,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  trendIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendUp: {
    color: '#52B788',
  },
  trendDown: {
    color: '#FF6B6B',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    width: '100%',
  },
  cardFooterText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
  },
});

// Loading animation component
const LoadingBalance: React.FC<{ variant?: BalanceDisplayProps['variant'] }> = ({ variant = 'primary' }) => {
  const opacity1 = new Animated.Value(0.3);
  const opacity2 = new Animated.Value(0.3);
  const opacity3 = new Animated.Value(0.3);

  React.useEffect(() => {
    const createAnimation = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation1 = createAnimation(opacity1, 0);
    const animation2 = createAnimation(opacity2, 200);
    const animation3 = createAnimation(opacity3, 400);

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();
    };
  }, []);

  const dotColor = variant === 'card' ? '#6C757D' : 'rgba(255, 255, 255, 0.8)';

  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={[
        styles.loadingDot,
        { backgroundColor: dotColor, opacity: opacity1 }
      ]} />
      <Animated.View style={[
        styles.loadingDot,
        { backgroundColor: dotColor, opacity: opacity2 }
      ]} />
      <Animated.View style={[
        styles.loadingDot,
        { backgroundColor: dotColor, opacity: opacity3 }
      ]} />
    </View>
  );
};

export default BalanceDisplay;
export { LoadingBalance };