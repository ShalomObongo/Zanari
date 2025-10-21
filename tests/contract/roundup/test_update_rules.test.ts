import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface UpdateRuleResponse {
  user_id: string;
  rules: {
    enabled: boolean;
    rule_type: 'target' | 'fixed' | 'auto' | null;
    target_amount: number | null;
    fixed_amount: number | null;
    allocation: null | {
      main_wallet_percentage: number;
      savings_goals_percentage: number;
    };
  };
  updated_at: string;
  auto_analysis: {
    recommendation_generated: boolean;
    [key: string]: unknown;
  };
}

interface ErrorResponse {
  error: string;
  code: string;
  [key: string]: unknown;
}

describe('PUT /roundup/rules Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const updateRule = (body: Record<string, unknown>, options: { userId?: string } = {}) =>
    ctx.executeAsUser(ctx.routes.roundUp.updateRule, {
      body,
      ...(options.userId ? { userId: options.userId } : {}),
    });

  const readPersistedRule = () =>
    ctx.integration.repositories.roundUpRuleRepository.findByUserId(ctx.userId);

  describe('Successful rule updates', () => {
    it('enables target increment rules with explicit allocation', async () => {
      const response = await updateRule({
        enabled: true,
        rule_type: 'target',
        target_amount: 1_000,
        allocation: {
          main_wallet_percentage: 40,
          savings_goals_percentage: 60,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateRuleResponse;
      expect(body.user_id).toBe(ctx.userId);
      expect(body.rules).toMatchObject({
        enabled: true,
        rule_type: 'target',
        target_amount: 1_000,
        allocation: {
          main_wallet_percentage: 40,
          savings_goals_percentage: 60,
        },
      });
      expect(new Date(body.updated_at).toString()).not.toBe('Invalid Date');
      expect(body.auto_analysis).toHaveProperty('recommendation_generated');

      const persisted = await readPersistedRule();
      expect(persisted?.isEnabled).toBe(true);
      expect(persisted?.incrementType).toBe('10');
    });

    it('switches to fixed increment rules and returns projections metadata', async () => {
      await updateRule({
        enabled: true,
        rule_type: 'fixed',
        fixed_amount: 500,
        allocation: {
          main_wallet_percentage: 30,
          savings_goals_percentage: 70,
        },
      });

      const persisted = await readPersistedRule();
      expect(persisted?.isEnabled).toBe(true);
      expect(persisted?.incrementType).toBe('10');
      expect(persisted?.autoSettings).toBeNull();

      const response = await updateRule({ allocation: { main_wallet_percentage: 80, savings_goals_percentage: 20 } });
      const body = response.body as UpdateRuleResponse;
      expect(body.rules).toMatchObject({
        enabled: true,
        rule_type: 'fixed',
        fixed_amount: 500,
        allocation: {
          main_wallet_percentage: 80,
          savings_goals_percentage: 20,
        },
      });
    });

    it('disables round-up rules and clears stored configuration', async () => {
      const response = await updateRule({
        enabled: false,
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateRuleResponse;
      expect(body.rules).toMatchObject({
        enabled: false,
        rule_type: null,
        target_amount: null,
        fixed_amount: null,
        allocation: null,
      });
      expect(body.auto_analysis).toHaveProperty('historical_impact');

      const persisted = await readPersistedRule();
      expect(persisted?.isEnabled).toBe(false);
    });

    it('stores auto settings when switching to auto increment type', async () => {
      const response = await updateRule({
        enabled: true,
        rule_type: 'auto',
        increment_type: 'auto',
        auto_settings: {
          min_increment: 200,
          max_increment: 800,
          analysis_period_days: 45,
        },
        allocation: {
          main_wallet_percentage: 55,
          savings_goals_percentage: 45,
        },
      });

      const body = response.body as UpdateRuleResponse;
      expect(body.rules.rule_type).toBe('auto');
      expect(body.auto_analysis).toHaveProperty('recommendation_generated');

      const persisted = await readPersistedRule();
      expect(persisted?.incrementType).toBe('auto');
      expect(persisted?.autoSettings).toMatchObject({
        minIncrement: 200,
        maxIncrement: 800,
        analysisPeriodDays: 45,
      });
    });
  });

  describe('Validation failures', () => {
    it('defaults target_amount when omitted for target rules', async () => {
      const response = await updateRule({
        enabled: true,
        rule_type: 'target',
        allocation: {
          main_wallet_percentage: 50,
          savings_goals_percentage: 50,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateRuleResponse;
      expect(body.rules.target_amount).toBe(1_000);
    });

    it('rejects fixed rules without fixed_amount', async () => {
      const response = await updateRule({
        enabled: true,
        rule_type: 'fixed',
        allocation: {
          main_wallet_percentage: 50,
          savings_goals_percentage: 50,
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('MISSING_FIXED_AMOUNT');
    });

    it('validates allocation totals equal 100 percent', async () => {
      const response = await updateRule({
        enabled: true,
        rule_type: 'target',
        target_amount: 1_000,
        allocation: {
          main_wallet_percentage: 60,
          savings_goals_percentage: 45,
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_ALLOCATION');
    });

    it('requires at least one field to update', async () => {
      const response = await updateRule({});
      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('NO_UPDATE_FIELDS');
    });
  });

  describe('Authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const response = await ctx.execute(ctx.routes.roundUp.updateRule, {
        body: {
          enabled: true,
          rule_type: 'target',
          target_amount: 1_000,
          allocation: {
            main_wallet_percentage: 50,
            savings_goals_percentage: 50,
          },
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});