import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { Transaction } from '../../../api/src/models/Transaction';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

type UpdateCategoryResponse = {
  transaction_id: string;
  user_id: string;
  previous_category: string | null;
  new_category: string;
  override_source: string;
  override_reason: string | null;
  override_notes: string | null;
  manual_override_id: string;
  override_created_at: string;
  undo_token: string | null;
  undo_available: boolean;
  undo_expires_at: string | null;
  undo_reason: string | null;
  auto_categorization_accuracy: Record<string, unknown>;
  audit_log: {
    change_type: string;
    performed_by: string;
    performed_at: string;
    metadata: Record<string, unknown>;
  };
  compliance_report_id: string | null;
  suggested_follow_up_actions: {
    update_budget_allocation: boolean;
    review_related_transactions: string[];
  };
  round_up_rule_implications: Record<string, unknown>;
  model_feedback_queued: boolean;
  merchant_context: Record<string, unknown> | null;
  training_feedback: Record<string, unknown> | null;
  sanitized_merchant_info: Record<string, unknown> | null;
};

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

interface SeedTransactionOptions {
  category?: Transaction['category'];
  amount?: number;
  autoCategorized?: boolean;
  merchantName?: string;
  status?: Transaction['status'];
  completedAt?: Date;
  description?: string | null;
}

