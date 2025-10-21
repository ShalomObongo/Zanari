/**
 * Contract tests for DELETE /savings/goals/:goalId using integration handlers.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface GoalResponse {
  goal_id: string;
  name: string;
  status: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  final_progress: null | {
    saved_amount: number;
    target_amount: number;
    progress_percentage: number;
  };
  created_at: string;
  updated_at: string;
  cancelled_at?: string | null;
}

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

type CreateGoalOverrides = {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
};

const uniqueSuffix = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return counter;
  };
})();

const dateFromToday = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  const [day] = date.toISOString().split('T');
  return day ?? date.toISOString();
};

describe('DELETE /savings/goals/:goalId', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const createGoal = async (
    overrides: CreateGoalOverrides = {},
    options: { contributions?: number[] } = {},
  ): Promise<GoalResponse> => {
    const payload = {
      name: `Goal ${uniqueSuffix()}`,
      description: 'Goal created for cancellation tests',
      target_amount: 400_000,
      target_date: dateFromToday(120),
      category: 'general',
      lock_in_enabled: false,
      ...overrides,
    };

    const response = await ctx.executeAsUser(ctx.routes.savings.createGoal, {
      body: payload,
    });

    expect(response.status).toBe(201);
    const body = response.body as GoalResponse;

    for (const amount of options.contributions ?? []) {
      await ctx.integration.services.savingsGoalService.recordContribution(body.goal_id, amount);
    }

    return body;
  };

  const cancelGoal = (goalId: string, overrides: { userId?: string } = {}) =>
    ctx.executeAsUser(ctx.routes.savings.cancelGoal, {
      params: { goalId },
      ...(overrides.userId ? { userId: overrides.userId } : {}),
    });

  const fetchGoal = (goalId: string) => ctx.integration.repositories.savingsGoalRepository.findById(goalId);

  describe('successful cancellations', () => {
    it('cancels an active goal and returns final progress snapshot', async () => {
      const created = await createGoal({ name: 'Travel Fund', target_amount: 800_000 }, { contributions: [275_000] });

      const response = await cancelGoal(created.goal_id);
      expect(response.status).toBe(200);

      const body = response.body as GoalResponse;
      expect(body.status).toBe('cancelled');
      expect(body.final_progress).not.toBeNull();
      expect(body.final_progress?.saved_amount).toBe(275_000);
      expect(body.final_progress?.target_amount).toBe(800_000);
  expect(body.final_progress?.progress_percentage).toBeCloseTo((275_000 / 800_000) * 100, 1);
  expect(body.progress_percentage).toBeCloseTo(body.final_progress?.progress_percentage ?? 0, 5);
  expect(new Date(body.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(created.updated_at).getTime());

      const stored = await fetchGoal(created.goal_id);
      expect(stored?.status).toBe('cancelled');
      expect(stored?.currentAmount).toBe(275_000);
  expect(stored?.updatedAt.toISOString()).toBe(body.updated_at);
    });

    it('cancels a goal with zero balance', async () => {
      const created = await createGoal({ name: 'Empty Goal', target_amount: 100_000 });

      const response = await cancelGoal(created.goal_id);
      expect(response.status).toBe(200);

      const body = response.body as GoalResponse;
      expect(body.final_progress?.saved_amount).toBe(0);
      expect(body.final_progress?.progress_percentage).toBe(0);
    });
  });

  describe('validation and error handling', () => {
    it('rejects cancellation for completed goals', async () => {
      const created = await createGoal({ target_amount: 300_000 }, { contributions: [150_000, 150_000] });

      const response = await cancelGoal(created.goal_id);
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('GOAL_ALREADY_COMPLETED');
    });

    it('rejects cancellation when the goal is already cancelled', async () => {
      const created = await createGoal({ target_amount: 250_000 }, { contributions: [50_000] });

      const firstAttempt = await cancelGoal(created.goal_id);
      expect(firstAttempt.status).toBe(200);

      const secondAttempt = await cancelGoal(created.goal_id);
      expect(secondAttempt.status).toBe(400);
      const body = secondAttempt.body as ErrorResponse;
      expect(body.code).toBe('GOAL_ALREADY_CANCELLED');
    });

    it('returns 404 for non-existent goals', async () => {
      const response = await cancelGoal('non-existent-goal');
      expect(response.status).toBe(404);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('GOAL_NOT_FOUND');
    });

    it('enforces ownership before cancelling', async () => {
      const created = await createGoal();
      const response = await cancelGoal(created.goal_id, { userId: 'someone-else' });
      expect(response.status).toBe(403);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('UNAUTHORIZED_GOAL_ACCESS');
    });
  });
});