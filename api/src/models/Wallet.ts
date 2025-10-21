/**
 * Wallet domain model representing user financial accounts.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type WalletType = 'main' | 'savings';

export interface SavingsWithdrawalRestrictions {
  minSettlementDelayMinutes: number;
  lockedUntil?: Date | null;
}

export interface Wallet extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  walletType: WalletType;
  balance: number; // stored in cents (KES)
  availableBalance: number; // cents
  lastTransactionAt?: Date | null;
  withdrawalRestrictions?: SavingsWithdrawalRestrictions | null;
}

export interface WalletRow {
  id: string;
  user_id: string;
  wallet_type: WalletType;
  balance: number;
  available_balance: number;
  created_at: string;
  updated_at: string;
  last_transaction_at?: string | null;
  withdrawal_restrictions?: {
    min_settlement_delay_minutes: number;
    locked_until?: string | null;
  } | null;
}

export interface CreateWalletInput {
  id: UUID;
  userId: UUID;
  walletType: WalletType;
  balance?: number;
  availableBalance?: number;
  withdrawalRestrictions?: SavingsWithdrawalRestrictions | null;
}

function validateAmount(amount: number, label: string): void {
  assert(Number.isInteger(amount), `${label} must be an integer representing cents`);
  assert(amount >= 0, `${label} cannot be negative`, 'NEGATIVE_BALANCE');
}

export function validateWallet(wallet: Wallet): void {
  validateAmount(wallet.balance, 'balance');
  validateAmount(wallet.availableBalance, 'availableBalance');
  assert(wallet.availableBalance <= wallet.balance, 'availableBalance cannot exceed balance');
  if (wallet.withdrawalRestrictions) {
    assert(wallet.walletType === 'savings', 'Withdrawal restrictions only apply to savings wallets');
    assert(Number.isInteger(wallet.withdrawalRestrictions.minSettlementDelayMinutes), 'minSettlementDelayMinutes must be integer minutes');
    assert(wallet.withdrawalRestrictions.minSettlementDelayMinutes >= 1, 'Minimum settlement delay must be at least 1 minute');
  }
}

export function createWallet(input: CreateWalletInput): Wallet {
  const now = new Date();
  const wallet: Wallet = {
    id: input.id,
    userId: input.userId,
    walletType: input.walletType,
    balance: input.balance ?? 0,
    availableBalance: input.availableBalance ?? 0,
    lastTransactionAt: null,
    withdrawalRestrictions: input.withdrawalRestrictions ?? null,
    createdAt: now,
    updatedAt: now,
  };

  validateWallet(wallet);
  return wallet;
}

export function fromRow(row: WalletRow): Wallet {
  const wallet: Wallet = {
    id: row.id,
    userId: row.user_id,
    walletType: row.wallet_type,
    balance: row.balance,
    availableBalance: row.available_balance,
    lastTransactionAt: row.last_transaction_at ? new Date(row.last_transaction_at) : null,
    withdrawalRestrictions: row.withdrawal_restrictions
      ? {
          minSettlementDelayMinutes: row.withdrawal_restrictions.min_settlement_delay_minutes,
          lockedUntil: row.withdrawal_restrictions.locked_until
            ? new Date(row.withdrawal_restrictions.locked_until)
            : null,
        }
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  validateWallet(wallet);
  return wallet;
}

export function toRow(wallet: Wallet): WalletRow {
  validateWallet(wallet);

  return {
    id: wallet.id,
    user_id: wallet.userId,
    wallet_type: wallet.walletType,
    balance: wallet.balance,
    available_balance: wallet.availableBalance,
    created_at: wallet.createdAt.toISOString(),
    updated_at: wallet.updatedAt.toISOString(),
    last_transaction_at: wallet.lastTransactionAt ? wallet.lastTransactionAt.toISOString() : null,
    withdrawal_restrictions: wallet.withdrawalRestrictions
      ? {
          min_settlement_delay_minutes: wallet.withdrawalRestrictions.minSettlementDelayMinutes,
          locked_until: wallet.withdrawalRestrictions.lockedUntil
            ? wallet.withdrawalRestrictions.lockedUntil.toISOString()
            : null,
        }
      : null,
  };
}
