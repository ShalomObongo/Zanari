import { UUID, TimestampedEntity, assert } from './base';

export interface SavingsInvestmentPreference extends TimestampedEntity {
  userId: UUID;
  autoInvestEnabled: boolean;
  targetAllocationPct: number;
  preferredProductCode: string;
}

export interface SavingsInvestmentPreferenceRow {
  user_id: string;
  auto_invest_enabled: boolean;
  target_allocation_pct: number;
  preferred_product_code: string;
  created_at: string;
  updated_at: string;
}

export function createDefaultPreference(userId: UUID): SavingsInvestmentPreference {
  const now = new Date();
  return {
    userId,
    autoInvestEnabled: false,
    targetAllocationPct: 100,
    preferredProductCode: 'default_savings_pool',
    createdAt: now,
    updatedAt: now,
  };
}

function validatePreference(pref: SavingsInvestmentPreference): void {
  assert(pref.targetAllocationPct >= 0 && pref.targetAllocationPct <= 100, 'targetAllocationPct must be between 0 and 100');
  assert(pref.preferredProductCode.length > 0, 'preferredProductCode must be set');
}

export function fromRow(row: SavingsInvestmentPreferenceRow, userId: UUID): SavingsInvestmentPreference {
  const preference: SavingsInvestmentPreference = {
    userId,
    autoInvestEnabled: row.auto_invest_enabled,
    targetAllocationPct: row.target_allocation_pct,
    preferredProductCode: row.preferred_product_code,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  validatePreference(preference);
  return preference;
}

export function toRow(pref: SavingsInvestmentPreference): SavingsInvestmentPreferenceRow {
  validatePreference(pref);
  return {
    user_id: pref.userId,
    auto_invest_enabled: pref.autoInvestEnabled,
    target_allocation_pct: pref.targetAllocationPct,
    preferred_product_code: pref.preferredProductCode,
    created_at: pref.createdAt.toISOString(),
    updated_at: pref.updatedAt.toISOString(),
  };
}
