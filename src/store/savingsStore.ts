import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { ApiError } from '@/services/api';

export type SavingsGoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface SavingsGoalMilestone {
  milestone_id: string;
  name: string;
  percentage: number;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  achieved: boolean;
  achieved_at: string | null;
  celebrated: boolean;
}

export interface SavingsGoalNextMilestone {
  milestone_id: string;
  amount_remaining: number;
  target_amount: number;
  percentage: number;
  estimated_completion_days: number | null;
}

export interface SavingsGoalFinalProgress {
  saved_amount: number;
  target_amount: number;
  progress_percentage: number;
}

export interface SavingsGoal {
  goal_id: string;
  name: string;
  description: string | null;
  status: SavingsGoalStatus;
  category: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  target_date: string | null;
  days_until_target: number | null;
  target_date_warning: boolean;
  lock_in_enabled: boolean;
  milestones: SavingsGoalMilestone[];
  next_milestone: SavingsGoalNextMilestone | null;
  final_progress: SavingsGoalFinalProgress | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ListSavingsGoalsResponse {
  goals: SavingsGoal[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

interface CreateSavingsGoalPayload {
  name: string;
  description?: string;
  target_amount: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface UpdateSavingsGoalPayload {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface SavingsFilters {
  status?: SavingsGoalStatus | 'active,paused';
  category?: string;
  includeArchived?: boolean;
  sort?: 'created_at' | 'target_date';
}

type SavingsPagination = ListSavingsGoalsResponse['pagination'];

interface SavingsStoreState {
  goals: SavingsGoal[];
  pagination: SavingsPagination;
  filters: SavingsFilters;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  setFilters: (filters: Partial<SavingsFilters>) => void;
  resetGoals: () => void;
  fetchGoals: (options?: { force?: boolean; page?: number }) => Promise<SavingsGoal[]>;
  refreshGoals: () => Promise<SavingsGoal[]>;
  loadMoreGoals: () => Promise<SavingsGoal[]>;
  getGoalById: (goalId: string) => SavingsGoal | undefined;
  createGoal: (payload: CreateSavingsGoalPayload) => Promise<SavingsGoal>;
  updateGoal: (goalId: string, payload: UpdateSavingsGoalPayload) => Promise<SavingsGoal>;
  deleteGoal: (goalId: string) => Promise<void>;
  depositToGoal: (goalId: string, amount: number, sourceWallet?: 'main' | 'savings') => Promise<{
    goal: SavingsGoal;
    milestonesReached: any[];
    completed: boolean;
  }>;
  withdrawFromGoal: (goalId: string, destinationWallet?: 'main' | 'savings') => Promise<{
    goal: SavingsGoal;
    amount_withdrawn: number;
    destination_wallet: string;
  }>;
  getTotalSavedAmount: () => number;
  getTotalAllocatedToGoals: () => number;
  getActiveGoals: () => SavingsGoal[];
}

const DEFAULT_PAGINATION: SavingsPagination = {
  page: 1,
  per_page: 20,
  total_items: 0,
  total_pages: 0,
};

const mergeGoals = (existing: SavingsGoal[], incoming: SavingsGoal[], append: boolean) => {
  if (!append) {
    return incoming;
  }

  const map = new Map(existing.map((goal) => [goal.goal_id, goal] as const));
  for (const goal of incoming) {
    map.set(goal.goal_id, goal);
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
};

export const useSavingsStore = create<SavingsStoreState>()(
  persist(
    (set, get) => ({
      goals: [],
      pagination: DEFAULT_PAGINATION,
      filters: { includeArchived: false, sort: 'created_at' },
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      lastSyncedAt: null,

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      resetGoals: () => {
        set({ goals: [], pagination: { ...DEFAULT_PAGINATION }, lastSyncedAt: null });
      },

      fetchGoals: async ({ force, page } = {}) => {
        const state = get();
        if (state.isLoading && !force) {
          return state.goals;
        }

        const nextPage = page ?? (force ? 1 : state.pagination.page);

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<ListSavingsGoalsResponse>('/savings-goals', {
            searchParams: {
              page: nextPage,
              per_page: state.pagination.per_page,
              ...(state.filters.status ? { status: state.filters.status } : {}),
              ...(state.filters.category ? { category: state.filters.category } : {}),
              ...(state.filters.includeArchived ? { archived: 'true' } : {}),
              ...(state.filters.sort ? { sort: state.filters.sort } : {}),
            },
          });

          const append = response.pagination.page > 1;

          set((current) => ({
            goals: mergeGoals(current.goals, response.goals, append),
            pagination: response.pagination,
            lastSyncedAt: new Date().toISOString(),
          }));

          return response.goals;
        } catch (error) {
          if (error instanceof ApiError) {
            set({ error: error.message });
          } else {
            set({ error: (error as Error).message });
          }
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      refreshGoals: async () => {
        set({ isRefreshing: true });
        try {
          return await get().fetchGoals({ force: true, page: 1 });
        } finally {
          set({ isRefreshing: false });
        }
      },

      loadMoreGoals: async () => {
        const { pagination } = get();
        if (pagination.page >= pagination.total_pages) {
          return get().goals;
        }

        set({ isLoadingMore: true });
        try {
          return await get().fetchGoals({ force: true, page: pagination.page + 1 });
        } finally {
          set({ isLoadingMore: false });
        }
      },

      getGoalById: (goalId) => get().goals.find((goal) => goal.goal_id === goalId),

      createGoal: async (payload) => {
        try {
          const response = await apiClient.post<SavingsGoal>('/savings-goals', payload);

          set((state) => ({
            goals: [response, ...state.goals].slice(0, 100),
            pagination: {
              ...state.pagination,
              total_items: state.pagination.total_items + 1,
            },
          }));

          return response;
        } catch (error) {
          if (error instanceof ApiError) {
            set({ error: error.message });
          } else {
            set({ error: (error as Error).message });
          }
          throw error;
        }
      },

      updateGoal: async (goalId, payload) => {
        try {
          const response = await apiClient.put<SavingsGoal>(`/savings-goals/${goalId}`, payload);

          set((state) => ({
            goals: state.goals.map((goal) => (goal.goal_id === goalId ? response : goal)),
          }));

          return response;
        } catch (error) {
          if (error instanceof ApiError) {
            set({ error: error.message });
          } else {
            set({ error: (error as Error).message });
          }
          throw error;
        }
      },

      getTotalSavedAmount: () => get().goals.reduce((acc, goal) => acc + goal.current_amount, 0),

      getTotalAllocatedToGoals: () => {
        // Calculate total amount currently in all goals (active, paused, or completed but not withdrawn)
        return get().goals
          .filter((goal) => goal.status !== 'cancelled')
          .reduce((acc, goal) => acc + goal.current_amount, 0);
      },

      getActiveGoals: () => get().goals.filter((goal) => goal.status === 'active'),

      deleteGoal: async (goalId) => {
        set({ isLoading: true, error: null });

        try {
          await apiClient.deleteSavingsGoal(goalId);

          // Remove goal from local state
          set((state) => ({
            goals: state.goals.filter((goal) => goal.goal_id !== goalId),
            lastSyncedAt: new Date().toISOString(),
          }));
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to delete savings goal';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      depositToGoal: async (goalId, amount, sourceWallet = 'main') => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.depositToSavingsGoal(goalId, amount, sourceWallet);

          // Update goal in local state
          set((state) => ({
            goals: state.goals.map((goal) =>
              goal.goal_id === goalId ? response.goal : goal
            ),
            lastSyncedAt: new Date().toISOString(),
          }));

          return response;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to deposit to savings goal';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      withdrawFromGoal: async (goalId, destinationWallet = 'main') => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.withdrawFromSavingsGoal(goalId, destinationWallet);

          // Update goal in local state
          set((state) => ({
            goals: state.goals.map((goal) =>
              goal.goal_id === goalId ? response.goal : goal
            ),
            lastSyncedAt: new Date().toISOString(),
          }));

          return response;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? error.message
              : (error as Error).message ?? 'Failed to withdraw from savings goal';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'savings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        goals: state.goals.slice(0, 50),
        pagination: state.pagination,
        filters: state.filters,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

export default useSavingsStore;
