import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ApiError } from '@/services/api';

export interface RoundUpRule {
  user_id: string;
  increment_type: '10' | '50' | '100' | 'auto' | 'percentage';
  is_enabled: boolean;
  percentage_value?: number | null;
  auto_settings?: {
    min_increment?: number;
    max_increment?: number;
    target_amount?: number;
    analysis_period_days?: number;
    allocation_percentage?: number;
  };
  total_round_ups_count: number;
  total_amount_saved: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RoundUpAnalysis {
  user_id: string;
  analysis: {
    totalTransactions: number;
    totalRoundUps: number;
    averageRoundUp: number;
    potentialSavings: number;
    categoryBreakdown?: Array<{
      category: string;
      count: number;
      totalAmount: number;
      averageRoundUp: number;
    }>;
    weeklyBreakdown?: Array<{
      day: string;
      count: number;
      totalAmount: number;
    }>;
    merchantPatterns?: Array<{
      merchant: string;
      count: number;
      totalAmount: number;
    }>;
  };
  recommendations: Array<{
    type: string;
    message: string;
    increment: number;
    estimatedMonthlySavings: number;
  }>;
  projections?: {
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  generated_at: string;
}

interface RoundUpStoreState {
  rule: RoundUpRule | null;
  analysis: RoundUpAnalysis | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  lastSyncedAt: string | null;

  // Actions
  fetchRule: () => Promise<RoundUpRule>;
  updateRule: (updates: {
    increment_type?: '10' | '50' | '100' | 'auto' | 'percentage';
    is_enabled?: boolean;
    percentage_value?: number | null;
    auto_settings?: {
      min_increment?: number;
      max_increment?: number;
      target_amount?: number;
      analysis_period_days?: number;
      allocation_percentage?: number;
    };
  }) => Promise<RoundUpRule>;
  fetchAnalysis: (params?: {
    analysis_period_days?: number;
    include_projections?: boolean;
    include_category_breakdown?: boolean;
  }) => Promise<RoundUpAnalysis>;
  toggleEnabled: () => Promise<void>;
  resetError: () => void;
  clearRule: () => void;
}

export const useRoundUpStore = create<RoundUpStoreState>()(
  persist(
    (set, get) => ({
      rule: null,
      analysis: null,
      isLoading: false,
      isUpdating: false,
      error: null,
      lastSyncedAt: null,

      fetchRule: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.getRoundUpRule();
          const rule: RoundUpRule = {
            user_id: '', // Not provided in response
            increment_type: response.rule.increment_type as '10' | '50' | '100' | 'auto' | 'percentage',
            is_enabled: response.rule.is_enabled,
            percentage_value: response.rule.percentage_value ?? null,
            auto_settings: response.rule.auto_settings,
            total_round_ups_count: response.usage_statistics.total_round_ups_count,
            total_amount_saved: response.usage_statistics.total_amount_saved,
            last_used_at: response.last_updated_at || undefined,
            created_at: '', // Not provided in response
            updated_at: response.last_updated_at || '',
          };
          set({
            rule,
            lastSyncedAt: new Date().toISOString(),
          });
          return rule;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to fetch round-up rule';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      updateRule: async (updates) => {
        set({ isUpdating: true, error: null });

        try {
          // The API accepts both snake_case and camelCase, so we can send updates directly
          // But we need to convert property names to snake_case for the API
          const apiUpdates: any = {};

          if (updates.increment_type !== undefined) {
            apiUpdates.increment_type = updates.increment_type;
          }

          if (updates.is_enabled !== undefined) {
            apiUpdates.is_enabled = updates.is_enabled;
          }

          if (updates.percentage_value !== undefined) {
            apiUpdates.percentage_value = updates.percentage_value;
          }

          if (updates.auto_settings !== undefined) {
            apiUpdates.auto_settings = updates.auto_settings ? {
              min_increment: updates.auto_settings.min_increment,
              max_increment: updates.auto_settings.max_increment,
              analysis_period_days: updates.auto_settings.analysis_period_days,
            } : null;
          }

          const response = await apiClient.updateRoundUpRule(apiUpdates);

          // Re-fetch the rule to get the updated data in the correct format
          const updatedRule = await get().fetchRule();

          set({
            analysis: response.auto_analysis || get().analysis,
            lastSyncedAt: new Date().toISOString(),
          });

          return updatedRule;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to update round-up rule';
          set({ error: message });
          throw error;
        } finally {
          set({ isUpdating: false });
        }
      },

      fetchAnalysis: async (params) => {
        set({ isLoading: true, error: null });

        try {
          const analysis = await apiClient.analyzeRoundUp(params);
          set({
            analysis,
            lastSyncedAt: new Date().toISOString(),
          });
          return analysis;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to fetch round-up analysis';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      toggleEnabled: async () => {
        const currentRule = get().rule;
        if (!currentRule) {
          throw new Error('No round-up rule found');
        }

        await get().updateRule({ is_enabled: !currentRule.is_enabled });
      },

      resetError: () => set({ error: null }),

      clearRule: () => set({ rule: null, analysis: null, lastSyncedAt: null }),
    }),
    {
      name: 'roundup-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        rule: state.rule,
        analysis: state.analysis,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

export default useRoundUpStore;
