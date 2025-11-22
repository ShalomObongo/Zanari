/**
 * Transaction domain model capturing all monetary movements.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type TransactionType =
  | 'payment'
  | 'transfer_in'
  | 'transfer_out'
  | 'round_up'
  | 'bill_payment'
  | 'withdrawal'
  | 'deposit'
  | 'investment_allocation'
  | 'investment_redemption'
  | 'interest_payout';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type TransactionCategory =
  | 'airtime'
  | 'groceries'
  | 'school_fees'
  | 'utilities'
  | 'transport'
  | 'entertainment'
  | 'savings'
  | 'investment'
  | 'transfer'
  | 'other';

export type PaymentMethod = 'mpesa' | 'card' | 'internal';

export interface MerchantInfo {
  name: string;
  tillNumber?: string | null;
  paybillNumber?: string | null;
  accountNumber?: string | null;
}

export interface RoundUpDetails {
  originalAmount: number;
  roundUpAmount: number;
  roundUpRule: string;
  relatedTransactionId: UUID;
}

export interface RetryInfo {
  retryCount: number;
  lastRetryAt?: Date | null;
  nextRetryAt?: Date | null;
}

export interface Transaction extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee?: number | null;
  fromWalletId?: UUID | null;
  toWalletId?: UUID | null;
  externalTransactionId?: string | null;
  externalReference?: string | null;
  paymentMethod?: PaymentMethod | null;
  merchantInfo?: MerchantInfo | null;
  roundUpDetails?: RoundUpDetails | null;
  category: TransactionCategory;
  autoCategorized: boolean;
  description?: string | null;
  completedAt?: Date | null;
  retry: RetryInfo;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee?: number | null;
  from_wallet_id?: string | null;
  to_wallet_id?: string | null;
  external_transaction_id?: string | null;
  external_reference?: string | null;
  payment_method?: PaymentMethod | null;
  merchant_info?: {
    name: string;
    till_number?: string | null;
    paybill_number?: string | null;
    account_number?: string | null;
  } | null;
  round_up_details?: {
    original_amount: number;
    round_up_amount: number;
    round_up_rule: string;
    related_transaction_id: string;
  } | null;
  category: TransactionCategory;
  auto_categorized: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  retry_count: number;
  last_retry_at?: string | null;
  next_retry_at?: string | null;
}

export interface CreateTransactionInput {
  id: UUID;
  userId: UUID;
  type: TransactionType;
  status?: TransactionStatus;
  amount: number;
  fee?: number | null;
  fromWalletId?: UUID | null;
  toWalletId?: UUID | null;
  externalTransactionId?: string | null;
  externalReference?: string | null;
  paymentMethod?: PaymentMethod | null;
  merchantInfo?: MerchantInfo | null;
  roundUpDetails?: RoundUpDetails | null;
  category: TransactionCategory;
  autoCategorized?: boolean;
  description?: string | null;
}

function validateAmount(value: number, label: string): void {
  assert(Number.isInteger(value), `${label} must be expressed in cents (integer)`);
  assert(value > 0, `${label} must be greater than zero`, 'INVALID_AMOUNT');
}

function validateFee(value: number | null | undefined): void {
  if (value == null) return;
  assert(Number.isInteger(value), 'fee must be expressed in cents (integer)');
  assert(value >= 0, 'fee cannot be negative');
}

function validateMerchantInfo(info: MerchantInfo | null | undefined): void {
  if (!info) return;
  assert(info.name.trim().length > 0, 'Merchant name required');
}

function validateRoundUp(details: RoundUpDetails | null | undefined, amount: number): void {
  if (!details) return;
  validateAmount(details.originalAmount, 'roundUp.originalAmount');
  assert(Number.isInteger(details.roundUpAmount), 'Round-up amount must be in cents');
  assert(details.roundUpAmount >= 0, 'Round-up amount cannot be negative');
  assert(details.roundUpAmount <= details.originalAmount, 'Round-up amount cannot exceed original transaction amount');
}

function validateRetry(retry: RetryInfo): void {
  assert(retry.retryCount >= 0, 'Retry count cannot be negative');
}

export function validateTransaction(transaction: Transaction): void {
  validateAmount(transaction.amount, 'amount');
  validateFee(transaction.fee);
  validateMerchantInfo(transaction.merchantInfo);
  validateRoundUp(transaction.roundUpDetails, transaction.amount);
  validateRetry(transaction.retry);
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  const now = new Date();
  const transaction: Transaction = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    status: input.status ?? 'pending',
    amount: input.amount,
    fee: input.fee ?? null,
    fromWalletId: input.fromWalletId ?? null,
    toWalletId: input.toWalletId ?? null,
    externalTransactionId: input.externalTransactionId ?? null,
    externalReference: input.externalReference ?? null,
    paymentMethod: input.paymentMethod ?? null,
    merchantInfo: input.merchantInfo ?? null,
    roundUpDetails: input.roundUpDetails ?? null,
    category: input.category,
    autoCategorized: input.autoCategorized ?? true,
    description: input.description ?? null,
    completedAt: null,
    retry: {
      retryCount: 0,
      lastRetryAt: null,
      nextRetryAt: null,
    },
    createdAt: now,
    updatedAt: now,
  };

  validateTransaction(transaction);
  return transaction;
}

export function fromRow(row: TransactionRow): Transaction {
  const transaction: Transaction = {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    fee: row.fee ?? null,
    fromWalletId: row.from_wallet_id ?? null,
    toWalletId: row.to_wallet_id ?? null,
    externalTransactionId: row.external_transaction_id ?? null,
    externalReference: row.external_reference ?? null,
    paymentMethod: row.payment_method ?? null,
    merchantInfo: row.merchant_info
      ? {
          name: row.merchant_info.name,
          tillNumber: row.merchant_info.till_number ?? null,
          paybillNumber: row.merchant_info.paybill_number ?? null,
          accountNumber: row.merchant_info.account_number ?? null,
        }
      : null,
    roundUpDetails: row.round_up_details
      ? {
          originalAmount: row.round_up_details.original_amount,
          roundUpAmount: row.round_up_details.round_up_amount,
          roundUpRule: row.round_up_details.round_up_rule,
          relatedTransactionId: row.round_up_details.related_transaction_id,
        }
      : null,
    category: row.category,
    autoCategorized: row.auto_categorized,
    description: row.description ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    retry: {
      retryCount: row.retry_count,
      lastRetryAt: row.last_retry_at ? new Date(row.last_retry_at) : null,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
    },
  };

  validateTransaction(transaction);
  return transaction;
}

export function toRow(transaction: Transaction): TransactionRow {
  validateTransaction(transaction);

  return {
    id: transaction.id,
    user_id: transaction.userId,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    fee: transaction.fee ?? null,
    from_wallet_id: transaction.fromWalletId ?? null,
    to_wallet_id: transaction.toWalletId ?? null,
    external_transaction_id: transaction.externalTransactionId ?? null,
    external_reference: transaction.externalReference ?? null,
    payment_method: transaction.paymentMethod ?? null,
    merchant_info: transaction.merchantInfo
      ? {
          name: transaction.merchantInfo.name,
          till_number: transaction.merchantInfo.tillNumber ?? null,
          paybill_number: transaction.merchantInfo.paybillNumber ?? null,
          account_number: transaction.merchantInfo.accountNumber ?? null,
        }
      : null,
    round_up_details: transaction.roundUpDetails
      ? {
          original_amount: transaction.roundUpDetails.originalAmount,
          round_up_amount: transaction.roundUpDetails.roundUpAmount,
          round_up_rule: transaction.roundUpDetails.roundUpRule,
          related_transaction_id: transaction.roundUpDetails.relatedTransactionId,
        }
      : null,
    category: transaction.category,
    auto_categorized: transaction.autoCategorized,
    description: transaction.description ?? null,
    created_at: transaction.createdAt.toISOString(),
    updated_at: transaction.updatedAt.toISOString(),
    completed_at: transaction.completedAt ? transaction.completedAt.toISOString() : null,
    retry_count: transaction.retry.retryCount,
    last_retry_at: transaction.retry.lastRetryAt ? transaction.retry.lastRetryAt.toISOString() : null,
    next_retry_at: transaction.retry.nextRetryAt ? transaction.retry.nextRetryAt.toISOString() : null,
  };
}
