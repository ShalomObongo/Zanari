import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '../../../api/src/models/Transaction';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

type ListTransactionsResponse = {
  transactions: Array<Record<string, unknown>>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
};

type ErrorResponse = {
  error: string;
  code: string;
  [key: string]: unknown;
};

const createTransactionId = () => `txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

interface SeedTransactionOptions {
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
}

describe('GET /transactions Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const listTransactions = (
    query: Record<string, string | undefined> = {},
    options: { userId?: string } = {},
  ) =>
    ctx.executeAsUser(ctx.routes.transactions.listTransactions, {
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
        description: options.description ?? 'Integration test transaction',
        fee: options.fee ?? 0,
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
      fromWalletId:
        options.fromWalletId !== undefined ? options.fromWalletId : created.fromWalletId,
      autoCategorized:
        options.autoCategorized !== undefined ? options.autoCategorized : created.autoCategorized,
      createdAt: baseCreatedAt,
      updatedAt: baseCreatedAt,
      completedAt:
        options.completedAt !== undefined
          ? options.completedAt
          : (options.status ?? created.status) === 'completed'
            ? baseCreatedAt
            : null,
    };

    if (created.retry) {
      updated.retry = created.retry;
    }

    return ctx.integration.repositories.transactionRepository.update(updated);
  };

  describe('Successful transaction retrieval', () => {
    it('returns transactions in descending chronological order with pagination metadata', async () => {
      const first = await seedTransaction({
        description: 'Matatu ride',
        category: 'transport',
        amount: 3_500,
        createdAt: new Date('2025-09-22T08:00:00Z'),
      });
      const second = await seedTransaction({
        description: 'Restaurant dinner',
        category: 'groceries',
        amount: 8_000,
        createdAt: new Date('2025-09-23T18:30:00Z'),
      });
      const third = await seedTransaction({
        description: 'Utility bill',
        category: 'utilities',
        amount: 12_500,
        createdAt: new Date('2025-09-24T05:15:00Z'),
      });

      const response = await listTransactions();

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(20);
      expect(body.pagination.offset).toBe(0);
      expect(body.pagination.has_more).toBe(false);

      const ids = body.transactions.map((transaction) => transaction.id);
      expect(ids).toEqual([third.id, second.id, first.id]);
    });

    it('supports limit and offset query parameters', async () => {
      await seedTransaction({ description: 'Coffee', createdAt: new Date('2025-09-23T09:00:00Z') });
      const middle = await seedTransaction({ description: 'Groceries', createdAt: new Date('2025-09-23T10:00:00Z') });
      await seedTransaction({ description: 'Fuel', createdAt: new Date('2025-09-23T11:00:00Z') });

      const response = await listTransactions({ limit: '1', offset: '1' });

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      expect(body.transactions).toHaveLength(1);
      const first = body.transactions[0]! as Record<string, any>;
      expect(first.id).toBe(middle.id);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.offset).toBe(1);
      expect(body.pagination.has_more).toBe(true);
    });

    it('filters transactions by type', async () => {
      await seedTransaction({ type: 'payment', category: 'groceries' });
      const roundUp = await seedTransaction({ type: 'round_up', category: 'savings', amount: 1_500 });

      const response = await listTransactions({ type: 'round_up' });

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      expect(body.transactions).toHaveLength(1);
      const first = body.transactions[0]! as Record<string, any>;
      expect(first.id).toBe(roundUp.id);
      expect(first.type).toBe('round_up');
    });

    it('filters transactions by category', async () => {
      await seedTransaction({ category: 'groceries', description: 'Lunch' });
      const utilities = await seedTransaction({ category: 'utilities', description: 'Electricity bill' });

      const response = await listTransactions({ category: 'utilities' });

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      expect(body.transactions).toHaveLength(1);
      const first = body.transactions[0]! as Record<string, any>;
      expect(first.id).toBe(utilities.id);
      expect(first.category).toBe('utilities');
    });

    it('returns Paystack metadata for payment transactions', async () => {
      const payment = await seedTransaction({
        type: 'payment',
        category: 'utilities',
        amount: 50_000,
        fee: 750,
        description: 'Payment via Paystack',
        paymentMethod: 'mpesa',
        externalTransactionId: 'ps_tx_456789',
        externalReference: 'ps_ref_abc123',
        merchantInfo: {
          name: 'Kenya Power',
          paybillNumber: '400200',
          accountNumber: 'ACC001',
          tillNumber: null,
        },
      });

      const response = await listTransactions();

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      const transaction = body.transactions.find((item) => item.id === payment.id) as Record<string, any>;
      expect(transaction.paystack_reference).toBe('ps_ref_abc123');
      expect(transaction.paystack_transaction_id).toBe('ps_tx_456789');
      expect(transaction.channel).toBe('mobile_money');
      expect(transaction.gateway_response).toBe('Approved');
      expect(transaction.merchant_info).toMatchObject({
        name: 'Kenya Power',
        paybill_number: '400200',
        account_number: 'ACC001',
      });
    });

    it('maps round-up transactions with related payment context', async () => {
      const payment = await seedTransaction({
        type: 'payment',
        category: 'groceries',
        amount: 23_000,
        description: 'Supermarket purchase',
      });

      const roundUp = await seedTransaction({
        type: 'round_up',
        category: 'savings',
        amount: 2_000,
        description: 'Round-up transfer',
        roundUpDetails: {
          originalAmount: 23_000,
          roundUpAmount: 2_000,
          roundUpRule: '25000',
          relatedTransactionId: payment.id,
        },
        toWalletId: ctx.integration.savingsWallet.id,
      });

      await ctx.integration.repositories.transactionRepository.update({
        ...payment,
        roundUpDetails: {
          originalAmount: payment.amount,
          roundUpAmount: 2_000,
          roundUpRule: '25000',
          relatedTransactionId: roundUp.id,
        },
        updatedAt: payment.updatedAt,
        completedAt: payment.completedAt,
      });

      const response = await listTransactions();

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      const paymentPayload = body.transactions.find((item) => item.id === payment.id) as Record<string, any>;
      const roundUpPayload = body.transactions.find((item) => item.id === roundUp.id) as Record<string, any>;

      expect(paymentPayload.round_up_details).toMatchObject({
        original_amount: 23_000,
        round_up_amount: 2_000,
        related_transaction_id: roundUp.id,
      });
      expect(roundUpPayload.parent_transaction_id).toBe(payment.id);
      expect(roundUpPayload.savings_goal_id).toBe(ctx.integration.savingsWallet.id);
    });

    it('returns an empty history for new users', async () => {
      const response = await listTransactions();

      expect(response.status).toBe(200);
      const body = response.body as ListTransactionsResponse;
      expect(body.transactions).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.has_more).toBe(false);
    });
  });

  describe('Validation and error handling', () => {
    it('rejects limit values greater than 100', async () => {
      const response = await listTransactions({ limit: '200' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('LIMIT_TOO_HIGH');
    });

    it('rejects invalid category filters', async () => {
      const response = await listTransactions({ category: 'luxury' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_CATEGORY_FILTER');
    });

    it('rejects invalid type filters', async () => {
      const response = await listTransactions({ type: 'invalid_type' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_TYPE_FILTER');
    });
  });

  describe('Authentication', () => {
    it('requires a valid authenticated session', async () => {
      const response = await ctx.execute(ctx.routes.transactions.listTransactions, { query: {} });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});