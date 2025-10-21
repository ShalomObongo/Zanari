import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface TransactionCardProps {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description: string;
  amount: number;
  currency: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  isRoundUp?: boolean;
  recipientName?: string;
  paymentMethod?: string;
  onPress?: (transactionId: string) => void;
  showFullDate?: boolean;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  id,
  type,
  category,
  description,
  amount,
  currency = 'KES',
  timestamp,
  status,
  isRoundUp = false,
  recipientName,
  paymentMethod,
  onPress,
  showFullDate = false,
}) => {
  // Category icons mapping
  const getCategoryIcon = (category: string, transactionType: string): string => {
    const iconMap: Record<string, string> = {
      // Income categories
      salary: '💰',
      freelance: '💻',
      investment: '📈',
      refund: '↩️',
      gift: '🎁',
      // Expense categories
      food: '🍽️',
      transport: '🚗',
      shopping: '🛍️',
      entertainment: '🎬',
      bills: '📄',
      healthcare: '🏥',
      education: '📚',
      groceries: '🛒',
      fuel: '⛽',
      utilities: '💡',
      rent: '🏠',
      insurance: '🛡️',
      // Transfer categories
      p2p: '👤',
      bank: '🏦',
      mobile_money: '📱',
      savings: '🎯',
      investment_transfer: '📊',
    };

    return iconMap[category.toLowerCase()] || (transactionType === 'income' ? '💰' : transactionType === 'expense' ? '💸' : '↔️');
  };

  // Amount formatting
  const formatAmount = (amount: number, currency: string): string => {
    const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : '';
    return `${prefix}${new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(Math.abs(amount))}`;
  };

  // Time formatting
  const formatTime = (date: Date): string => {
    if (showFullDate) {
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-KE', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#52B788';
      case 'pending':
        return '#FFA500';
      case 'failed':
        return '#FF6B6B';
      default:
        return '#6C757D';
    }
  };

  // Amount color
  const getAmountColor = (type: string, status: string): string => {
    if (status === 'failed') return '#FF6B6B';
    if (status === 'pending') return '#FFA500';
    
    switch (type) {
      case 'income':
        return '#52B788';
      case 'expense':
        return '#FF6B6B';
      case 'transfer':
        return '#1B4332';
      default:
        return '#1B4332';
    }
  };

  const handlePress = () => {
    onPress?.(id);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        status === 'pending' && styles.pendingContainer,
        status === 'failed' && styles.failedContainer,
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.content}>
        {/* Left side - Icon and Transaction Info */}
        <View style={styles.leftSection}>
          <View style={[styles.iconContainer, { backgroundColor: getCategoryColor(category) }]}>
            <Text style={styles.icon}>{getCategoryIcon(category, type)}</Text>
          </View>
          
          <View style={styles.transactionInfo}>
            <Text style={styles.description} numberOfLines={1}>
              {description}
            </Text>
            
            <View style={styles.metaInfo}>
              {recipientName && (
                <Text style={styles.metaText} numberOfLines={1}>
                  to {recipientName}
                </Text>
              )}
              {paymentMethod && (
                <Text style={styles.metaText}>
                  via {paymentMethod}
                </Text>
              )}
              {!recipientName && !paymentMethod && (
                <Text style={styles.metaText}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Right side - Amount and Status */}
        <View style={styles.rightSection}>
          <Text style={[
            styles.amount,
            { color: getAmountColor(type, status) }
          ]}>
            {formatAmount(amount, currency)}
          </Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.timestamp}>
              {formatTime(timestamp)}
            </Text>
            
            {status !== 'completed' && (
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
                <Text style={styles.statusText}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Round-up indicator */}
      {isRoundUp && (
        <View style={styles.roundUpIndicator}>
          <Text style={styles.roundUpText}>🔄 Round-up transaction</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Helper function to get category background color
const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    // Income categories
    salary: '#E8F5E8',
    freelance: '#E3F2FD',
    investment: '#F3E5F5',
    refund: '#FFF3E0',
    gift: '#FCE4EC',
    // Expense categories
    food: '#FFE0B2',
    transport: '#E1F5FE',
    shopping: '#F8BBD9',
    entertainment: '#E8EAF6',
    bills: '#FFECB3',
    healthcare: '#FFCDD2',
    education: '#C8E6C9',
    groceries: '#DCEDC8',
    fuel: '#FFCCBC',
    utilities: '#FFF9C4',
    rent: '#BCAAA4',
    insurance: '#CFD8DC',
    // Transfer categories
    p2p: '#E1BEE7',
    bank: '#B3E5FC',
    mobile_money: '#C8E6C9',
    savings: '#FFAB91',
    investment_transfer: '#D1C4E9',
  };

  return colorMap[category.toLowerCase()] || '#F5F5F5';
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pendingContainer: {
    backgroundColor: '#FFFBF0',
  },
  failedContainer: {
    backgroundColor: '#FFF5F5',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
    marginBottom: 2,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#6C757D',
    marginRight: 8,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#6C757D',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  roundUpIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  roundUpText: {
    fontSize: 12,
    color: '#52B788',
    fontStyle: 'italic',
  },
});

export default TransactionCard;