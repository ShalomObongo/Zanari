/**
 * Contract tests for POST /savings/goals using the real integration stack.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface CreateGoalPayload {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface CreateGoalResponse {
  goal_id: string;
  name: string;
  description: string | null;
  target_amount: number;
  target_date: string | null;
  category: string;
  current_amount: number;
  progress_percentage: number;
  status: string;
  lock_in_enabled: boolean;
  milestones: Array<{
    milestone_id: string;
    percentage: number;
    target_amount: number;
    current_amount: number;
    achieved: boolean;
    achieved_at: string | null;
  }>;
  next_milestone: {
    milestone_id: string;
    amount_remaining: number;
    target_amount: number;
    percentage: number;
    estimated_completion_days: number | null;
  } | null;
  created_at: string;
  updated_at: string;
}

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

const MIN_TARGET = 500; // cents
const MAX_TARGET = 100_000_000; // cents

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

describe('POST /savings/goals', () => {
  let ctx: ContractTestEnvironment;

  beforeAll(async () => {
    ctx = await createContractTestEnvironment();
  });

  const buildPayload = (overrides: Partial<CreateGoalPayload> = {}): CreateGoalPayload => ({
    name: `Goal ${uniqueSuffix()}`,
    description: 'Saving towards something meaningful',
    target_amount: 25_000,
    target_date: dateFromToday(120),
    category: 'education',
    lock_in_enabled: false,
    ...overrides,
  });

  const executeCreate = (payload: CreateGoalPayload) =>
    ctx.executeAsUser(ctx.routes.savings.createGoal, {
      body: payload,
    });

  const expectMilestoneTargets = (response: CreateGoalResponse, targetAmount: number) => {
    const expectedPercentages = [25, 50, 75, 100];
    const expectedTargets = expectedPercentages.map((percentage) => Math.round((targetAmount * percentage) / 100));

    expect(response.milestones).toHaveLength(4);
    response.milestones.forEach((milestone, index) => {
      expect(milestone.percentage).toBe(expectedPercentages[index]);
      expect(milestone.target_amount).toBe(expectedTargets[index]);
      expect(milestone.current_amount).toBe(0);
      expect(milestone.achieved).toBe(false);
      expect(milestone.achieved_at).toBeNull();
    });
  };

  const expectErrorResponse = (response: { status: number; body: unknown }, status: number, code: string) => {
    expect(response.status).toBe(status);
    const body = response.body as ErrorResponse;
    expect(body.error).toBeDefined();
    expect(body.code).toBe(code);
  };

  describe('successful goal creation', () => {
    it('creates a savings goal with calculated milestones and metadata', async () => {
      const payload = buildPayload();

      const response = await executeCreate(payload);
      expect(response.status).toBe(201);

      const body = response.body as CreateGoalResponse;
  expect(body.goal_id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(body.name).toBe(payload.name);
      expect(body.description).toBe(payload.description);
      expect(body.target_amount).toBe(payload.target_amount);
      expect(body.target_date).toBe(payload.target_date);
      expect(body.category).toBe(payload.category);
      expect(body.status).toBe('active');
      expect(body.current_amount).toBe(0);
      expect(body.progress_percentage).toBe(0);
      expect(body.lock_in_enabled).toBe(false);

      expectMilestoneTargets(body, payload.target_amount!);

      if (body.next_milestone) {
        expect(body.next_milestone.target_amount).toBe(Math.round(payload.target_amount! * 0.25));
        expect(body.next_milestone.amount_remaining).toBe(Math.round(payload.target_amount! * 0.25));
      } else {
        throw new Error('Expected next_milestone to be provided');
      }

      expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
      expect(new Date(body.updated_at).toISOString()).toBe(body.updated_at);
    });

    it('defaults the category to general when omitted', async () => {
      const payload = buildPayload();
      delete payload.category;

      const response = await executeCreate(payload);
      expect(response.status).toBe(201);

      const body = response.body as CreateGoalResponse;
      expect(body.category).toBe('general');
    });

    it('allows nullable fields like target_date and description', async () => {
      const payload = buildPayload({
        description: null,
        target_date: null,
        lock_in_enabled: true,
      });

      const response = await executeCreate(payload);
      expect(response.status).toBe(201);

      const body = response.body as CreateGoalResponse;
      expect(body.description).toBeNull();
      expect(body.target_date).toBeNull();
      expect(body.lock_in_enabled).toBe(true);
    });

    it('trims category whitespace before persisting', async () => {
      const payload = buildPayload({ category: '  travel  ' });

      const response = await executeCreate(payload);
      expect(response.status).toBe(201);

      const body = response.body as CreateGoalResponse;
      expect(body.category).toBe('travel');
    });

    it('rejects duplicate goal names for the same user', async () => {
      const name = `Duplicate Goal ${uniqueSuffix()}`;
      const base = buildPayload({ name });

      const first = await executeCreate(base);
      expect(first.status).toBe(201);

      const second = await executeCreate(buildPayload({ name }));
      expectErrorResponse(second, 409, 'DUPLICATE_GOAL_NAME');
    });
  });

  describe('input validation', () => {
    it('requires a goal name', async () => {
      const payload = buildPayload();
      delete payload.name;

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'MISSING_GOAL_NAME');
    });

    it('rejects empty goal names', async () => {
      const payload = buildPayload({ name: '   ' });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'EMPTY_GOAL_NAME');
    });

    it('enforces maximum goal name length', async () => {
      const payload = buildPayload({ name: 'G'.repeat(51) });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'GOAL_NAME_TOO_LONG');
    });

    it('requires target amount to be an integer', async () => {
      const payload = buildPayload({ target_amount: 10_000.5 as unknown as number });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'INVALID_AMOUNT_FORMAT');
    });

    it('rejects target amounts below the minimum', async () => {
      const payload = buildPayload({ target_amount: MIN_TARGET - 1 });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'AMOUNT_TOO_LOW');
    });

    it('rejects target amounts above the maximum', async () => {
      const payload = buildPayload({ target_amount: MAX_TARGET + 1 });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'AMOUNT_TOO_HIGH');
    });

    it('rejects target dates in the past', async () => {
      const payload = buildPayload({ target_date: dateFromToday(-1) });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'INVALID_TARGET_DATE');
    });

    it('rejects invalid date formats', async () => {
      const payload = buildPayload({ target_date: '2024/05/01' });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'INVALID_DATE_FORMAT');
    });

    it('limits category length to 50 characters', async () => {
      const payload = buildPayload({ category: 'c'.repeat(51) });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'CATEGORY_TOO_LONG');
    });

    it('ensures lock_in_enabled is a boolean', async () => {
      const payload = buildPayload({ lock_in_enabled: 'yes' as unknown as boolean });

      const response = await executeCreate(payload);
      expectErrorResponse(response, 400, 'INVALID_BOOLEAN');
    });
  });
});