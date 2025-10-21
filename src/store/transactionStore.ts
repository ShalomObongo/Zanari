import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { ApiError } from '@/services/api';

export type TransactionType =
  | 'payment'
  | 'transfer_in'
  | 'transfer_out'
  | 'round_up'
  | 'bill_payment'
  | 'withdrawal'
  | 'deposit';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type TransactionCategory =
  | 'airtime'
  | 'groceries'
  | 'school_fees'
  | 'utilities'
  | 'transport'
  | 'entertainment'
  | 'savings'
  | 'transfer'
  | 'other';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee?: number | null;
  description: string | null;
  category: TransactionCategory;
  merchant_info: {
    name: string;
    till_number?: string | null;
    paybill_number?: string | null;
    account_number?: string | null;
  } | null;
  round_up_details: {
    original_amount: number;
    round_up_amount: number;
    round_up_rule: string;
    related_transaction_id: string;
  } | null;
  parent_transaction_id?: string | null;
  savings_goal_id?: string | null;
  paystack_reference?: string | null;
  paystack_transaction_id?: string | null;
  paystack_transfer_id?: string | null;
  paystack_recipient_code?: string | null;
  paystack_status?: string | null;
  gateway_response?: string | null;
  failure_reason?: string | null;
  recipient_info?: Record<string, unknown> | null;
  bill_info?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface UpdateCategoryResponse {
  transaction_id: string;
  new_category: TransactionCategory;
  previous_category: TransactionCategory;
  override_reason: string | null;
  override_source: string;
}

interface TransactionFilters {
  type?: TransactionType;
  category?: TransactionCategory;
}

interface TransactionState {
  transactions: Transaction[];
  pagination: TransactionListResponse['pagination'];
  filters: TransactionFilters;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetTransactions: () => void;
  fetchTransactions: (options?: { force?: boolean; offset?: number }) => Promise<Transaction[]>;
  refreshTransactions: () => Promise<Transaction[]>;
  loadMoreTransactions: () => Promise<Transaction[]>;
  getTransactionById: (transactionId: string) => Transaction | undefined;
  updateTransactionCategory: (transactionId: string, category: TransactionCategory, options?: {
    reason?: string;
    notes?: string;
  }) => Promise<UpdateCategoryResponse>;
}

const DEFAULT_PAGINATION: TransactionListResponse['pagination'] = {
  total: 0,
  limit: 20,
  offset: 0,
  has_more: false,
};

const mergeTransactionLists = (existing: Transaction[], incoming: Transaction[], append: boolean) => {
  if (!append) {
    return incoming;
  }

  const map = new Map(existing.map((transaction) => [transaction.id, transaction] as const));
  for (const transaction of incoming) {
    map.set(transaction.id, transaction);
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      pagination: DEFAULT_PAGINATION,
      filters: {},
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

      resetTransactions: () => {
        set({ transactions: [], pagination: { ...DEFAULT_PAGINATION }, lastSyncedAt: null });
      },

      fetchTransactions: async ({ force, offset } = {}) => {
        const state = get();
        if (state.isLoading && !force) {
          return state.transactions;
        }

        const nextOffset = offset ?? (force ? 0 : state.pagination.offset);

        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<TransactionListResponse>('/transactions', {
            searchParams: {
              limit: state.pagination.limit,
              offset: nextOffset,
              ...(state.filters.type ? { type: state.filters.type } : {}),
              ...(state.filters.category ? { category: state.filters.category } : {}),
            },
          });

          const append = response.pagination.offset > 0;

          set((current) => ({
            transactions: mergeTransactionLists(current.transactions, response.transactions, append).slice(0, 200),
            pagination: response.pagination,
            lastSyncedAt: new Date().toISOString(),
          }));

          return response.transactions;
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

      refreshTransactions: async () => {
        set({ isRefreshing: true });
        try {
          return await get().fetchTransactions({ force: true, offset: 0 });
        } finally {
          set({ isRefreshing: false });
        }
      },

      loadMoreTransactions: async () => {
        const { pagination, transactions } = get();
        if (!pagination.has_more) {
          return transactions;
        }

        set({ isLoadingMore: true });
        try {
          return await get().fetchTransactions({ force: true, offset: pagination.offset + pagination.limit });
        } finally {
          set({ isLoadingMore: false });
        }
      },

      getTransactionById: (transactionId) => get().transactions.find((transaction) => transaction.id === transactionId),

      updateTransactionCategory: async (transactionId, category, options) => {
        try {
          const response = await apiClient.put<UpdateCategoryResponse>(`/transactions/${transactionId}/category`, {
            category,
            reason: options?.reason,
            notes: options?.notes,
          });

          set((state) => ({
            transactions: state.transactions.map((transaction) =>
              transaction.id === transactionId
                ? {
                    ...transaction,
                    category: response.new_category,
                    updated_at: new Date().toISOString(),
                  }
                : transaction
            ),
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
    }),
    {
      name: 'transaction-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        transactions: state.transactions.slice(0, 100),
        pagination: state.pagination,
        filters: state.filters,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

export default useTransactionStore;
