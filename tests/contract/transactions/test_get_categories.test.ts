/**
 * Contract Test: GET /transactions/categories
 *
 * This test validates the transaction categorization taxonomy endpoint contract according to the product specification.
 * It ensures the API returns categorized spending insights, accuracy metrics, and manual override tracking for users.
 *
 * Based on functional requirements:
 * - Provide automatically categorized spending with minimum 80% accuracy (FR-024)
 * - Surface confidence scores for manual validation (FR-024)
 * - Allow manual re-tagging support details (FR-025)
 * - Ensure privacy by avoiding PII in category summaries
 *
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../../../api/src/models/Transaction';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

type CategoriesResponse = {
  categories: Array<Record<string, any>>;
  metadata: Record<string, any>;
};

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

type SeedTransactionOptions = {
  id?: string;
  userId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  amount?: number;
  fee?: number;
  category?: TransactionCategory;
  description?: string | null;
  autoCategorized?: boolean;
  merchantInfo?: Transaction['merchantInfo'];
  paymentMethod?: Transaction['paymentMethod'];
  externalTransactionId?: string | null;
  externalReference?: string | null;
  roundUpDetails?: Transaction['roundUpDetails'];
  createdAt?: Date;
  completedAt?: Date | null;
  toWalletId?: string | null;
  fromWalletId?: string | null;
};

const createTransactionId = () => `txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

describe('GET /transactions/categories Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const listCategories = (
    query: Record<string, string | undefined> = {},
    options: { userId?: string } = {},
  ) =>
    ctx.executeAsUser(ctx.routes.transactions.listCategories, {
      query,
      ...(options.userId ? { userId: options.userId } : {}),
    });

  const seedTransaction = async (options: SeedTransactionOptions = {}): Promise<Transaction> => {
    const id = options.id ?? createTransactionId();
    const baseCreatedAt = options.createdAt ?? new Date();

    const created = await ctx.integration.services.transactionService.create({
      id,
      userId: options.userId ?? ctx.userId,
      type: options.type ?? 'payment',
      amount: options.amount ?? 25_000,
      category: options.category ?? 'other',
      autoCategorized: options.autoCategorized ?? true,
      metadata: {
        status: options.status ?? 'completed',
        fee: options.fee ?? 0,
        description: options.description ?? 'Integration test transaction',
        merchantInfo: options.merchantInfo ?? null,
        paymentMethod: options.paymentMethod ?? null,
        externalTransactionId: options.externalTransactionId ?? null,
        externalReference: options.externalReference ?? null,
        roundUpDetails: options.roundUpDetails ?? null,
        toWalletId: options.toWalletId ?? null,
        fromWalletId: options.fromWalletId ?? null,
      },
    });

    const updated: Transaction = {
      ...created,
      status: options.status ?? created.status,
      amount: options.amount ?? created.amount,
      fee: options.fee ?? created.fee,
      description: options.description ?? created.description,
      category: options.category ?? created.category,
      autoCategorized:
        options.autoCategorized !== undefined ? options.autoCategorized : created.autoCategorized,
      merchantInfo:
        options.merchantInfo !== undefined ? options.merchantInfo : created.merchantInfo,
      paymentMethod:
        options.paymentMethod !== undefined ? options.paymentMethod : created.paymentMethod,
      externalTransactionId:
        options.externalTransactionId !== undefined
          ? options.externalTransactionId
          : created.externalTransactionId,
      externalReference:
        options.externalReference !== undefined
          ? options.externalReference
          : created.externalReference,
      roundUpDetails:
        options.roundUpDetails !== undefined ? options.roundUpDetails : created.roundUpDetails,
      toWalletId: options.toWalletId !== undefined ? options.toWalletId : created.toWalletId,
      fromWalletId: options.fromWalletId !== undefined ? options.fromWalletId : created.fromWalletId,
      createdAt: baseCreatedAt,
      updatedAt: baseCreatedAt,
      completedAt:
        options.completedAt !== undefined
          ? options.completedAt
          : (options.status ?? created.status) === 'completed'
            ? baseCreatedAt
            : null,
    };

    return ctx.integration.repositories.transactionRepository.update(updated);
  };

  describe('Successful category retrieval', () => {
    it('returns computed category insights with merchants and metadata', async () => {
      await seedTransaction({
        category: 'groceries',
        amount: 12_500,
        merchantInfo: { name: 'Naivas Supermarket' },
      });
      await seedTransaction({
        category: 'groceries',
        amount: 18_300,
        merchantInfo: { name: 'Quickmart Westlands' },
      });
      await seedTransaction({
        category: 'transport',
        amount: 3_800,
        description: 'Matatu fare manual override',
        merchantInfo: { name: 'City Shuttle' },
        autoCategorized: false,
      });

      const response = await listCategories();

      expect(response.status).toBe(200);
      const body = response.body as CategoriesResponse;
      expect(Array.isArray(body.categories)).toBe(true);
      expect(body.categories.length).toBeGreaterThan(0);

      const groceries = body.categories.find((category) => category.key === 'groceries');
      expect(groceries).toBeDefined();
      expect(groceries?.display_name).toBe('Groceries & Dining');
      expect(groceries?.sample_merchants).toEqual(
        expect.arrayContaining(['Naivas Supermarket', 'Quickmart Westlands']),
      );
      expect(groceries?.suggestions?.recommended_roundup_increment).toBe(100);
      expect(groceries?.manual_overrides.total).toBe(0);

      const transport = body.categories.find((category) => category.key === 'transport');
      expect(transport).toBeDefined();
      expect(transport?.manual_overrides.total).toBe(1);
      expect(transport?.manual_overrides.override_ratio).toBeGreaterThan(0);
      expect(transport?.sample_merchants).toEqual(expect.arrayContaining(['City Shuttle']));

      expect(body.metadata.model_version).toBe('categorizer-v2.3.0');
      expect(body.metadata.overall_accuracy).toBeGreaterThanOrEqual(0.8);
      expect(body.metadata.total_transactions_categorized).toBeGreaterThanOrEqual(3);
      expect(body.metadata.categories_requiring_attention).toContain('transport');
    });

    it('supports disabling merchant and suggestion payloads via query parameters', async () => {
      await seedTransaction({
        category: 'entertainment',
        merchantInfo: { name: 'Netflix' },
      });

      const response = await listCategories({
        include_merchants: 'false',
        include_suggestions: 'false',
      });

      expect(response.status).toBe(200);
      const body = response.body as CategoriesResponse;
      const entertainment = body.categories.find((category) => category.key === 'entertainment');
      expect(entertainment).toBeDefined();
      expect(entertainment?.sample_merchants).toBeNull();
      expect(entertainment?.suggestions).toBeNull();
    });

    it('filters out categories below the requested minimum accuracy', async () => {
      await seedTransaction({
        category: 'groceries',
        merchantInfo: { name: 'Naivas' },
      });
      await seedTransaction({
        category: 'transport',
        merchantInfo: { name: 'RideShare' },
        autoCategorized: false,
      });

      const response = await listCategories({ min_accuracy: '0.9' });

      expect(response.status).toBe(200);
      const body = response.body as CategoriesResponse;
      const categoryKeys = body.categories.map((category) => category.key);
      expect(categoryKeys).toContain('groceries');
      expect(categoryKeys).not.toContain('transport');
    });

    it('returns flagged transactions when manual review is requested', async () => {
      await seedTransaction({
        category: 'entertainment',
        merchantInfo: { name: 'Netflix Kenya' },
        description: 'Manual override - ambiguous merchant',
        autoCategorized: false,
      });
      await seedTransaction({
        category: 'transport',
        merchantInfo: { name: 'Bolt' },
        autoCategorized: false,
      });

      const response = await listCategories({ review_required: 'true' });

      expect(response.status).toBe(200);
      const body = response.body as CategoriesResponse;
      expect(body.categories.length).toBeGreaterThanOrEqual(1);
      body.categories.forEach((category) => {
        expect(category.manual_overrides.total).toBeGreaterThan(0);
        expect(category.flagged_transactions).toBeDefined();
        expect(Array.isArray(category.flagged_transactions)).toBe(true);
        expect(category.flagged_transactions.length).toBeGreaterThan(0);
      });
    });

    it('returns the default taxonomy for new users with no transactions', async () => {
      const response = await listCategories();

      expect(response.status).toBe(200);
      const body = response.body as CategoriesResponse;
      const groceries = body.categories.find((category) => category.key === 'groceries');
      expect(groceries).toBeDefined();
      expect(groceries?.transaction_count).toBe(0);
      expect(groceries?.auto_assignment_accuracy).toBeNull();
      expect(Array.isArray(groceries?.sample_merchants)).toBe(true);
      expect(groceries?.sample_merchants).toHaveLength(0);
      expect(body.metadata.total_transactions_categorized).toBe(0);
    });
  });

  describe('Validation and error handling', () => {
    it('validates min_accuracy bounds', async () => {
      const response = await listCategories({ min_accuracy: '1.5' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_MIN_ACCURACY');
    });

    it('validates boolean query parameters', async () => {
      const response = await listCategories({ review_required: 'maybe' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_QUERY_BOOLEAN');
    });
  });

  describe('Authentication', () => {
    it('requires an authenticated session', async () => {
      const response = await ctx.execute(ctx.routes.transactions.listCategories, { query: {} });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});
