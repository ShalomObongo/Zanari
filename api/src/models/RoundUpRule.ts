/**
 * Round-up rule domain model controlling automated savings increments.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type RoundUpIncrementType = '10' | '50' | '100' | 'auto' | 'percentage';

export interface AutoAnalyzeSettings {
  minIncrement: number;
  maxIncrement: number;
  analysisPeriodDays: number;
  lastAnalysisAt?: Date | null;
}

export interface RoundUpRule extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  incrementType: RoundUpIncrementType;
  isEnabled: boolean;
  percentageValue?: number | null; // For percentage-based round-ups (e.g., 5 for 5%)
  autoSettings?: AutoAnalyzeSettings | null;
  totalRoundUpsCount: number;
  totalAmountSaved: number;
  lastUsedAt?: Date | null;
}

export interface RoundUpRuleRow {
  id: string;
  user_id: string;
  increment_type: RoundUpIncrementType;
  is_enabled: boolean;
  percentage_value?: number | null;
  auto_settings?: {
    min_increment: number;
    max_increment: number;
    analysis_period_days: number;
    last_analysis_at?: string | null;
  } | null;
  total_round_ups_count: number;
  total_amount_saved: number;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
}

export interface CreateRoundUpRuleInput {
  id: UUID;
  userId: UUID;
  incrementType?: RoundUpIncrementType;
  isEnabled?: boolean;
  autoSettings?: AutoAnalyzeSettings | null;
}

function validateAutoSettings(settings: AutoAnalyzeSettings | null | undefined): void {
  if (!settings) return;
  assert(Number.isInteger(settings.minIncrement), 'minIncrement must be integer cents');
  assert(Number.isInteger(settings.maxIncrement), 'maxIncrement must be integer cents');
  assert(settings.minIncrement > 0, 'minIncrement must be positive');
  assert(settings.maxIncrement >= settings.minIncrement, 'maxIncrement must be >= minIncrement');
  assert(settings.analysisPeriodDays >= 7 && settings.analysisPeriodDays <= 90, 'Analysis period must be 7-90 days');
}

export function validateRoundUpRule(rule: RoundUpRule): void {
  validateAutoSettings(rule.autoSettings ?? null);
  assert(rule.totalRoundUpsCount >= 0, 'totalRoundUpsCount cannot be negative');
  assert(Number.isInteger(rule.totalAmountSaved) && rule.totalAmountSaved >= 0, 'totalAmountSaved must be non-negative integer');
  if (rule.incrementType === 'auto') {
    assert(rule.autoSettings != null, 'autoSettings required when incrementType is auto');
  }
  if (rule.incrementType === 'percentage') {
    assert(rule.percentageValue != null, 'percentageValue required when incrementType is percentage');
    assert(rule.percentageValue > 0 && rule.percentageValue <= 100, 'percentageValue must be between 0 and 100');
  }
}

export function createRoundUpRule(input: CreateRoundUpRuleInput): RoundUpRule {
  const now = new Date();
  const rule: RoundUpRule = {
    id: input.id,
    userId: input.userId,
    incrementType: input.incrementType ?? '10',
    isEnabled: input.isEnabled ?? true,
    autoSettings: input.autoSettings ?? null,
    totalRoundUpsCount: 0,
    totalAmountSaved: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  validateRoundUpRule(rule);
  return rule;
}

export function fromRow(row: RoundUpRuleRow): RoundUpRule {
  const rule: RoundUpRule = {
    id: row.id,
    userId: row.user_id,
    incrementType: row.increment_type,
    isEnabled: row.is_enabled,
    percentageValue: row.percentage_value ?? null,
    autoSettings: row.auto_settings
      ? {
          minIncrement: row.auto_settings.min_increment,
          maxIncrement: row.auto_settings.max_increment,
          analysisPeriodDays: row.auto_settings.analysis_period_days,
          lastAnalysisAt: row.auto_settings.last_analysis_at ? new Date(row.auto_settings.last_analysis_at) : null,
        }
      : null,
    totalRoundUpsCount: row.total_round_ups_count,
    totalAmountSaved: row.total_amount_saved,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  validateRoundUpRule(rule);
  return rule;
}

export function toRow(rule: RoundUpRule): RoundUpRuleRow {
  validateRoundUpRule(rule);

  return {
    id: rule.id,
    user_id: rule.userId,
    increment_type: rule.incrementType,
    is_enabled: rule.isEnabled,
    percentage_value: rule.percentageValue ?? null,
    auto_settings: rule.autoSettings
      ? {
          min_increment: rule.autoSettings.minIncrement,
          max_increment: rule.autoSettings.maxIncrement,
          analysis_period_days: rule.autoSettings.analysisPeriodDays,
          last_analysis_at: rule.autoSettings.lastAnalysisAt ? rule.autoSettings.lastAnalysisAt.toISOString() : null,
        }
      : null,
    total_round_ups_count: rule.totalRoundUpsCount,
    total_amount_saved: rule.totalAmountSaved,
    created_at: rule.createdAt.toISOString(),
    updated_at: rule.updatedAt.toISOString(),
    last_used_at: rule.lastUsedAt ? rule.lastUsedAt.toISOString() : null,
  };
}
