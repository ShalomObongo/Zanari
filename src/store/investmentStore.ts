import { create } from 'zustand';

import apiClient, {
  SavingsInvestmentSummaryResponse,
  SavingsInvestmentPreferencePayload,
} from '@/services/api';

export interface SavingsInvestmentSummary {
  autoInvestEnabled: boolean;
  targetAllocationPct: number;
  productCode: string;
  productName: string;
  annualYieldBps: number;
  investedAmount: number;
  accruedInterest: number;
  projectedMonthlyYield: number;
  savingsCashBalance: number;
  savingsAvailableBalance: number;
  totalValue: number;
  lastAccruedAt: string | null;
}

interface SavingsInvestmentState {
  summary: SavingsInvestmentSummary | null;
  isLoading: boolean;
  error: string | null;
  fetchSummary: () => Promise<SavingsInvestmentSummary | null>;
  updatePreference: (payload: SavingsInvestmentPreferencePayload) => Promise<SavingsInvestmentSummary | null>;
  allocate: (amount: number) => Promise<SavingsInvestmentSummary | null>;
  redeem: (amount: number) => Promise<SavingsInvestmentSummary | null>;
  claimInterest: () => Promise<SavingsInvestmentSummary | null>;
}

const mapSummary = (response: SavingsInvestmentSummaryResponse['summary']): SavingsInvestmentSummary => ({
  autoInvestEnabled: response.auto_invest_enabled,
  targetAllocationPct: response.target_allocation_pct,
  productCode: response.product_code,
  productName: response.product_name,
  annualYieldBps: response.annual_yield_bps,
  investedAmount: response.invested_amount,
  accruedInterest: response.accrued_interest,
  projectedMonthlyYield: response.projected_monthly_yield,
  savingsCashBalance: response.savings_cash_balance,
  savingsAvailableBalance: response.savings_available_balance,
  totalValue: response.total_value,
  lastAccruedAt: response.last_accrued_at,
});

export const useSavingsInvestmentStore = create<SavingsInvestmentState>((set) => ({
  summary: null,
  isLoading: false,
  error: null,

  fetchSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getSavingsInvestmentSummary();
      const mapped = mapSummary(response.summary);
      set({ summary: mapped, isLoading: false });
      return mapped;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  updatePreference: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.updateSavingsInvestmentPreference(payload);
      const mapped = mapSummary(response.summary);
      set({ summary: mapped, isLoading: false });
      return mapped;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  allocate: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.allocateSavingsInvestment(amount);
      const mapped = mapSummary(response.summary);
      set({ summary: mapped, isLoading: false });
      return mapped;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  redeem: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.redeemSavingsInvestment(amount);
      const mapped = mapSummary(response.summary);
      set({ summary: mapped, isLoading: false });
      return mapped;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  claimInterest: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.claimSavingsInvestmentInterest();
      const mapped = mapSummary(response.summary);
      set({ summary: mapped, isLoading: false });
      return mapped;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
}));
