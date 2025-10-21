import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';
import { SavingsGoal } from '../../../api/src/models/SavingsGoal';

interface GoalResponse {
  goal_id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  target_date: string | null;
  lock_in_enabled: boolean;
  milestones: Array<{
    milestone_id: string;
    percentage: number;
    target_amount: number;
    current_amount: number;
    progress_percentage: number;
    achieved: boolean;
    achieved_at: string | null;
    celebrated: boolean;
  }>;
  next_milestone: {
    milestone_id: string;
    amount_remaining: number;
    target_amount: number;
    percentage: number;
    estimated_completion_days: number | null;
  } | null;
  final_progress: null | {
    saved_amount: number;
    target_amount: number;
    progress_percentage: number;
  };
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  days_until_target: number | null;
  target_date_warning: boolean;
}

type UpdateGoalPayload = {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
};

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
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

describe('PUT /savings/goals/:goalId', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const createGoal = async (overrides: Partial<UpdateGoalPayload> = {}, options: { contributions?: number[] } = {}) => {
    const payload = {
      name: `Goal ${uniqueSuffix()}`,
      description: 'Initial goal description',
      target_amount: 500_000,
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

  const updateGoal = (goalId: string, payload: UpdateGoalPayload, overrides: { userId?: string } = {}) =>
    ctx.executeAsUser(ctx.routes.savings.updateGoal, {
      params: { goalId },
      body: payload,
      ...(overrides.userId ? { userId: overrides.userId } : {}),
    });

  const fetchGoal = (goalId: string) => ctx.integration.repositories.savingsGoalRepository.findById(goalId);

  describe('successful updates', () => {
    it('updates goal name and description while preserving progress', async () => {
      const created = await createGoal({ name: 'University Fund', category: 'education' }, { contributions: [125_000] });

      const response = await updateGoal(created.goal_id, {
        name: 'Computer Science Fund',
        description: 'Saving for CS degree and laptop',
      });

      expect(response.status).toBe(200);
      const body = response.body as GoalResponse;
      expect(body.name).toBe('Computer Science Fund');
      expect(body.description).toBe('Saving for CS degree and laptop');
      expect(body.current_amount).toBe(125_000);
      expect(body.progress_percentage).toBeCloseTo(25, 2);
      const milestone25 = body.milestones.find((milestone) => milestone.percentage === 25);
      expect(milestone25?.achieved).toBe(true);
      expect(milestone25?.achieved_at).not.toBeNull();
  expect(new Date(body.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(body.created_at).getTime());
    });

    it('recalculates milestones when the target amount increases', async () => {
      const created = await createGoal({ name: 'Emergency Fund', target_amount: 1_000_000 }, { contributions: [400_000] });

      const response = await updateGoal(created.goal_id, { target_amount: 1_500_000 });
      expect(response.status).toBe(200);

      const body = response.body as GoalResponse;
      expect(body.target_amount).toBe(1_500_000);
      expect(body.progress_percentage).toBeCloseTo((400_000 / 1_500_000) * 100, 2);
      const milestoneTargets = body.milestones.map((milestone) => milestone.target_amount);
      expect(milestoneTargets).toEqual([375_000, 750_000, 1_125_000, 1_500_000]);
      const milestone25 = body.milestones.find((milestone) => milestone.percentage === 25)!;
      expect(milestone25.achieved).toBe(true);
    });

    it('extends the target date with validation', async () => {
      const created = await createGoal({ target_date: dateFromToday(60) });
      const newDate = dateFromToday(240);

      const response = await updateGoal(created.goal_id, { target_date: newDate });
      expect(response.status).toBe(200);

      const body = response.body as GoalResponse;
      expect(body.target_date).toBe(newDate);
      expect(body.target_date_warning).toBe(false);
    });

    it('updates multiple fields, including category and lock in flag', async () => {
      const created = await createGoal({ name: 'Gadget Fund', category: 'general', lock_in_enabled: false });
      const updatedTargetDate = dateFromToday(180);

      const response = await updateGoal(created.goal_id, {
        name: 'MacBook Pro Fund',
        description: 'M3 MacBook Pro for development',
        target_amount: 800_000,
        target_date: updatedTargetDate,
        category: 'electronics',
        lock_in_enabled: true,
      });

      expect(response.status).toBe(200);
      const body = response.body as GoalResponse;
      expect(body.name).toBe('MacBook Pro Fund');
      expect(body.description).toBe('M3 MacBook Pro for development');
      expect(body.target_amount).toBe(800_000);
      expect(body.target_date).toBe(updatedTargetDate);
      expect(body.category).toBe('electronics');
      expect(body.lock_in_enabled).toBe(true);
    });

    it('handles target reduction while maintaining achieved milestones', async () => {
      const created = await createGoal({ name: 'House Deposit', target_amount: 500_000 }, { contributions: [300_000] });

      const response = await updateGoal(created.goal_id, { target_amount: 400_000 });
      expect(response.status).toBe(200);

      const body = response.body as GoalResponse;
      expect(body.target_amount).toBe(400_000);
      const milestone75 = body.milestones.find((milestone) => milestone.percentage === 75)!;
      expect(milestone75.target_amount).toBe(300_000);
      expect(milestone75.achieved).toBe(true);
    });
  });

  describe('validation and business rules', () => {
    it('rejects empty update payloads', async () => {
      const created = await createGoal();
      const response = await updateGoal(created.goal_id, {});
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('NO_UPDATE_FIELDS');
    });

    it('validates goal name input', async () => {
      const created = await createGoal();
      const response = await updateGoal(created.goal_id, { name: '   ' });
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('EMPTY_GOAL_NAME');
    });

    it('ensures target amount cannot dip below current savings', async () => {
      const created = await createGoal({ target_amount: 500_000 }, { contributions: [300_000] });
      const response = await updateGoal(created.goal_id, { target_amount: 200_000 });
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('TARGET_BELOW_CURRENT');
      expect(body.current_amount).toBe(300_000);
      expect(body.requested_target).toBe(200_000);
    });

    it('rejects past target dates', async () => {
      const created = await createGoal();
      const response = await updateGoal(created.goal_id, { target_date: '2023-01-01' });
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_TARGET_DATE');
    });

    it('prevents duplicate goal names for the same user', async () => {
      const first = await createGoal({ name: 'Emergency Buffer' });
      const second = await createGoal({ name: 'Travel Fund' });

      const response = await updateGoal(second.goal_id, { name: first.name });
      expect(response.status).toBe(409);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('DUPLICATE_GOAL_NAME');
    });
  });

  describe('status restrictions', () => {
    it('blocks updates to completed goals', async () => {
      const created = await createGoal({ target_amount: 100_000 }, { contributions: [100_000] });

      const response = await updateGoal(created.goal_id, { name: 'Completed Goal Update Attempt' });
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('GOAL_ALREADY_COMPLETED');
    });

    it('blocks updates to cancelled goals', async () => {
      const created = await createGoal({ target_amount: 200_000 }, { contributions: [50_000] });
      const stored = await fetchGoal(created.goal_id);
      if (!stored) {
        throw new Error('Goal not found in repository');
      }

      const cancelledGoal: SavingsGoal = {
        ...stored,
        status: 'cancelled',
        updatedAt: new Date(),
      };
      await ctx.integration.repositories.savingsGoalRepository.save(cancelledGoal);

      const response = await updateGoal(created.goal_id, { description: 'Attempting to update cancelled goal' });
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('GOAL_CANCELLED');
    });
  });

  describe('error handling', () => {
    it('returns 404 when goal cannot be found', async () => {
      const response = await updateGoal('non-existent-goal-id', { name: 'Missing Goal' });
      expect(response.status).toBe(404);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('GOAL_NOT_FOUND');
    });

    it('enforces ownership before allowing updates', async () => {
      const created = await createGoal();
      const response = await updateGoal(created.goal_id, { name: 'Unauthorized Update' }, { userId: 'someone-else' });
      expect(response.status).toBe(403);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('UNAUTHORIZED_GOAL_ACCESS');
    });
  });
});