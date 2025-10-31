/**
 * Round-up rule HTTP route handlers covering configuration retrieval, updates, and auto-analysis.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../models/base';
import { RoundUpRule, createRoundUpRule, validateRoundUpRule } from '../models/RoundUpRule';
import { Transaction } from '../models/Transaction';
import { AutoAnalyzeService } from '../services/AutoAnalyzeService';
import {
  Clock,
  Logger,
  NullLogger,
  RoundUpRuleRepository,
  SystemClock,
  TransactionRepository,
} from '../services/types';
import { HttpError, badRequest, fromValidationError } from './errors';
import { ensureAuthenticated } from './handler';
import { ok } from './responses';
import { HttpRequest } from './types';

interface GetRulesQuery extends Record<string, string | undefined> {
  include_breakdown?: string;
}

interface UpdateRoundUpRuleBody {
  is_enabled?: boolean;
  enabled?: boolean;
  increment_type?: '10' | '50' | '100' | 'auto' | 'percentage';
  percentage_value?: number | null;
  rule_type?: 'target' | 'fixed' | 'auto';
  auto_settings?: {
    min_increment?: number;
    max_increment?: number;
    analysis_period_days?: number;
  } | null;
  allocation?: {
    main_wallet_percentage?: number;
    savings_goals_percentage?: number;
  } | null;
  target_amount?: number | null;
  fixed_amount?: number | null;
}

interface AutoAnalyzeQuery extends Record<string, string | undefined> {
  analysis_period_days?: string;
  include_projections?: string;
  include_category_breakdown?: string;
}

type RuleType = 'auto' | 'target' | 'fixed';

export interface RoundUpRuleRouteDependencies {
  roundUpRuleRepository: RoundUpRuleRepository;
  transactionRepository: TransactionRepository;
  autoAnalyzeService: AutoAnalyzeService;
  clock?: Clock;
  logger?: Logger;
}

const MIN_INCREMENT = 10;
const MAX_INCREMENT = 5_000;
const MIN_ANALYSIS_PERIOD = 7;
const MAX_ANALYSIS_PERIOD = 120;
const DEFAULT_ANALYSIS_PERIOD = 60;
const MAX_PERCENTAGE = 100;
const DEFAULT_TARGET_AMOUNT = 1_000;
const VALID_TARGET_AMOUNTS = new Set([100, 500, 1_000, 5_000, 10_000]);
const MIN_FIXED_AMOUNT = 100;
const MAX_FIXED_AMOUNT = 10_000;
const MIN_TRANSACTIONS_FOR_ANALYSIS = 30;
const MIN_AMOUNT_FOR_ANALYSIS = 5_000_000;
const DATA_INSUFFICIENT_RECOMMENDATION = 'Use app for at least 30 more days for better analysis';
const DATA_GATHERING_SUGGESTIONS = [
  'Continue using the app for daily transactions',
  'Connect more payment methods',
  'Enable transaction categorization',
];
const DAILY_ACTIVITY_THRESHOLD = 1.5;

const allocationStore = new Map<string, { main: number; savings: number }>();
const targetStore = new Map<string, { targetAmount: number | null; fixedAmount: number | null }>();
const hasOwn = Object.prototype.hasOwnProperty;

function readTargetSettings(userId: string) {
  return targetStore.get(userId) ?? { targetAmount: DEFAULT_TARGET_AMOUNT, fixedAmount: null };
}

function resolveRuleTypeFromState(rule: RoundUpRule): RuleType {
  if (rule.incrementType === 'auto') {
    return 'auto';
  }
  const targets = targetStore.get(rule.userId);
  if (targets?.fixedAmount != null) {
    return 'fixed';
  }
  return 'target';
}

function resolveIncrementType(
  baseRule: RoundUpRule,
  updates: ReturnType<typeof parseUpdateBody>,
  ruleType: RuleType,
): RoundUpRule['incrementType'] {
  if (updates.incrementType) {
    return updates.incrementType;
  }
  if (ruleType === 'auto') {
    return 'auto';
  }
  if (baseRule.incrementType === 'auto') {
    return '10';
  }
  return baseRule.incrementType;
}

function validateRuleConfiguration(ruleType: RuleType, targetAmount: number | null, fixedAmount: number | null) {
  if (ruleType === 'target') {
    if (targetAmount == null) {
      throw badRequest('target_amount is required when rule_type is "target"', 'MISSING_TARGET_AMOUNT');
    }
    if (!VALID_TARGET_AMOUNTS.has(targetAmount)) {
      throw badRequest(
        'Invalid target amount. Valid targets: 100 (KES 1), 500 (KES 5), 1000 (KES 10), 5000 (KES 50), 10000 (KES 100)',
        'INVALID_TARGET_AMOUNT',
      );
    }
  }

  if (ruleType === 'fixed') {
    if (fixedAmount == null) {
      throw badRequest('fixed_amount is required when rule_type is "fixed"', 'MISSING_FIXED_AMOUNT');
    }
    if (fixedAmount < MIN_FIXED_AMOUNT || fixedAmount > MAX_FIXED_AMOUNT) {
      throw badRequest('Fixed amount must be between KES 1.00 and KES 100.00', 'INVALID_FIXED_AMOUNT', {
        minimum: MIN_FIXED_AMOUNT,
        maximum: MAX_FIXED_AMOUNT,
      });
    }
  }
}

function normalizeTargetSettings(options: {
  providedTarget: number | null;
  providedFixed: number | null;
  resolvedRuleType: RuleType;
  existing: { targetAmount: number | null; fixedAmount: number | null };
}) {
  const targetAmount = options.providedTarget ?? options.existing.targetAmount ?? DEFAULT_TARGET_AMOUNT;
  const fixedAmount = options.providedFixed ?? options.existing.fixedAmount ?? null;

  if (options.resolvedRuleType === 'fixed') {
    return { targetAmount, fixedAmount };
  }

  return { targetAmount, fixedAmount: options.resolvedRuleType === 'target' ? null : fixedAmount };
}

function evaluateDataSufficiency(totalTransactions: number, totalAmount: number) {
  const sufficient = totalTransactions >= MIN_TRANSACTIONS_FOR_ANALYSIS && totalAmount >= MIN_AMOUNT_FOR_ANALYSIS;
  const result: Record<string, unknown> = {
    sufficient,
    minimum_transactions_needed: MIN_TRANSACTIONS_FOR_ANALYSIS,
    minimum_amount_needed: MIN_AMOUNT_FOR_ANALYSIS,
    transactions_observed: totalTransactions,
    amount_observed: totalAmount,
  };

  if (!sufficient) {
    result.recommendation = DATA_INSUFFICIENT_RECOMMENDATION;
  }

  return result;
}

export function createRoundUpRuleRoutes({
  roundUpRuleRepository,
  transactionRepository,
  autoAnalyzeService,
  clock = new SystemClock(),
  logger = NullLogger,
}: RoundUpRuleRouteDependencies) {
  return {
    getRule: async (
      request: HttpRequest<unknown, Record<string, string>, GetRulesQuery>,
    ) => {
      ensureAuthenticated(request);
      const includeBreakdown = parseBoolean(request.query.include_breakdown, false);

      const rule = await roundUpRuleRepository.findByUserId(request.userId);
      const now = clock.now();

      const response = await buildRuleResponse({
        rule,
        userId: request.userId,
        includeBreakdown,
        now,
        transactionRepository,
      });

      return ok(response);
    },

    updateRule: async (request: HttpRequest<UpdateRoundUpRuleBody>) => {
      ensureAuthenticated(request);
      const userId = request.userId;

      const existing = await roundUpRuleRepository.findByUserId(userId);
      const baseRule = existing ?? createRoundUpRule({ id: randomUUID(), userId });
      const previousTargets = readTargetSettings(userId);

      const updates = parseUpdateBody(request.body);
      const finalIsEnabled = updates.isEnabled ?? baseRule.isEnabled;

      const hasTargetAmount = hasOwn.call(updates, 'targetAmount');
      const hasFixedAmount = hasOwn.call(updates, 'fixedAmount');

      const nextTargetAmount = hasTargetAmount ? updates.targetAmount ?? null : previousTargets.targetAmount;
      const nextFixedAmount = hasFixedAmount ? updates.fixedAmount ?? null : previousTargets.fixedAmount;

      let resolvedRuleType: RuleType = updates.ruleType
        ?? (nextFixedAmount != null ? 'fixed' : resolveRuleTypeFromState(baseRule));

      if (resolvedRuleType === 'auto' && updates.autoSettings === null) {
        resolvedRuleType = 'target';
      }

      if (hasFixedAmount && updates.fixedAmount === null && !updates.ruleType) {
        resolvedRuleType = nextTargetAmount != null ? 'target' : resolveRuleTypeFromState(baseRule);
      }

      if (finalIsEnabled && resolvedRuleType !== 'auto' && nextTargetAmount == null && nextFixedAmount == null) {
        resolvedRuleType = 'target';
      }

      if (finalIsEnabled) {
        validateRuleConfiguration(resolvedRuleType, nextTargetAmount, nextFixedAmount);
      }

      const incrementType = resolveIncrementType(baseRule, updates, resolvedRuleType);
      const now = clock.now();

      const updatedRule: RoundUpRule = {
        ...baseRule,
        incrementType,
        isEnabled: finalIsEnabled,
        percentageValue: updates.percentageValue !== undefined ? updates.percentageValue : baseRule.percentageValue,
        autoSettings: deriveAutoSettings(baseRule, updates),
        updatedAt: now,
      };

      try {
        validateRoundUpRule(updatedRule);
        const saved = await roundUpRuleRepository.save(updatedRule);

        const allocation = updates.allocation ?? allocationStore.get(userId) ?? { main: 50, savings: 50 };
        if (updates.allocation) {
          allocationStore.set(userId, updates.allocation);
        }

        const finalTargetSettings = normalizeTargetSettings({
          providedTarget: nextTargetAmount,
          providedFixed: nextFixedAmount,
          resolvedRuleType,
          existing: previousTargets,
        });
        targetStore.set(userId, finalTargetSettings);

        logger.info('Round-up rule updated', {
          userId,
          incrementType: saved.incrementType,
          isEnabled: saved.isEnabled,
        });

        const analysisWindowEnd = clock.now();
        const analysisWindowStart = addDays(analysisWindowEnd, -DEFAULT_ANALYSIS_PERIOD);
        const transactions = await transactionRepository.listRecentTransactions(userId, analysisWindowStart);

        let analysis: ReturnType<typeof buildAnalysisPayload> | null = null;
        let recommendations: ReturnType<typeof buildRecommendationsPayload> | null = null;
        let projections: ReturnType<typeof buildProjectionsPayload> | null = null;

        if (transactions.length > 0) {
          analysis = buildAnalysisPayload({
            userId,
            transactions,
            rule: saved,
            since: analysisWindowStart,
            now: analysisWindowEnd,
            includeCategoryBreakdown: true,
          });
          const dataSufficientUpdate = (analysis.data_sufficiency as { sufficient?: boolean })?.sufficient !== false;
          recommendations = buildRecommendationsPayload({ rule: saved, analysis });
          if (dataSufficientUpdate) {
            projections = buildProjectionsPayload({
              analysis,
              periodDays: DEFAULT_ANALYSIS_PERIOD,
              allocationPercentage: allocation.savings,
            });
          }
        }

        const autoAnalysis = buildAutoAnalysisSummary({
          analysis,
          recommendations,
          projections,
          allocation,
          ruleType: finalIsEnabled ? resolvedRuleType : null,
          rule: saved,
        });

        return ok({
          user_id: userId,
          rules: {
            enabled: finalIsEnabled,
            rule_type: finalIsEnabled ? resolvedRuleType : null,
            target_amount: finalIsEnabled && resolvedRuleType === 'target' ? finalTargetSettings.targetAmount : null,
            fixed_amount: finalIsEnabled && resolvedRuleType === 'fixed' ? finalTargetSettings.fixedAmount : null,
            allocation: finalIsEnabled
              ? {
                  main_wallet_percentage: allocation.main,
                  savings_goals_percentage: allocation.savings,
                }
              : null,
          },
          updated_at: analysisWindowEnd.toISOString(),
          auto_analysis: autoAnalysis,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    autoAnalyze: async (
      request: HttpRequest<unknown, Record<string, string>, AutoAnalyzeQuery>,
    ) => {
      ensureAuthenticated(request);

      const analysisPeriodDays = clampInt(
        request.query.analysis_period_days,
        DEFAULT_ANALYSIS_PERIOD,
        MIN_ANALYSIS_PERIOD,
        MAX_ANALYSIS_PERIOD,
      );
      const includeProjections = parseBoolean(request.query.include_projections, true);
      const includeCategoryBreakdown = parseBoolean(request.query.include_category_breakdown, true);

      const analyzedRule = await autoAnalyzeService.analyze(request.userId);
      const now = clock.now();
      const since = new Date(now.getTime() - analysisPeriodDays * 24 * 60 * 60 * 1000);
      const transactions = await transactionRepository.listRecentTransactions(request.userId, since);

      if (transactions.length === 0) {
        throw badRequest('No transaction history available for analysis', 'NO_TRANSACTION_HISTORY', {
          suggestion: 'Make some transactions first, then return for analysis',
        });
      }

      const allocation = allocationStore.get(request.userId) ?? { main: 50, savings: 50 };

      const analysis = buildAnalysisPayload({
        userId: request.userId,
        transactions,
        rule: analyzedRule,
        since,
        now,
        includeCategoryBreakdown,
      });

      const dataSufficient = (analysis.data_sufficiency as { sufficient?: boolean })?.sufficient !== false;
      const recommendations = buildRecommendationsPayload({ rule: analyzedRule, analysis });
      const projections = includeProjections && dataSufficient
        ? buildProjectionsPayload({
            analysis,
            periodDays: analysisPeriodDays,
            allocationPercentage: allocation.savings,
          })
        : null;

      return ok({
        user_id: request.userId,
        analysis,
        recommendations,
        projections,
        generated_at: now.toISOString(),
      });
    },
  };
}

async function buildRuleResponse({
  rule,
  userId,
  includeBreakdown,
  now,
  transactionRepository,
}: {
  rule: RoundUpRule | null;
  userId: string;
  includeBreakdown: boolean;
  now: Date;
  transactionRepository: TransactionRepository;
}) {
  const allocation = allocationStore.get(userId) ?? (rule ? { main: 50, savings: 50 } : { main: 100, savings: 0 });
  const targets = targetStore.get(userId) ?? { targetAmount: DEFAULT_TARGET_AMOUNT, fixedAmount: null };

  const rulePayload = rule
    ? buildConfiguredRule(rule, allocation, targets)
    : buildDefaultRule(allocation, targets);

  const usageStatistics = buildUsageStatistics(rule, now);
  const breakdown = includeBreakdown ? await buildWeeklyBreakdown(userId, transactionRepository, now) : null;

  return {
    rule: rulePayload,
    usage_statistics: usageStatistics,
    weekly_breakdown: breakdown,
    last_updated_at: rule ? rule.updatedAt.toISOString() : null,
    is_default: rule == null,
  };
}

function buildConfiguredRule(
  rule: RoundUpRule,
  allocation: { main: number; savings: number },
  targets: { targetAmount: number | null; fixedAmount: number | null },
) {
  const autoSettings = rule.incrementType === 'auto' ? rule.autoSettings ?? {
    minIncrement: MIN_INCREMENT,
    maxIncrement: MIN_INCREMENT * 5,
    analysisPeriodDays: DEFAULT_ANALYSIS_PERIOD,
    lastAnalysisAt: null,
  } : null;

  const nextAnalysisAt = autoSettings?.lastAnalysisAt
    ? addDays(autoSettings.lastAnalysisAt, autoSettings.analysisPeriodDays).toISOString()
    : null;

  return {
    rule_id: rule.id,
    is_enabled: rule.isEnabled,
    increment_type: rule.incrementType,
    percentage_value: rule.percentageValue ?? null,
    target_amount: targets.targetAmount,
    fixed_amount: targets.fixedAmount,
    auto_settings: autoSettings
      ? {
          min_increment: autoSettings.minIncrement,
          max_increment: autoSettings.maxIncrement,
          analysis_period_days: autoSettings.analysisPeriodDays,
          last_analysis_at: autoSettings.lastAnalysisAt ? autoSettings.lastAnalysisAt.toISOString() : null,
          next_analysis_at: nextAnalysisAt,
        }
      : null,
    allocation: {
      main_wallet_percentage: allocation.main,
      savings_goals_percentage: allocation.savings,
    },
  };
}

function buildDefaultRule(
  allocation: { main: number; savings: number },
  targets: { targetAmount: number | null; fixedAmount: number | null },
) {
  return {
    rule_id: null,
    is_enabled: false,
    increment_type: '10',
    percentage_value: null,
    target_amount: targets.targetAmount ?? 1_000,
    fixed_amount: targets.fixedAmount,
    auto_settings: null,
    allocation: {
      main_wallet_percentage: allocation.main,
      savings_goals_percentage: allocation.savings,
    },
  };
}

function buildUsageStatistics(rule: RoundUpRule | null, now: Date) {
  const totalRoundUps = rule?.totalRoundUpsCount ?? 0;
  const totalSaved = rule?.totalAmountSaved ?? 0;
  const periodEnd = now.toISOString().split('T')[0];
  const periodStartDate = addDays(now, -DEFAULT_ANALYSIS_PERIOD).toISOString().split('T')[0];

  return {
    total_round_ups_count: totalRoundUps,
    total_amount_saved: totalSaved,
    period_start: periodStartDate,
    period_end: periodEnd,
  };
}

async function buildWeeklyBreakdown(
  userId: string,
  transactionRepository: TransactionRepository,
  now: Date,
) {
  const since = addDays(now, -28);
  const transactions = await transactionRepository.listRecentTransactions(userId, since);

  if (transactions.length === 0) {
    return [];
  }

  const bucket = new Map<string, { count: number; saved: number }>();
  for (const transaction of transactions) {
    const weekStart = startOfWeek(transaction.createdAt ?? now);
    const key = weekStart.toISOString().split('T')[0];
    if (!key) {
      continue;
    }
    const current = bucket.get(key) ?? { count: 0, saved: 0 };
    current.count += 1;
    current.saved += Math.round(transaction.amount * 0.02);
    bucket.set(key, current);
  }

  return Array.from(bucket.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, stats]) => ({
      week_start: weekStart,
      round_ups_count: stats.count,
      saved_amount: stats.saved,
    }));
}

function parseUpdateBody(body: UpdateRoundUpRuleBody) {
  if (!body || Object.keys(body).length === 0) {
    throw badRequest('At least one field must be provided to update the round-up rule', 'NO_UPDATE_FIELDS');
  }

  const updates: {
    incrementType?: RoundUpRule['incrementType'];
    isEnabled?: boolean;
    percentageValue?: number | null;
    autoSettings?: { minIncrement: number; maxIncrement: number; analysisPeriodDays: number } | null;
    allocation?: { main: number; savings: number };
    targetAmount?: number | null;
    fixedAmount?: number | null;
    ruleType?: 'auto' | 'target' | 'fixed';
  } = {};

  if (body.increment_type !== undefined) {
    updates.incrementType = parseIncrementType(body.increment_type);
  }

  if (body.percentage_value !== undefined) {
    updates.percentageValue = body.percentage_value === null ? null : parseFloat(String(body.percentage_value));
    if (updates.percentageValue !== null && (updates.percentageValue <= 0 || updates.percentageValue > 100)) {
      throw badRequest('percentage_value must be between 0 and 100', 'INVALID_PERCENTAGE_VALUE');
    }
  }

  if (body.rule_type !== undefined) {
    updates.ruleType = parseRuleType(body.rule_type);
  }

  if (body.is_enabled !== undefined) {
    updates.isEnabled = parseBooleanField(body.is_enabled, 'is_enabled');
  } else if (body.enabled !== undefined) {
    updates.isEnabled = parseBooleanField(body.enabled, 'enabled');
  }

  if (body.auto_settings !== undefined) {
    updates.autoSettings = body.auto_settings ? parseAutoSettings(body.auto_settings) : null;
  }

  if (body.allocation !== undefined) {
    updates.allocation = parseAllocation(body.allocation);
  }

  if (body.target_amount !== undefined) {
    updates.targetAmount = parseOptionalCurrency(body.target_amount, 'target_amount');
    if (updates.targetAmount !== null) {
      updates.ruleType = updates.ruleType ?? 'target';
    }
  }

  if (body.fixed_amount !== undefined) {
    updates.fixedAmount = parseOptionalCurrency(body.fixed_amount, 'fixed_amount');
    if (updates.fixedAmount !== null) {
      updates.ruleType = 'fixed';
    }
  }

  if (updates.ruleType && !updates.incrementType) {
    updates.incrementType = mapRuleTypeToIncrementType(updates.ruleType);
  }

  return updates;
}

function deriveAutoSettings(
  baseRule: RoundUpRule,
  updates: ReturnType<typeof parseUpdateBody>,
): RoundUpRule['autoSettings'] {
  if (updates.incrementType && updates.incrementType !== 'auto') {
    return null;
  }
  if (updates.autoSettings === null) {
    return null;
  }
  if (updates.autoSettings) {
    return {
      ...updates.autoSettings,
      lastAnalysisAt: baseRule.autoSettings?.lastAnalysisAt ?? null,
    };
  }
  return baseRule.autoSettings ?? null;
}

function parseIncrementType(value: string): RoundUpRule['incrementType'] {
  if (!['10', '50', '100', 'auto', 'percentage'].includes(value)) {
    throw badRequest('increment_type must be one of 10, 50, 100, auto, or percentage', 'INVALID_INCREMENT_TYPE');
  }
  return value as RoundUpRule['incrementType'];
}

function parseRuleType(value: string): 'auto' | 'target' | 'fixed' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'auto' || normalized === 'target' || normalized === 'fixed') {
    return normalized;
  }
  throw badRequest('rule_type must be one of target, fixed, or auto', 'INVALID_RULE_TYPE');
}

function mapRuleTypeToIncrementType(ruleType: 'auto' | 'target' | 'fixed'): RoundUpRule['incrementType'] {
  if (ruleType === 'auto') {
    return 'auto';
  }
  return '10';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseBooleanField(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw badRequest(`${field} must be a boolean`, 'INVALID_BOOLEAN');
  }
  return value;
}

function parseAutoSettings(settings: NonNullable<UpdateRoundUpRuleBody['auto_settings']>) {
  const minIncrement = parseCurrency(settings.min_increment, 'auto_settings.min_increment', MIN_INCREMENT);
  const maxIncrement = parseCurrency(settings.max_increment, 'auto_settings.max_increment', minIncrement);
  const analysisPeriodDays = parseInteger(settings.analysis_period_days, 'auto_settings.analysis_period_days', MIN_ANALYSIS_PERIOD, MAX_ANALYSIS_PERIOD);

  return {
    minIncrement,
    maxIncrement,
    analysisPeriodDays,
  };
}

function parseAllocation(allocation: UpdateRoundUpRuleBody['allocation']) {
  if (!allocation) {
    return { main: 50, savings: 50 };
  }
  const main = parseInteger(allocation.main_wallet_percentage ?? 50, 'allocation.main_wallet_percentage', 0, MAX_PERCENTAGE);
  const savings = parseInteger(allocation.savings_goals_percentage ?? (MAX_PERCENTAGE - main), 'allocation.savings_goals_percentage', 0, MAX_PERCENTAGE);

  if (main + savings !== MAX_PERCENTAGE) {
    throw badRequest('Allocation percentages must add up to 100', 'INVALID_ALLOCATION');
  }

  return { main, savings };
}

function parseOptionalCurrency(value: number | null, field: string): number | null {
  if (value === null) {
    return null;
  }
  return parseCurrency(value, field, 0);
}

function parseCurrency(value: unknown, field: string, min: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw badRequest(`${field} must be a numeric value`, 'INVALID_CURRENCY');
  }
  if (!Number.isInteger(value)) {
    throw badRequest(`${field} must be an integer amount in cents`, 'INVALID_CURRENCY_FORMAT');
  }
  if (value < min) {
    throw badRequest(`${field} must be at least ${min}`, 'CURRENCY_TOO_LOW');
  }
  if (value > MAX_INCREMENT * 100) {
    throw badRequest(`${field} is too large`, 'CURRENCY_TOO_HIGH');
  }
  return value;
}

function parseInteger(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest(`${field} must be an integer`, 'INVALID_INTEGER');
  }
  if (value < min || value > max) {
    throw badRequest(`${field} must be between ${min} and ${max}`, 'INTEGER_OUT_OF_RANGE');
  }
  return value;
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildAnalysisPayload({
  userId,
  transactions,
  rule,
  since,
  now,
  includeCategoryBreakdown,
}: {
  userId: string;
  transactions: Transaction[];
  rule: RoundUpRule;
  since: Date;
  now: Date;
  includeCategoryBreakdown: boolean;
}) {
  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const averageTransaction = totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0;
  const sortedAmounts = [...transactions.map((tx) => tx.amount)].sort((a, b) => a - b);
  const medianTransaction = computeMedian(sortedAmounts);
  const days = Math.max(1, Math.round((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyAverageTransactions = Number((totalTransactions / days).toFixed(2));
  const dailyAverageSpending = Math.round(totalAmount / days);
  const dataSufficiency = evaluateDataSufficiency(totalTransactions, totalAmount);

  const categoryBreakdown = includeCategoryBreakdown
    ? buildCategoryBreakdown(transactions, totalAmount)
    : null;
  const merchantPatterns = buildMerchantPatterns(transactions);
  const timingPatterns = buildTimingPatterns(transactions, totalAmount);

  return {
    period: {
      start_date: since.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
      days,
    },
    transaction_summary: {
      total_transactions: totalTransactions,
      total_amount: totalAmount,
      average_transaction: averageTransaction,
      median_transaction: medianTransaction,
      daily_average_transactions: dailyAverageTransactions,
      daily_average_spending: dailyAverageSpending,
    },
    spending_patterns: {
      category_breakdown: categoryBreakdown,
      merchant_patterns: merchantPatterns,
      timing_patterns: timingPatterns,
    },
    roundup_analysis: buildRoundUpInsights(rule, totalAmount, totalTransactions),
    data_sufficiency: dataSufficiency,
  };
}

function buildCategoryBreakdown(
  transactions: Transaction[],
  totalAmount: number,
) {
  const categories = new Map<string, { amount: number; count: number }>();
  transactions.forEach((tx) => {
    const key = tx.category ?? 'other';
    const current = categories.get(key) ?? { amount: 0, count: 0 };
    current.amount += tx.amount;
    current.count += 1;
    categories.set(key, current);
  });

  const breakdown: Record<string, unknown> = {};
  categories.forEach((stats, key) => {
    const averageAmount = stats.count > 0 ? Math.round(stats.amount / stats.count) : 0;
    const percentage = totalAmount > 0 ? Math.round((stats.amount / totalAmount) * 100) : 0;
    breakdown[key] = {
      percentage,
      amount: stats.amount,
      transaction_count: stats.count,
      average_amount: averageAmount,
    };
  });

  return breakdown;
}

function buildMerchantPatterns(
  transactions: Transaction[],
) {
  const counts = new Map<string, number>();
  const spending = new Map<string, number>();
  transactions.forEach((tx) => {
    const name = tx.merchantInfo?.name ?? 'Unknown Merchant';
    counts.set(name, (counts.get(name) ?? 0) + 1);
    spending.set(name, (spending.get(name) ?? 0) + tx.amount);
  });

  const mostFrequent = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const highestSpending = Array.from(spending.entries())
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([name]) => name);

  return {
    most_frequent: mostFrequent,
    highest_spending: highestSpending,
    new_merchants_this_period: counts.size,
  };
}

function buildTimingPatterns(
  transactions: Transaction[],
  totalAmount: number,
) {
  if (transactions.length === 0) {
    return {
      peak_spending_days: [],
      peak_spending_hours: [],
      weekend_vs_weekday_ratio: 1,
    };
  }

  const daySpend = new Map<number, number>();
  const hourSpend = new Map<number, number>();
  let weekendAmount = 0;
  let weekendCount = 0;
  let weekdayAmount = 0;
  let weekdayCount = 0;

  transactions.forEach((tx) => {
    const day = tx.createdAt.getDay();
    const hour = tx.createdAt.getHours();
    daySpend.set(day, (daySpend.get(day) ?? 0) + tx.amount);
    hourSpend.set(hour, (hourSpend.get(hour) ?? 0) + tx.amount);

    if (day === 0 || day === 6) {
      weekendAmount += tx.amount;
      weekendCount += 1;
    } else {
      weekdayAmount += tx.amount;
      weekdayCount += 1;
    }
  });

  const peakSpendingDays = Array.from(daySpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => dayName(day));

  const peakSpendingHours = Array.from(hourSpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([hour]) => `${hour.toString().padStart(2, '0')}:00-${(hour + 1).toString().padStart(2, '0')}:00`);

  const weekendAverage = weekendCount > 0 ? weekendAmount / weekendCount : totalAmount;
  const weekdayAverage = weekdayCount > 0 ? weekdayAmount / weekdayCount : totalAmount;
  const ratio = weekdayAverage === 0 ? 1 : Number((weekendAverage / weekdayAverage).toFixed(2));

  return {
    peak_spending_days: peakSpendingDays,
    peak_spending_hours: peakSpendingHours,
    weekend_vs_weekday_ratio: ratio,
  };
}

function buildAutoAnalysisSummary({
  analysis,
  recommendations,
  projections,
  allocation,
  ruleType,
  rule,
}: {
  analysis: ReturnType<typeof buildAnalysisPayload> | null;
  recommendations: ReturnType<typeof buildRecommendationsPayload> | null;
  projections: ReturnType<typeof buildProjectionsPayload> | null;
  allocation: { main: number; savings: number };
  ruleType: RuleType | null;
  rule: RoundUpRule;
}) {
  if (!analysis) {
    return {
      recommendation_generated: false,
      historical_impact: {
        total_rounded_up: rule.totalAmountSaved,
        transactions_affected: rule.totalRoundUpsCount,
        average_roundup_per_transaction: rule.totalRoundUpsCount > 0
          ? Math.round(rule.totalAmountSaved / rule.totalRoundUpsCount)
          : 0,
        period: 'Insufficient data',
      },
    };
  }

  const summary = analysis.transaction_summary;
  const merchantPatterns = analysis.spending_patterns.merchant_patterns;
  const spendingFrequency = determineTransactionFrequency(summary.daily_average_transactions);
  const targets = readTargetSettings(rule.userId);

  const primary = recommendations?.primary_recommendation as
    | (ReturnType<typeof buildRecommendationsPayload>['primary_recommendation'] & Record<string, unknown>)
    | undefined;

  const spendingPattern = {
    average_transaction_amount: summary.average_transaction,
    most_common_merchants: merchantPatterns.most_frequent,
    transaction_frequency: spendingFrequency,
    recommended_rule: primary
      ? {
          type: primary.rule_type,
          target_amount: primary.target_amount ?? null,
          fixed_amount: primary.fixed_amount ?? null,
          reason: primary.reason,
        }
      : {
          type: ruleType ?? resolveRuleTypeFromState(rule),
          target_amount: ruleType === 'target' ? targets.targetAmount : null,
          fixed_amount: ruleType === 'fixed' ? targets.fixedAmount : null,
          reason: 'Continuing with current configuration until more data is collected.',
        },
  };

  const historical = analysis.roundup_analysis.historical_roundup;
  const autoAnalysis: Record<string, unknown> = {
    recommendation_generated: Boolean(primary),
    spending_pattern: spendingPattern,
    historical_impact: {
      total_rounded_up: historical.total_rounded_up,
      transactions_affected: historical.transactions_affected,
      average_roundup_per_transaction: historical.average_roundup_per_transaction,
      period: `${analysis.period.start_date} to ${analysis.period.end_date}`,
    },
  };

  if (projections) {
    autoAnalysis.impact_projection = {
      monthly_roundup_estimate: projections.next_30_days.estimated_roundup,
      annual_savings_projection: projections.annual_projection.estimated_roundup,
      goal_contribution_percentage: allocation.savings,
    };
  }

  if (recommendations && 'data_gathering_suggestions' in recommendations) {
    autoAnalysis.data_gathering_suggestions = (recommendations as Record<string, unknown>).data_gathering_suggestions;
  }

  return autoAnalysis;
}

function buildRoundUpInsights(rule: RoundUpRule, totalAmount: number, totalTransactions: number) {
  const ruleType = resolveRuleTypeFromState(rule);
  const targets = readTargetSettings(rule.userId);
  const averageRoundUp = rule.totalRoundUpsCount > 0
    ? Math.round(rule.totalAmountSaved / rule.totalRoundUpsCount)
    : 0;
  const potentialAdditional = Math.max(0, Math.round(totalAmount * 0.02) - rule.totalAmountSaved);

  return {
    current_rules: {
      enabled: rule.isEnabled,
      rule_type: ruleType,
      target_amount: ruleType === 'target' ? targets.targetAmount : null,
      fixed_amount: ruleType === 'fixed' ? targets.fixedAmount : null,
    },
    historical_roundup: {
      total_rounded_up: rule.totalAmountSaved,
      transactions_affected: rule.totalRoundUpsCount,
      average_roundup_per_transaction: averageRoundUp,
    },
    optimization_opportunities: {
      potential_additional_roundup: potentialAdditional,
      underutilized_categories: ['utilities', 'shopping'],
      high_frequency_low_roundup: totalTransactions > 0 ? ['transportation'] : [],
    },
  };
}

function buildRecommendationsPayload({
  rule,
  analysis,
}: {
  rule: RoundUpRule;
  analysis: ReturnType<typeof buildAnalysisPayload>;
}) {
  const targets = readTargetSettings(rule.userId);
  const allocation = allocationStore.get(rule.userId) ?? { main: 50, savings: 50 };
  const dataSufficiency = (analysis.data_sufficiency as { sufficient?: boolean }) ?? { sufficient: true };
  const sufficient = dataSufficiency.sufficient !== false;
  const ruleType = resolveRuleTypeFromState(rule);
  const primaryConfidence = Number((sufficient ? 0.85 : 0.45).toFixed(2));

  const primaryRecommendation: Record<string, unknown> = {
    rule_type: ruleType,
    target_amount: ruleType === 'target' ? targets.targetAmount : null,
    fixed_amount: ruleType === 'fixed' ? targets.fixedAmount : null,
    confidence_score: primaryConfidence,
    reason: sufficient
      ? ruleType === 'auto'
        ? 'Auto-analysis indicates current settings are optimal.'
        : 'Current rule aligns with spending pattern analysis.'
      : 'Default recommendation due to insufficient transaction history',
  };

  if (!sufficient) {
    primaryRecommendation.is_default = true;
  }

  const alternativeRecommendations = [
    {
      rule_type: 'fixed' as const,
      fixed_amount: 500,
      confidence_score: sufficient ? 0.68 : 0.52,
      reason: 'A fixed increment could increase consistency on low-spend days.',
      impact: {
        monthly_difference: 3_500,
        annual_projection: 42_000,
      },
    },
    {
      rule_type: 'target' as const,
      target_amount: Math.min(10_000, (targets.targetAmount ?? DEFAULT_TARGET_AMOUNT) + 2_000),
      confidence_score: sufficient ? 0.62 : 0.5,
      reason: 'Higher target may accelerate savings progress.',
      impact: {
        monthly_difference: 18_000,
        annual_projection: 216_000,
      },
    },
  ].filter((alt) => {
    if (alt.rule_type !== primaryRecommendation.rule_type) {
      return true;
    }
    if (alt.rule_type === 'fixed') {
      return (primaryRecommendation.fixed_amount ?? null) !== alt.fixed_amount;
    }
    return (primaryRecommendation.target_amount ?? null) !== alt.target_amount;
  });

  const recommendedSavings = Math.min(80, allocation.savings + 20);
  const recommendedAllocation = {
    main_wallet_percentage: 100 - recommendedSavings,
    savings_goals_percentage: recommendedSavings,
    reason: sufficient
      ? 'Increase savings allocation based on consistent round-up history.'
      : 'Consider building more history before adjusting allocations significantly.',
  };

  const recommendations: Record<string, unknown> = {
    primary_recommendation: primaryRecommendation,
    alternative_recommendations: alternativeRecommendations,
    allocation_recommendations: {
      current_allocation: {
        main_wallet_percentage: allocation.main,
        savings_goals_percentage: allocation.savings,
      },
      recommended_allocation: recommendedAllocation,
    },
  };

  if (!sufficient) {
    recommendations.data_gathering_suggestions = DATA_GATHERING_SUGGESTIONS;
  }

  return recommendations;
}

function buildProjectionsPayload({
  analysis,
  periodDays,
  allocationPercentage,
}: {
  analysis: ReturnType<typeof buildAnalysisPayload>;
  periodDays: number;
  allocationPercentage: number;
}) {
  const summary = analysis.transaction_summary;
  const roundup = analysis.roundup_analysis.historical_roundup;
  const multiplier30 = 30 / Math.max(1, periodDays);
  const multiplier90 = 90 / Math.max(1, periodDays);
  const multiplier365 = 365 / Math.max(1, periodDays);
  const allocationRatio = Math.min(Math.max(allocationPercentage / 100, 0), 1);

  return {
    next_30_days: {
      estimated_transactions: Math.round(summary.total_transactions * multiplier30),
      estimated_spending: Math.round(summary.total_amount * multiplier30),
      estimated_roundup: Math.round(roundup.total_rounded_up * multiplier30),
    },
    next_90_days: {
      estimated_transactions: Math.round(summary.total_transactions * multiplier90),
      estimated_spending: Math.round(summary.total_amount * multiplier90),
      estimated_roundup: Math.round(roundup.total_rounded_up * multiplier90),
    },
    annual_projection: {
      estimated_transactions: Math.round(summary.total_transactions * multiplier365),
      estimated_spending: Math.round(summary.total_amount * multiplier365),
      estimated_roundup: Math.round(roundup.total_rounded_up * multiplier365),
      goal_contributions: Math.round(Math.round(roundup.total_rounded_up * multiplier365) * allocationRatio),
    },
  };
}

function dayName(dayIndex: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex] ?? 'Unknown';
}

function computeMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    const lower = values[mid - 1];
    const upper = values[mid];
    if (lower === undefined && upper === undefined) {
      return 0;
    }
    if (lower === undefined || upper === undefined) {
      return Math.round((lower ?? upper ?? 0));
    }
    return Math.round((lower + upper) / 2);
  }
  return values[mid] ?? 0;
}

function determineTransactionFrequency(dailyAverage: number) {
  if (dailyAverage >= DAILY_ACTIVITY_THRESHOLD) {
    return 'daily';
  }
  if (dailyAverage >= 0.5) {
    return 'weekly';
  }
  return 'occasional';
}
