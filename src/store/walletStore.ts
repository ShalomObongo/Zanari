import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { ApiError } from '@/services/api';

export type WalletType = 'main' | 'savings';

export interface Wallet {
  id: string;
  wallet_type: WalletType;
  balance: number;
  available_balance: number;
  last_transaction_at: string | null;
  created_at: string;
  updated_at: string;
  withdrawal_restrictions: {
    min_settlement_delay_minutes: number;
    locked_until?: string | null;
  } | null;
}

export interface PendingWithdrawal {
  transactionId: string;
  walletId: string;
  amount: number;
  initiatedAt: string;
  settlementDelayMinutes: number;
  estimatedCompletion: string;
}

interface WalletListResponse {
  wallets: Wallet[];
}

interface WithdrawResponse {
  transaction_id: string;
  settlement_delay_minutes: number;
  estimated_completion: string;
}

interface WalletState {
  wallets: Wallet[];
  pendingWithdrawals: PendingWithdrawal[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  setWallets: (wallets: Wallet[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  fetchWallets: (options?: { force?: boolean }) => Promise<Wallet[]>;
  refreshWallets: () => Promise<Wallet[]>;
  getWalletByType: (type: WalletType) => Wallet | undefined;
  getTotalBalance: () => number;
  getAvailableBalance: () => number;
  applyWalletDelta: (walletId: string, delta: Partial<Wallet>) => void;
  withdraw: (params: { walletId: string; amount: number; pinToken: string; mpesaPhone: string }) => Promise<{
    transactionId: string;
    settlementDelayMinutes: number;
    estimatedCompletion: Date;
  }>;
  markWithdrawalAsCompleted: (transactionId: string) => void;
}

const toDate = (value: string | null) => (value ? new Date(value) : null);

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      wallets: [],
      pendingWithdrawals: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastSyncedAt: null,

      setWallets: (wallets) => {
        set({ wallets, error: null, lastSyncedAt: new Date().toISOString() });
      },

      setError: (error) => set({ error }),

      reset: () => {
        set({
          wallets: [],
          pendingWithdrawals: [],
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastSyncedAt: null,
        });
      },

      fetchWallets: async ({ force } = {}) => {
        const state = get();
        if (state.isLoading && !force) {
          return state.wallets;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.get<WalletListResponse>('/wallets');
          set({ wallets: response.wallets, lastSyncedAt: new Date().toISOString() });
          return response.wallets;
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

      refreshWallets: async () => {
        set({ isRefreshing: true });
        try {
          return await get().fetchWallets({ force: true });
        } finally {
          set({ isRefreshing: false });
        }
      },

      getWalletByType: (type) => get().wallets.find((wallet) => wallet.wallet_type === type),

      getTotalBalance: () => get().wallets.reduce((acc, wallet) => acc + wallet.balance, 0),

      getAvailableBalance: () => get().wallets.reduce((acc, wallet) => acc + wallet.available_balance, 0),

      applyWalletDelta: (walletId, delta) => {
        set((state) => ({
          wallets: state.wallets.map((wallet) =>
            wallet.id === walletId ? { ...wallet, ...delta, updated_at: new Date().toISOString() } : wallet
          ),
        }));
      },

      withdraw: async ({ walletId, amount, pinToken, mpesaPhone }) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.post<WithdrawResponse>(`/wallets/${walletId}/withdraw`, {
            amount,
            pin_token: pinToken,
            mpesa_phone: mpesaPhone,
          });

          set((state) => ({
            wallets: state.wallets.map((wallet) =>
              wallet.id === walletId
                ? {
                    ...wallet,
                    balance: Math.max(0, wallet.balance - amount),
                    available_balance: Math.max(0, wallet.available_balance - amount),
                    last_transaction_at: response.estimated_completion,
                    updated_at: new Date().toISOString(),
                  }
                : wallet
            ),
            pendingWithdrawals: [
              ...state.pendingWithdrawals,
              {
                transactionId: response.transaction_id,
                walletId,
                amount,
                initiatedAt: new Date().toISOString(),
                settlementDelayMinutes: response.settlement_delay_minutes,
                estimatedCompletion: response.estimated_completion,
              },
            ],
          }));

          return {
            transactionId: response.transaction_id,
            settlementDelayMinutes: response.settlement_delay_minutes,
            estimatedCompletion: new Date(response.estimated_completion),
          };
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

      markWithdrawalAsCompleted: (transactionId) => {
        set((state) => ({
          pendingWithdrawals: state.pendingWithdrawals.filter((pending) => pending.transactionId !== transactionId),
        }));
      },
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        wallets: state.wallets,
        pendingWithdrawals: state.pendingWithdrawals,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Clean up expired pending withdrawals based on current time
        const now = Date.now();
        state.pendingWithdrawals = state.pendingWithdrawals.filter((pending) => {
          const completion = toDate(pending.estimatedCompletion);
          return completion ? completion.getTime() > now : true;
        });
      },
    }
  )
);

export default useWalletStore;
