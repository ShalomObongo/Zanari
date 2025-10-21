import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createTransaction } from '../../../api/src/models/Transaction';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

type AutoAnalyzeSuccessResponse = {
  user_id: string;
  analysis: {
    period: {
      start_date: string;
      end_date: string;
      days: number;
    };
    transaction_summary: {
      total_transactions: number;
      total_amount: number;
      daily_average_transactions: number;
      [key: string]: unknown;
    };
    spending_patterns: Record<string, unknown>;
    roundup_analysis: Record<string, unknown>;
    data_sufficiency?: Record<string, unknown>;
  };
  recommendations: {
    primary_recommendation: {
      rule_type: string;
      confidence_score: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  projections: null | Record<string, unknown>;
  generated_at: string;
};

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

describe('GET /roundup/auto-analyze Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const requestAutoAnalyze = (
    query: Record<string, string | undefined> = {},
    options: { userId?: string } = {},
  ) => ctx.executeAsUser(ctx.routes.roundUp.autoAnalyze, {
    query,
    ...(options.userId ? { userId: options.userId } : {}),
  });

  const seedTransactions = async (
    entries: Array<{
      amount: number;
      daysAgo: number;
      merchant?: string;
      category?: string;
    }>,
    userId: string = ctx.userId,
  ) => {
    const repo = ctx.integration.repositories.transactionRepository;
    const now = new Date();
    for (const entry of entries) {
      const createdAt = new Date(now.getTime() - entry.daysAgo * 24 * 60 * 60 * 1000);
      const tx = createTransaction({
        id: randomUUID(),
        userId,
        type: 'payment',
        status: 'completed',
        amount: entry.amount,
        category: (entry.category ?? 'groceries') as any,
        autoCategorized: true,
        merchantInfo: entry.merchant ? { name: entry.merchant } : null,
      });
      tx.createdAt = createdAt;
      tx.updatedAt = createdAt;
      tx.completedAt = createdAt;
      await repo.create(tx);
    }
  };

  describe('Successful analysis generation', () => {
    it('returns full analysis with projections when sufficient history exists', async () => {
      await seedTransactions(
        Array.from({ length: 40 }).map((_, index) => ({
          amount: 250_000,
          daysAgo: index % 20,
          merchant: index % 2 === 0 ? 'Java House' : 'Safaricom',
          category: index % 3 === 0 ? 'food_dining' : 'transport',
        })),
      );

      const response = await requestAutoAnalyze({
        analysis_period_days: '60',
        include_projections: 'true',
        include_category_breakdown: 'true',
      });

      expect(response.status).toBe(200);
      const body = response.body as AutoAnalyzeSuccessResponse;
      expect(body.user_id).toBe(ctx.userId);
      expect(body.analysis.transaction_summary.total_transactions).toBeGreaterThanOrEqual(40);
      expect(body.projections).not.toBeNull();
      expect(body.recommendations.primary_recommendation.confidence_score).toBeGreaterThan(0);
      expect(body.recommendations.primary_recommendation.confidence_score).toBeLessThanOrEqual(1);
      expect(new Date(body.generated_at).toString()).not.toBe('Invalid Date');
    });

    it('omits projections and category breakdown when disabled via query params', async () => {
      await seedTransactions(
        Array.from({ length: 35 }).map((_, index) => ({ amount: 220_000, daysAgo: index % 10 })),
      );

      const response = await requestAutoAnalyze({
        include_projections: 'false',
        include_category_breakdown: 'false',
      });

      expect(response.status).toBe(200);
      const body = response.body as AutoAnalyzeSuccessResponse;
      expect(body.projections).toBeNull();
      expect(body.analysis.spending_patterns).toHaveProperty('category_breakdown', null);
    });

    it('clamps short analysis periods to minimum supported window', async () => {
      await seedTransactions(
        Array.from({ length: 20 }).map((_, index) => ({ amount: 200_000, daysAgo: index % 5 })),
      );

      const response = await requestAutoAnalyze({ analysis_period_days: '3' });

      expect(response.status).toBe(200);
      const body = response.body as AutoAnalyzeSuccessResponse;
      expect(body.analysis.period.days).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Data sufficiency handling', () => {
    it('returns low-confidence recommendations when history is scarce', async () => {
      await seedTransactions(
        Array.from({ length: 5 }).map((_, index) => ({ amount: 80_000, daysAgo: index })),
      );

      const response = await requestAutoAnalyze();

      expect(response.status).toBe(200);
      const body = response.body as AutoAnalyzeSuccessResponse;
      expect(body.analysis).toHaveProperty('data_sufficiency');
      const dataSufficiency = body.analysis.data_sufficiency as { sufficient?: boolean } | undefined;
      expect(dataSufficiency?.sufficient).toBe(false);
      expect(body.projections).toBeNull();
      expect(body.recommendations).toHaveProperty('data_gathering_suggestions');
      expect(body.recommendations.primary_recommendation.confidence_score).toBeLessThan(0.6);
    });

    it('returns 400 when no transactions are available for analysis', async () => {
      const newUserId = randomUUID();
      const response = await requestAutoAnalyze({ analysis_period_days: '90' }, { userId: newUserId });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('NO_TRANSACTION_HISTORY');
      expect(body).toHaveProperty('suggestion');
    });
  });

  describe('Authentication', () => {
    it('rejects unauthenticated auto-analyze requests', async () => {
      const response = await ctx.execute(ctx.routes.roundUp.autoAnalyze, { query: {} });
      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});