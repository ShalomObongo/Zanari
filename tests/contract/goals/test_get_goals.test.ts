import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface CreateGoalPayload {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface GoalSummary {
  goal_id: string;
  name: string;
  description: string | null;
  status: string;
  category: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  target_date: string | null;
  days_until_target: number | null;
  target_date_warning: boolean;
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
}

interface ListGoalsResponse {
  goals: GoalSummary[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

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

describe('GET /savings/goals', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const createGoal = async (overrides: Partial<CreateGoalPayload> = {}) => {
    const payload: CreateGoalPayload = {
      name: `Goal ${uniqueSuffix()}`,
      description: 'Automated contract test goal',
      target_amount: 500_000,
      target_date: dateFromToday(90),
      category: 'general',
      lock_in_enabled: false,
      ...overrides,
    };

    const response = await ctx.executeAsUser(ctx.routes.savings.createGoal, {
      body: payload,
    });

    expect(response.status).toBe(201);
    return response.body as { goal_id: string };
  };

  const listGoals = (query: Record<string, string> = {}) =>
    ctx.executeAsUser(ctx.routes.savings.listGoals, {
      query,
    });

  const expectPagination = (pagination: ListGoalsResponse['pagination'], expected: Partial<ListGoalsResponse['pagination']>) => {
    expect(pagination.page).toBe(expected.page ?? pagination.page);
    expect(pagination.per_page).toBe(expected.per_page ?? pagination.per_page);
    expect(pagination.total_items).toBe(expected.total_items ?? pagination.total_items);
    expect(pagination.total_pages).toBe(expected.total_pages ?? pagination.total_pages);
  };

  describe('successful retrieval', () => {
    it('returns paginated goals with progress and milestone metadata', async () => {
      const targetDate = dateFromToday(180);
      const { goal_id } = await createGoal({ name: 'University Fund', target_amount: 500_000, target_date: targetDate, category: 'education' });

      await ctx.integration.services.savingsGoalService.recordContribution(goal_id, 150_000);

      const response = await listGoals({ status: 'active', page: '1', per_page: '20', sort: 'target_date' });
      expect(response.status).toBe(200);

      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(1);
      expectPagination(body.pagination, { page: 1, per_page: 20, total_items: 1, total_pages: 1 });

  const goal = body.goals[0]!;
      expect(goal.goal_id).toBe(goal_id);
      expect(goal.status).toBe('active');
      expect(goal.category).toBe('education');
      expect(goal.target_amount).toBe(500_000);
      expect(goal.current_amount).toBe(150_000);
      expect(goal.progress_percentage).toBeCloseTo(30, 2);
      expect(goal.target_date).toBe(targetDate);
      expect(goal.milestones).toHaveLength(4);
      const milestone25 = goal.milestones.find((milestone) => milestone.percentage === 25);
      expect(milestone25?.achieved).toBe(true);
      const nextMilestone = goal.next_milestone;
      expect(nextMilestone).not.toBeNull();
      expect(nextMilestone?.target_amount).toBe(250_000);
      expect(nextMilestone?.amount_remaining).toBe(100_000);
    });

    it('flags goals nearing their target date within seven days', async () => {
      await createGoal({ name: 'Emergency Fund', target_amount: 200_000, target_date: dateFromToday(5) });

      const response = await listGoals();
      expect(response.status).toBe(200);

      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(1);
  const goal = body.goals[0]!;
      expect(goal.target_date_warning).toBe(true);
      expect(goal.days_until_target).toBeGreaterThanOrEqual(0);
      expect(goal.days_until_target).toBeLessThanOrEqual(7);
    });
  });

  describe('filtering and sorting', () => {
    it('filters by status and category', async () => {
      const { goal_id: completedGoalId } = await createGoal({ name: 'Travel Fund', target_amount: 200_000, category: 'travel' });
      await ctx.integration.services.savingsGoalService.recordContribution(completedGoalId, 200_000);

      await createGoal({ name: 'Gadget Fund', target_amount: 150_000, category: 'electronics' });

      const response = await listGoals({ status: 'completed', category: 'travel' });
      expect(response.status).toBe(200);

      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(1);
  const goal = body.goals[0]!;
      expect(goal.goal_id).toBe(completedGoalId);
      expect(goal.status).toBe('completed');
      expect(goal.category).toBe('travel');
      expect(goal.final_progress).toBeNull();
    });

    it('includes archived goals when archived=true', async () => {
      const { goal_id } = await createGoal({ name: 'Cancelled Goal', target_amount: 300_000, category: 'emergency' });
      const repository = ctx.integration.repositories.savingsGoalRepository;
      const stored = await repository.findById(goal_id);
      if (!stored) {
        throw new Error('Goal not found in repository');
      }

      const cancelledGoal = {
        ...stored,
        status: 'cancelled' as const,
        currentAmount: 150_000,
        updatedAt: new Date(),
      };
      await repository.save(cancelledGoal);

      const response = await listGoals({ archived: 'true' });
      expect(response.status).toBe(200);

      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(1);
  const goal = body.goals[0]!;
      expect(goal.status).toBe('cancelled');
      expect(goal.final_progress).not.toBeNull();
      expect(goal.final_progress?.progress_percentage).toBeCloseTo(50, 2);
    });
  });

  describe('empty states', () => {
    it('returns empty collection when user has no goals', async () => {
      const response = await listGoals();
      expect(response.status).toBe(200);

      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(0);
      expectPagination(body.pagination, { total_items: 0, total_pages: 0 });
    });
  });

  describe('security and error handling', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await ctx.execute(ctx.routes.savings.listGoals);
      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('isolates goals per user account', async () => {
      const { goal_id } = await createGoal({ name: 'Personal Savings' });
      expect(goal_id).toBeDefined();

      const response = await ctx.executeAsUser(ctx.routes.savings.listGoals, {
        userId: 'other-user-id',
        query: {},
      });

      expect(response.status).toBe(200);
      const body = response.body as ListGoalsResponse;
      expect(body.goals).toHaveLength(0);
    });
  });
});
