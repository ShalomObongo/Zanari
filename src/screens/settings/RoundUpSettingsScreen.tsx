import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoundUpStore } from '@/store/roundUpStore';
import { formatCurrency } from '@/utils/formatters';
import { useTheme } from '@/contexts/ThemeContext';

type IncrementType = '10' | '50' | '100' | 'auto' | 'percentage';

const INCREMENT_OPTIONS: Array<{ value: IncrementType; label: string; description: string }> = [
  { value: '10', label: 'KES 10', description: 'Round up to the nearest 10 shillings' },
  { value: '50', label: 'KES 50', description: 'Round up to the nearest 50 shillings' },
  { value: '100', label: 'KES 100', description: 'Round up to the nearest 100 shillings' },
  {
    value: 'percentage',
    label: 'Custom Percentage',
    description: 'Save a percentage of each transaction',
  },
  {
    value: 'auto',
    label: 'Smart Auto',
    description: 'AI-powered round-up based on your spending patterns',
  },
];

const RoundUpSettingsScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    rule,
    analysis,
    isLoading,
    isUpdating,
    fetchRule,
    updateRule,
    fetchAnalysis,
  } = useRoundUpStore();

  const [selectedIncrement, setSelectedIncrement] = useState<IncrementType>('10');
  const [isEnabled, setIsEnabled] = useState(false);
  const [percentageValue, setPercentageValue] = useState('5');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (rule) {
      setSelectedIncrement(rule.increment_type);
      setIsEnabled(rule.is_enabled);
      if (rule.increment_type === 'percentage' && rule.percentage_value) {
        setPercentageValue(rule.percentage_value.toString());
      }
    }
  }, [rule]);

  const loadData = async () => {
    // Fetch rule and analysis separately so one failure doesn't block the other
    try {
      await fetchRule();
    } catch (error) {
      console.error('Failed to load round-up rule:', error);
      // Rule might not exist yet - this is ok
    }

    try {
      await fetchAnalysis({ include_projections: true });
    } catch (error) {
      console.error('Failed to load round-up analysis:', error);
      // Analysis might not be available yet - this is ok
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    setIsEnabled(value);
    try {
      await updateRule({ is_enabled: value });
    } catch (error) {
      console.error('Failed to toggle round-up:', error);
      setIsEnabled(!value); // Revert on error
      const errorMessage = error instanceof Error ? error.message : 'Failed to update round-up settings';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleSelectIncrement = async (increment: IncrementType) => {
    if (!isEnabled) {
      Alert.alert('Enable Round-Up', 'Please enable round-up savings first');
      return;
    }

    setSelectedIncrement(increment);
    try {
      const updates: any = { increment_type: increment };

      // If percentage is selected, include the percentage value
      if (increment === 'percentage') {
        const percentage = parseFloat(percentageValue);
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
          Alert.alert('Invalid Percentage', 'Please enter a percentage between 0 and 100');
          setSelectedIncrement(rule?.increment_type || '10');
          return;
        }
        updates.percentage_value = percentage;
      }

      await updateRule(updates);
      Alert.alert('Success', 'Round-up increment updated successfully');
    } catch (error) {
      setSelectedIncrement(rule?.increment_type || '10');
      Alert.alert('Error', 'Failed to update round-up increment');
    }
  };

  const renderStats = () => {
    if (!rule) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Your Round-Up Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Icon name="savings" size={24} color={theme.colors.accent} />
            <Text style={styles.statValue}>{formatCurrency(rule.total_amount_saved)}</Text>
            <Text style={styles.statLabel}>Total Saved</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="trending-up" size={24} color={theme.colors.success} />
            <Text style={styles.statValue}>{rule.total_round_ups_count}</Text>
            <Text style={styles.statLabel}>Round-Ups</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="analytics" size={24} color={theme.colors.accent} />
            <Text style={styles.statValue}>
              {rule.total_round_ups_count > 0
                ? formatCurrency(Math.round(rule.total_amount_saved / rule.total_round_ups_count))
                : 'KES 0'}
            </Text>
            <Text style={styles.statLabel}>Avg Per Round-Up</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderProjections = () => {
    if (!analysis?.projections) return null;

    return (
      <View style={styles.projectionsContainer}>
        <Text style={styles.sectionTitle}>Savings Projections</Text>
        <Text style={styles.sectionSubtitle}>Based on your spending patterns</Text>
        <View style={styles.projectionsList}>
          <View style={styles.projectionRow}>
            <Text style={styles.projectionLabel}>This Month</Text>
            <Text style={styles.projectionValue}>{formatCurrency(analysis.projections.monthly)}</Text>
          </View>
          <View style={styles.projectionRow}>
            <Text style={styles.projectionLabel}>Next 3 Months</Text>
            <Text style={styles.projectionValue}>{formatCurrency(analysis.projections.quarterly)}</Text>
          </View>
          <View style={styles.projectionRow}>
            <Text style={styles.projectionLabel}>This Year</Text>
            <Text style={styles.projectionValue}>{formatCurrency(analysis.projections.yearly)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRecommendations = () => {
    if (!analysis?.recommendations || !Array.isArray(analysis.recommendations) || analysis.recommendations.length === 0) {
      return null;
    }

    return (
      <View style={styles.recommendationsContainer}>
        <Text style={styles.sectionTitle}>Smart Recommendations</Text>
        {analysis.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <Icon name="lightbulb" size={20} color={theme.colors.warning} />
              <Text style={styles.recommendationType}>{rec.type}</Text>
            </View>
            <Text style={styles.recommendationMessage}>{rec.message}</Text>
            <Text style={styles.recommendationSavings}>
              Could save {formatCurrency(rec.estimatedMonthlySavings)}/month
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const styles = createStyles(theme);

  if (isLoading && !rule) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading round-up settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle={theme.colors.statusBarStyle} backgroundColor={theme.colors.surface} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Round-Up Savings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Enable/Disable Section */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Enable Round-Up Savings</Text>
                <Text style={styles.toggleDescription}>
                  Automatically save spare change on every transaction
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleToggleEnabled}
                trackColor={{ false: theme.colors.gray300, true: theme.colors.accent }}
                thumbColor={isEnabled ? theme.colors.surface : theme.colors.gray400}
                disabled={isUpdating}
              />
            </View>
          </View>

          {/* Increment Options */}
          {isEnabled && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Round-Up Amount</Text>
              <Text style={styles.sectionSubtitle}>Choose how much to round up each transaction</Text>
              {INCREMENT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.incrementOption,
                    selectedIncrement === option.value && styles.incrementOptionSelected,
                  ]}
                  onPress={() => handleSelectIncrement(option.value)}
                  disabled={isUpdating}
                >
                  <View style={styles.incrementLeft}>
                    <View
                      style={[
                        styles.radio,
                        selectedIncrement === option.value && styles.radioSelected,
                      ]}
                    >
                      {selectedIncrement === option.value && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <Text style={styles.incrementLabel}>{option.label}</Text>
                      <Text style={styles.incrementDescription}>{option.description}</Text>
                    </View>
                  </View>
                  {option.value === 'auto' && (
                    <View style={styles.autoTag}>
                      <Text style={styles.autoTagText}>AI</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Percentage Input */}
              {selectedIncrement === 'percentage' && (
                <View style={styles.percentageInputContainer}>
                  <Text style={styles.percentageInputLabel}>Percentage (%)</Text>
                  <TextInput
                    style={styles.percentageInput}
                    value={percentageValue}
                    onChangeText={setPercentageValue}
                    keyboardType="decimal-pad"
                    placeholder="5"
                    placeholderTextColor={theme.colors.textTertiary}
                    maxLength={5}
                  />
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={() => handleSelectIncrement('percentage')}
                    disabled={isUpdating}
                  >
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Stats */}
          {isEnabled && renderStats()}

          {/* Projections */}
          {isEnabled && renderProjections()}

          {/* Recommendations */}
          {isEnabled && renderRecommendations()}

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Icon name="info" size={20} color={theme.colors.accent} />
              <Text style={styles.infoText}>
                Round-up savings are automatically transferred to your savings wallet after each transaction.
                Watch your savings grow effortlessly!
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  toggleDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  incrementOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray50,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  incrementOptionSelected: {
    backgroundColor: theme.colors.gray50,
    borderColor: theme.colors.accent,
  },
  incrementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    marginRight: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: theme.colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  incrementLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  incrementDescription: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  autoTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
  },
  autoTagText: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.bold,
    color: theme.colors.surface,
  },
  statsContainer: {
    padding: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray50,
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.fontSizes.lg,
    fontFamily: theme.fonts.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  projectionsContainer: {
    padding: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  projectionsList: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  projectionLabel: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
  },
  projectionValue: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
  },
  recommendationsContainer: {
    padding: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  recommendationCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#FEF3C7',
    marginBottom: theme.spacing.sm,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  recommendationType: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.xs,
  },
  recommendationMessage: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  recommendationSavings: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.success,
  },
  infoSection: {
    padding: theme.spacing.base,
  },
  infoCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray50,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    lineHeight: 20,
  },
  percentageInputContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  percentageInputLabel: {
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  percentageInput: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.DEFAULT,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.regular,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
  },
  applyButton: {
    height: 40,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: theme.fontSizes.base,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.surface,
  },
});

export default RoundUpSettingsScreen;
