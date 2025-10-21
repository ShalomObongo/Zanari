import { describe, expect, it } from '@jest/globals';
import apiClient from '../../src/services/api';
import { PaymentService } from '../../api/src/services/PaymentService';
import { TransactionService } from '../../api/src/services/TransactionService';

const createPaymentService = () => {
  const transactionService = {
    create: jest.fn(),
    markStatus: jest.fn(),
  } as any;

  const transactionRepository = {
    update: jest.fn(),
  } as any;

  const walletService = {
    debit: jest.fn(),
    credit: jest.fn(),
    transferRoundUp: jest.fn(),
    getWallet: jest.fn().mockResolvedValue({
      id: 'wallet-main',
      userId: 'user-1',
      walletType: 'main',
      balance: 5_000_000,
      availableBalance: 5_000_000,
    }),
  } as any;

  const paystackClient = {
    initializeTransaction: jest.fn().mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/ref',
      accessCode: 'AC_ref',
      reference: 'ref',
      status: 'success',
      raw: {},
    }),
    verifyTransaction: jest.fn().mockResolvedValue({
      status: 'success',
      amount: 0,
      currency: 'KES',
      paidAt: new Date(),
      channel: 'mobile_money',
      fees: 0,
      metadata: {},
      raw: {},
    }),
    createTransferRecipient: jest.fn().mockResolvedValue({ recipientCode: 'RCP_TEST', raw: {} }),
    initiateTransfer: jest.fn().mockResolvedValue({
      status: 'success',
      transferCode: 'TRF_TEST',
      reference: 'ref',
      raw: {},
    }),
    verifyTransfer: jest.fn().mockResolvedValue({ status: 'success', transferCode: 'TRF_TEST', raw: {} }),
  } as any;

  const roundUpRuleRepository = {
    findByUserId: jest.fn().mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      incrementType: '50',
      isEnabled: true,
      autoSettings: null,
      totalRoundUpsCount: 40,
      totalAmountSaved: 35000,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    }),
  } as any;

  const retryQueue = {
    enqueue: jest.fn(),
  } as any;

  return new PaymentService({
    transactionService,
    transactionRepository,
    walletService,
    paystackClient,
    roundUpRuleRepository,
    retryQueue,
  } as any);
};

const createTransactionService = () => {
  const transactionRepository = {
    sumUserTransactionsForDay: jest.fn().mockResolvedValue(250_000),
    create: jest.fn().mockImplementation(async (tx) => tx),
  } as any;

  return new TransactionService({
    transactionRepository,
    clock: { now: () => new Date('2025-01-01T08:00:00Z') },
  } as any);
};

describe('Performance Benchmarks (T096)', () => {
  it('round-up calculations complete well below 200ms threshold', () => {
    const paymentService = createPaymentService();
    const iterations = 1_000;
    const start = Date.now();

    for (let i = 0; i < iterations; i += 1) {
      (paymentService as any).calculateRoundUp(4325 + (i % 100), {
        id: 'rule-1',
        userId: 'user-1',
        incrementType: '50',
        isEnabled: true,
        autoSettings: null,
        totalRoundUpsCount: 100,
        totalAmountSaved: 120_000,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      });
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });

  it('transaction creation validates limits within 200ms', async () => {
    const transactionService = createTransactionService();
    const start = Date.now();

    await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        transactionService.create({
          id: `txn-${index}`,
          userId: 'user-1',
          type: 'payment',
          amount: 120_000,
          category: 'groceries',
        }),
      ),
    );

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it('API client completes request pipeline under 300ms', async () => {
    const start = Date.now();

    await apiClient.get('/health', {
      skipAuth: true,
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
