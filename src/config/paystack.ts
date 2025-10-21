/**
 * Paystack SDK Configuration for React Native
 * 
 * Based on Paystack Documentation:
 * - Developer Tools: https://paystack.com/docs/developer-tools/
 * - Accept Payments: https://paystack.com/docs/payments/accept-payments/
 * - Test Payments: https://paystack.com/docs/payments/test-payments/
 * - React Native WebView: https://github.com/just1and0/React-Native-Paystack-WebView
 */

import { Alert } from 'react-native';

// Environment configuration
export const PAYSTACK_CONFIG = {
  // Public key - safe to use in mobile app
  publicKey: process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_your_public_key',
  
  // Test environment configuration
  environment: {
    isTest: process.env.NODE_ENV !== 'production',
    apiBaseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://api.paystack.co' 
      : 'https://api.paystack.co', // Same endpoint for both test and live
  },
  
  // Supported channels for mobile payments in Kenya
  channels: ['mobile_money', 'card'] as const,
  
  // Currency configuration
  currency: 'KES' as const,
  
  // Transaction limits (in cents) - KES 5,000 single, KES 20,000 daily
  limits: {
    singleTransaction: 500000, // KES 5,000 in cents
    dailyTransaction: 2000000, // KES 20,000 in cents
  },
  
  // Test credentials and data
  test: {
    // Test M-Pesa number from Paystack docs
    mpesaNumbers: [
      '+254710000000', // No PIN/OTP validation
    ],
    
    // Test cards for fallback/testing
    cards: {
      success: {
        number: '4084084084084081',
        expiryMonth: '09',
        expiryYear: '26',
        cvv: '408',
      },
      failure: {
        number: '4084080000005408',
        expiryMonth: '09',
        expiryYear: '26',
        cvv: '001',
      },
    },
  },
};

// Validation helpers
export const validatePaystackConfig = (): boolean => {
  if (!PAYSTACK_CONFIG.publicKey || PAYSTACK_CONFIG.publicKey.includes('your_public_key')) {
    Alert.alert(
      'Configuration Error', 
      'Paystack public key not configured. Please set EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY in your environment variables.'
    );
    return false;
  }
  
  // Validate public key format
  const isTestKey = PAYSTACK_CONFIG.publicKey.startsWith('pk_test_');
  const isLiveKey = PAYSTACK_CONFIG.publicKey.startsWith('pk_live_');
  
  if (!isTestKey && !isLiveKey) {
    Alert.alert(
      'Configuration Error',
      'Invalid Paystack public key format. Key must start with pk_test_ or pk_live_'
    );
    return false;
  }
  
  // Warn if using test key in production
  if (process.env.NODE_ENV === 'production' && isTestKey) {
    console.warn('WARNING: Using test Paystack key in production environment');
  }
  
  return true;
};

// Amount utilities for Paystack (amounts in kobo/cents)
export const PaystackUtils = {
  // Convert KES to cents (Paystack expects smallest unit)
  kesToCents: (kes: number): number => Math.round(kes * 100),
  
  // Convert cents to KES for display
  centsToKes: (cents: number): number => cents / 100,
  
  // Format amount for display
  formatAmount: (cents: number): string => {
    const kes = PaystackUtils.centsToKes(cents);
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(kes);
  },
  
  // Validate transaction amount against limits
  validateAmount: (cents: number): { valid: boolean; error?: string } => {
    if (cents <= 0) {
      return { valid: false, error: 'Amount must be greater than zero' };
    }
    
    if (cents > PAYSTACK_CONFIG.limits.singleTransaction) {
      const maxKes = PaystackUtils.centsToKes(PAYSTACK_CONFIG.limits.singleTransaction);
      return { valid: false, error: `Amount exceeds single transaction limit of KES ${maxKes}` };
    }
    
    return { valid: true };
  },
};

// Payment request types for TypeScript support
export interface PaystackPaymentRequest {
  amount: number; // Amount in cents
  email: string;
  channels?: typeof PAYSTACK_CONFIG.channels;
  currency?: typeof PAYSTACK_CONFIG.currency;
  reference?: string;
  callback_url?: string;
  metadata?: {
    user_id?: string;
    transaction_type?: string;
    [key: string]: any;
  };
  mobile_money?: {
    phone: string;
    provider: 'mpesa';
  };
}

export interface PaystackPaymentResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    trans: string;
    transaction: string;
    trxref: string;
    redirecturl?: string;
  };
}

// Retry configuration for failed payments (exponential backoff)
export const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 2000, 4000], // 1s, 2s, 4s intervals as per requirements
  
  // Calculate delay for retry attempt
  getDelayForAttempt: (attempt: number): number => {
    if (attempt >= RETRY_CONFIG.delays.length) {
      return RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1] || 4000;
    }
    return RETRY_CONFIG.delays[attempt] || 1000;
  },
};

// Error codes mapping from Paystack API
export const PAYSTACK_ERROR_CODES = {
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  INVALID_CARD: 'invalid_card',
  TRANSACTION_NOT_PERMITTED: 'transaction_not_permitted',
  CARD_EXPIRED: 'card_expired',
  INCORRECT_PIN: 'incorrect_pin',
  NETWORK_ERROR: 'network_error',
} as const;

export type PaystackErrorCode = typeof PAYSTACK_ERROR_CODES[keyof typeof PAYSTACK_ERROR_CODES];

export default PAYSTACK_CONFIG;