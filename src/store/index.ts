/**
 * Central store index - exports all Zustand stores
 * This is the main entry point for all state management
 */

// Core stores
import { useAuthStore } from './authStore';
import { useWalletStore } from './walletStore';
import { useTransactionStore } from './transactionStore';
import { useSavingsStore } from './savingsStore';

export { useAuthStore } from './authStore';
export { useAuthStatus, usePinLockStatus } from './authStore';
export { useWalletStore } from './walletStore';
export { useTransactionStore } from './transactionStore';
export { useSavingsStore } from './savingsStore';

// Store configuration and middleware
export const STORE_CONFIG = {
  // Storage configuration for persistence
  storageOptions: {
    // AsyncStorage is used for React Native
    // Sensitive data like PIN tokens are not persisted
    persistWhitelist: ['auth'],
  },
  
  // Performance configuration
  performanceOptions: {
    // Enable devtools in development
    devtools: process.env.NODE_ENV === 'development',
  },
};

// Store reset utility for testing and logout
export const resetAllStores = () => {
  useAuthStore.getState().clearAuth();
  useWalletStore.getState().reset();
  useTransactionStore.getState().resetTransactions();
  useSavingsStore.getState().resetGoals();
};