describe('PUT /transactions/{transactionId}/category Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const seedTransaction = async (options: SeedTransactionOptions = {}): Promise<Transaction> => {
    const transactionId = `txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const initial = await ctx.integration.services.transactionService.create({
      id: transactionId,
      userId: ctx.userId,
      type: 'payment',
      amount: options.amount ?? 23_000,
      category: options.category ?? 'other',
      autoCategorized: options.autoCategorized ?? true,
      metadata: {
        description: options.description ?? 'Integration test purchase',
        merchantInfo: {
          name: options.merchantName ?? 'Java House Nairobi',
          tillNumber: '123456',
        },
        status: options.status ?? 'completed',
      },
    });

    let current = initial;

    if ((options.status ?? 'completed') === 'completed') {
      current = await ctx.integration.services.transactionService.markStatus(current, 'completed');
    }

    if (options.completedAt) {
      current = await ctx.integration.repositories.transactionRepository.update({
        ...current,
        completedAt: options.completedAt,
        updatedAt: new Date(),
      });
    }

    if (options.autoCategorized !== undefined && current.autoCategorized !== options.autoCategorized) {
      current = await ctx.integration.repositories.transactionRepository.update({
        ...current,
        autoCategorized: options.autoCategorized,
        updatedAt: new Date(),
      });
    }

    return current;
  };

  const overrideCategory = (
    transactionId: string,
    body: Record<string, unknown>,
    options: { userId?: string } = {},
  ) =>
    ctx.executeAsUser(ctx.routes.transactions.updateTransactionCategory, {
      params: { transactionId },
      body,
      ...(options.userId ? { userId: options.userId } : {}),
    });

  const findTransaction = (transactionId: string) =>
    ctx.integration.repositories.transactionRepository.findById(transactionId);

  describe('Successful overrides', () => {
    it('updates the transaction category and returns enriched metadata', async () => {
      const transaction = await seedTransaction({ category: 'other', autoCategorized: true });

      const response = await overrideCategory(transaction.id, {
        category: 'groceries',
        reason: 'Recurring supermarket purchases',
        confidence_score: 0.42,
        notes: 'User confirmed merchant sells groceries only',
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateCategoryResponse;
      expect(body.transaction_id).toBe(transaction.id);
      expect(body.previous_category).toBe('other');
      expect(body.new_category).toBe('groceries');
      expect(body.override_source).toBe('user_override');
      expect(body.override_reason).toBe('Recurring supermarket purchases');
      expect(body.override_notes).toBe('User confirmed merchant sells groceries only');
      expect(body.manual_override_id).toMatch(/^override_/);
      expect(body.undo_token).toBe(`undo_${transaction.id}`);
      expect(body.undo_available).toBe(true);
      expect(body.undo_expires_at).not.toBeNull();
      expect(body.auto_categorization_accuracy).toBeDefined();
      expect(body.audit_log).toMatchObject({
        change_type: 'category_override',
        performed_by: 'user_override',
      });
      expect(body.suggested_follow_up_actions.review_related_transactions).toContain(transaction.id);
      expect(body.sanitized_merchant_info).toMatchObject({
        merchant_label: 'Java House Nairobi',
        merchant_category: 'groceries',
      });

      const persisted = await findTransaction(transaction.id);
      expect(persisted?.category).toBe('groceries');
      expect(persisted?.autoCategorized).toBe(false);
    });

    it('supports merchant context enrichments and training feedback metadata', async () => {
      const transaction = await seedTransaction({ category: 'other' });

      const response = await overrideCategory(transaction.id, {
        category: 'entertainment',
        reason: 'Monthly streaming subscription',
        confidence_score: 0.35,
        merchant_context: {
          normalized_name: 'netflix',
          observed_descriptions: ['Netflix.com Nairobi'],
        },
        training_feedback: {
          include_in_next_training: true,
          annotation_tags: ['subscription', 'digital_services'],
          user_confirmation_required: false,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateCategoryResponse;
      expect(body.new_category).toBe('entertainment');
      expect(body.merchant_context).toMatchObject({
        normalized_name: 'netflix',
        merchant_id: 'merchant_netflix',
        historical_accuracy: 0.68,
      });
      expect(body.training_feedback).toMatchObject({
        queued_for_training: true,
        annotation_tags: ['subscription', 'digital_services'],
        user_confirmation_required: false,
      });
      expect(body.model_feedback_queued).toBe(true);
    });

    it('omits undo tokens for support agent overrides and produces compliance metadata', async () => {
      const transaction = await seedTransaction({ category: 'utilities', autoCategorized: false });

      const response = await overrideCategory(transaction.id, {
        category: 'utilities',
        source: 'support_agent',
        reason: 'Compliance review update',
      });

      expect(response.status).toBe(200);
      const body = response.body as UpdateCategoryResponse;
      expect(body.override_source).toBe('support_agent');
      expect(body.undo_available).toBe(false);
      expect(body.undo_token).toBeNull();
      expect(body.undo_reason).toBe('Override performed by support - not reversible');
      expect(body.compliance_report_id).toMatch(/^compliance_/);
    });
  });

  describe('Validation failures', () => {
    it('rejects categories outside the allowed enumeration', async () => {
      const transaction = await seedTransaction();

      const response = await overrideCategory(transaction.id, {
        category: 'luxury',
        reason: 'Invalid selection',
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_CATEGORY');
    });

    it('requires reason when overriding an auto-categorized transaction', async () => {
      const transaction = await seedTransaction({ autoCategorized: true });

      const response = await overrideCategory(transaction.id, {
        category: 'utilities',
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('REASON_REQUIRED');
    });

    it('enforces confidence score range of 0 to 1 inclusive', async () => {
      const transaction = await seedTransaction();

      const response = await overrideCategory(transaction.id, {
        category: 'transport',
        reason: 'Ride-sharing fare',
        confidence_score: 1.2,
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_CONFIDENCE_SCORE');
    });

    it('prevents overrides once a transaction is outside the settlement window', async () => {
      const lockedCompletedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const transaction = await seedTransaction({ completedAt: lockedCompletedAt });

      const response = await overrideCategory(transaction.id, {
        category: 'savings',
        reason: 'Internal transfer to savings',
      });

      expect(response.status).toBe(409);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('CATEGORY_LOCKED');
      expect(body.locked_at).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('requires a valid authenticated session', async () => {
      const transaction = await seedTransaction();

      const response = await ctx.execute(ctx.routes.transactions.updateTransactionCategory, {
        params: { transactionId: transaction.id },
        body: {
          category: 'groceries',
          reason: 'Auth validation',
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});
