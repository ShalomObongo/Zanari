import { UUID, TimestampedEntity, assert } from './base';

export interface SavingsInvestmentPosition extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  productCode: string;
  investedAmount: number;
  accruedInterest: number;
  lastAccruedAt: Date | null;
}

export interface SavingsInvestmentPositionRow {
  id: string;
  user_id: string;
  product_code: string;
  invested_amount: number;
  accrued_interest: number;
  last_accrued_at?: string | null;
  created_at: string;
  updated_at: string;
}

export function createSavingsInvestmentPosition(input: {
  id: UUID;
  userId: UUID;
  productCode?: string;
  investedAmount?: number;
  accruedInterest?: number;
  lastAccruedAt?: Date | null;
}): SavingsInvestmentPosition {
  const now = new Date();
  const position: SavingsInvestmentPosition = {
    id: input.id,
    userId: input.userId,
    productCode: input.productCode ?? 'default_savings_pool',
    investedAmount: input.investedAmount ?? 0,
    accruedInterest: input.accruedInterest ?? 0,
    lastAccruedAt: input.lastAccruedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  validatePosition(position);
  return position;
}

function validatePosition(position: SavingsInvestmentPosition): void {
  assert(position.investedAmount >= 0, 'investedAmount cannot be negative');
  assert(Number.isInteger(position.investedAmount), 'investedAmount must be stored in cents');
  assert(position.accruedInterest >= 0, 'accruedInterest cannot be negative');
  assert(Number.isInteger(position.accruedInterest), 'accruedInterest must be stored in cents');
  assert(position.productCode.length > 0, 'productCode must be provided');
}

export function fromRow(row: SavingsInvestmentPositionRow): SavingsInvestmentPosition {
  const position: SavingsInvestmentPosition = {
    id: row.id,
    userId: row.user_id,
    productCode: row.product_code,
    investedAmount: row.invested_amount,
    accruedInterest: row.accrued_interest,
    lastAccruedAt: row.last_accrued_at ? new Date(row.last_accrued_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  validatePosition(position);
  return position;
}

export function toRow(position: SavingsInvestmentPosition): SavingsInvestmentPositionRow {
  validatePosition(position);
  return {
    id: position.id,
    user_id: position.userId,
    product_code: position.productCode,
    invested_amount: position.investedAmount,
    accrued_interest: position.accruedInterest,
    last_accrued_at: position.lastAccruedAt ? position.lastAccruedAt.toISOString() : null,
    created_at: position.createdAt.toISOString(),
    updated_at: position.updatedAt.toISOString(),
  };
}
