/**
 * Contract Test: GET /transactions/{transactionId}
 * 
 * This test validates the transaction detail endpoint contract according to the API specification.
 * It tests retrieval of individual transaction details with Paystack integration data.
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
import { createUser } from '../../../api/src/models/User';
import {
  ContractTestEnvironment,
  createContractTestEnvironment,
} from '../helpers/environment';

type TransactionResponse = Record<string, any>;
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

describe('GET /transactions/{transactionId} Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const getTransaction = (
    transactionId: string,
    options: { userId?: string } = {},
  ) =>
    ctx.executeAsUser(ctx.routes.transactions.getTransaction, {
      params: { transactionId },
      ...(options.userId ? { userId: options.userId } : {}),
    });

  const seedTransaction = async (options: SeedTransactionOptions = {}): Promise<Transaction> => {
    const id = options.id ?? createTransactionId();
    const baseCreatedAt = options.createdAt ?? new Date();

    const created = await ctx.integration.services.transactionService.create({
      id,
      userId: options.userId ?? ctx.userId,
      type: options.type ?? 'payment',
      amount: options.amount ?? 23_000,
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

  describe('Successful transaction retrieval', () => {
    it('returns detailed payment information with Paystack metadata', async () => {
      const transaction = await seedTransaction({
        type: 'payment',
        category: 'groceries',
        amount: 45_000,
        fee: 750,
        description: 'Payment to Java House - order #456',
        merchantInfo: {
          name: 'Java House',
          tillNumber: '123456',
          paybillNumber: null,
          accountNumber: null,
        },
        paymentMethod: 'mpesa',
        externalTransactionId: 'ps_tx_456789',
        externalReference: 'ps_ref_abc123',
      });

      const response = await getTransaction(transaction.id);

      expect(response.status).toBe(200);
      const body = response.body as TransactionResponse;
      expect(body.id).toBe(transaction.id);
      expect(body.type).toBe('payment');
      expect(body.status).toBe('completed');
      expect(body.amount).toBe(45_000);
      expect(body.fee).toBe(750);
      expect(body.description).toContain('Java House');
      expect(body.paystack_reference).toBe('ps_ref_abc123');
      expect(body.paystack_transaction_id).toBe('ps_tx_456789');
      expect(body.gateway_response).toBe('Approved');
      expect(body.channel).toBe('mobile_money');
      expect(body.merchant_info).toMatchObject({
        name: 'Java House',
        till_number: '123456',
      });
      expect(body.round_up_details).toBeNull();
    });

    it('returns transfer transaction with derived recipient information', async () => {
      const transaction = await seedTransaction({
        type: 'transfer_out',
        category: 'transfer',
        description: 'Transfer to John Doe, 254712345679 - Rent payment',
        amount: 80_000,
        paymentMethod: 'mpesa',
        externalTransactionId: 'ps_transfer_123',
        externalReference: 'rcp_567',
      });

      const response = await getTransaction(transaction.id);

      expect(response.status).toBe(200);
      const body = response.body as TransactionResponse;
      expect(body.type).toBe('transfer_out');
      expect(body.paystack_transfer_id).toBe('ps_transfer_123');
      expect(body.paystack_recipient_code).toBe('rcp_567');
      expect(body.recipient_info).toMatchObject({
        name: 'John Doe',
        phone: '254712345679',
      });
    });

    it('returns round-up transaction with parent linkage and savings goal', async () => {
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
        description: 'Round-up savings transfer',
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

      const response = await getTransaction(roundUp.id);

      expect(response.status).toBe(200);
      const body = response.body as TransactionResponse;
      expect(body.type).toBe('round_up');
      expect(body.parent_transaction_id).toBe(payment.id);
      expect(body.savings_goal_id).toBe(ctx.integration.savingsWallet.id);
      expect(body.round_up_details).toMatchObject({
        original_amount: 23_000,
        round_up_amount: 2_000,
        related_transaction_id: payment.id,
      });
    });

    it('returns bill payment transaction with bill metadata', async () => {
      const transaction = await seedTransaction({
        type: 'bill_payment',
        category: 'utilities',
        amount: 150_000,
        fee: 1_500,
        description: 'Kenya Power invoice #ACC001',
        merchantInfo: {
          name: 'Kenya Power',
          paybillNumber: '400200',
          accountNumber: 'ACC001',
        },
        paymentMethod: 'mpesa',
        externalReference: 'ps_bill_ref_123',
        externalTransactionId: 'ps_bill_tx_456',
      });

      const response = await getTransaction(transaction.id);

      expect(response.status).toBe(200);
      const body = response.body as TransactionResponse;
      expect(body.type).toBe('bill_payment');
      expect(body.bill_info).toMatchObject({
        paybill_number: '400200',
        account_number: 'ACC001',
        biller_name: 'Kenya Power',
      });
      expect(body.gateway_response).toBe('Approved');
    });
  });

  describe('Validation and error handling', () => {
    it('returns 404 when transaction cannot be found', async () => {
      const missingId = createTransactionId();
      const response = await getTransaction(missingId);

      expect(response.status).toBe(404);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('rejects access attempts for transactions belonging to another user', async () => {
      const otherUser = createUser({
        id: randomUUID(),
        email: 'other.user@zanari.app',
        firstName: 'Other',
        lastName: 'User',
      });

      await ctx.integration.repositories.userRepository.create(otherUser);

      const foreignTransaction = await seedTransaction({ userId: otherUser.id });

      const response = await getTransaction(foreignTransaction.id);

      expect(response.status).toBe(403);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('TRANSACTION_ACCESS_DENIED');
    });

    it('validates transaction identifier format', async () => {
      const response = await getTransaction('invalid-id');

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('INVALID_TRANSACTION_ID_FORMAT');
    });
  });

  describe('Authentication', () => {
    it('requires an authenticated session', async () => {
      const transaction = await seedTransaction();

      const response = await ctx.execute(ctx.routes.transactions.getTransaction, {
        params: { transactionId: transaction.id },
      });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});