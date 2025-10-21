import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createTransaction } from '../../../api/src/models/Transaction';
import { RoundUpRule } from '../../../api/src/models/RoundUpRule';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface RuleResponse {
  rule: {
    rule_id: string | null;
    is_enabled: boolean;
    increment_type: string;
    target_amount: number | null;
    fixed_amount: number | null;
    auto_settings: null | {
      min_increment: number;
      max_increment: number;
      analysis_period_days: number;
      last_analysis_at: string | null;
      next_analysis_at: string | null;
    };
    allocation: {
      main_wallet_percentage: number;
      savings_goals_percentage: number;
    };
  };
  usage_statistics: {
    total_round_ups_count: number;
    total_amount_saved: number;
    period_start: string;
    period_end: string;
  };
  weekly_breakdown: null | Array<{
    week_start: string;
    round_ups_count: number;
    saved_amount: number;
  }>;
  last_updated_at: string | null;
  is_default: boolean;
}

interface ErrorResponse {
  error: string;
  code: string;
  [key: string]: unknown;
}

describe('GET /roundup/rules Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const getRules = (query: Record<string, string | undefined> = {}, options: { userId?: string } = {}) =>
    ctx.executeAsUser(ctx.routes.roundUp.getRule, {
      query,
      ...(options.userId ? { userId: options.userId } : {}),
    });

  const updateRule = async (mutator: (rule: RoundUpRule) => RoundUpRule) => {
    const repo = ctx.integration.repositories.roundUpRuleRepository;
    const existing = await repo.findByUserId(ctx.userId);
    if (!existing) throw new Error('Expected seeded round-up rule');
    const baseRule: RoundUpRule = {
      ...existing,
      autoSettings: existing.autoSettings ? { ...existing.autoSettings } : null,
    };
    const updated = mutator(baseRule);
    updated.updatedAt = new Date('2025-01-15T10:30:00Z');
    await repo.save(updated);
    return updated;
  };

  const seedTransactions = async (entries: Array<{ amount: number; daysAgo: number; category?: string; merchant?: string }>) => {
    const repo = ctx.integration.repositories.transactionRepository;
    const now = new Date();
    for (const entry of entries) {
      const tx = createTransaction({
        id: randomUUID(),
        userId: ctx.userId,
        type: 'payment',
        status: 'completed',
        amount: entry.amount,
        category: (entry.category ?? 'groceries') as any,
        autoCategorized: true,
        merchantInfo: entry.merchant ? { name: entry.merchant } : null,
      });
      const createdAt = new Date(now.getTime() - entry.daysAgo * 24 * 60 * 60 * 1000);
      tx.createdAt = createdAt;
      tx.updatedAt = createdAt;
      tx.completedAt = createdAt;
      await repo.create(tx);
    }
  };

  describe('Successful retrieval', () => {
    it('returns configured rule details with auto settings and usage stats', async () => {
      const updatedRule = await updateRule((rule) => ({
        ...rule,
        incrementType: 'auto',
        autoSettings: {
          minIncrement: 250,
          maxIncrement: 2_000,
          analysisPeriodDays: 45,
          lastAnalysisAt: new Date('2024-12-20T08:00:00Z'),
        },
        totalRoundUpsCount: 42,
        totalAmountSaved: 18_500,
      }));

      const response = await getRules();

      expect(response.status).toBe(200);
      const body = response.body as RuleResponse;
      expect(body.is_default).toBe(false);
      expect(body.rule.rule_id).toBe(updatedRule.id);
      expect(body.rule.increment_type).toBe('auto');
      expect(body.rule.auto_settings).toMatchObject({
        min_increment: 250,
        max_increment: 2_000,
        analysis_period_days: 45,
        last_analysis_at: '2024-12-20T08:00:00.000Z',
      });
      expect(body.rule.auto_settings?.next_analysis_at).toBe('2025-02-03T08:00:00.000Z');
      expect(body.rule.allocation).toEqual({
        main_wallet_percentage: 50,
        savings_goals_percentage: 50,
      });
      expect(body.usage_statistics).toMatchObject({
        total_round_ups_count: 42,
        total_amount_saved: 18_500,
      });
      expect(body.last_updated_at).toBe(updatedRule.updatedAt.toISOString());
      expect(body.weekly_breakdown).toBeNull();
    });

    it('returns default rule metadata for users without saved configuration', async () => {
      const anotherUserId = randomUUID();

      const response = await getRules({}, { userId: anotherUserId });

      expect(response.status).toBe(200);
      const body = response.body as RuleResponse;
      expect(body.is_default).toBe(true);
      expect(body.rule.rule_id).toBeNull();
      expect(body.rule.is_enabled).toBe(false);
      expect(body.rule.increment_type).toBe('10');
      expect(body.rule.allocation).toEqual({ main_wallet_percentage: 100, savings_goals_percentage: 0 });
      expect(body.usage_statistics).toMatchObject({ total_round_ups_count: 0, total_amount_saved: 0 });
    });
  });

  describe('Historical insights', () => {
    it('includes weekly breakdown when requested', async () => {
      await seedTransactions([
        { amount: 12_500, daysAgo: 3, category: 'groceries', merchant: 'Java House' },
        { amount: 18_000, daysAgo: 8, category: 'transport', merchant: 'Taxi 24' },
        { amount: 9_000, daysAgo: 15, category: 'utilities', merchant: 'Power Co' },
      ]);

      const response = await getRules({ include_breakdown: 'true' });

      expect(response.status).toBe(200);
      const body = response.body as RuleResponse;
      expect(Array.isArray(body.weekly_breakdown)).toBe(true);
      expect(body.weekly_breakdown).not.toBeNull();
      expect(body.weekly_breakdown?.length).toBeGreaterThanOrEqual(1);
      const first = body.weekly_breakdown?.[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first).toHaveProperty('week_start');
        expect(first).toHaveProperty('round_ups_count');
        expect(first).toHaveProperty('saved_amount');
      }
    });
  });

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await ctx.execute(ctx.routes.roundUp.getRule);

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});
