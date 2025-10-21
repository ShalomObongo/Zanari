import { describe, expect, it } from '@jest/globals';
import { TransactionService } from '../../api/src/services/TransactionService';

const createService = (overrides?: { dailyTotal?: number }) => {
  const transactionRepository = {
    sumUserTransactionsForDay: jest.fn().mockResolvedValue(overrides?.dailyTotal ?? 0),
    create: jest.fn().mockImplementation(async (transaction) => transaction),
  } as any;

  const service = new TransactionService({
    transactionRepository,
    clock: { now: () => new Date('2025-01-01T08:00:00Z') },
  } as any);

  return { service, transactionRepository };
};

describe('Unit: Transaction validation (T095)', () => {
  it('rejects non-integer amounts for single transaction', async () => {
    const { service } = createService();

    await expect(
      service.create({
        id: 'txn-1',
        userId: 'user-1',
        type: 'payment',
        amount: 1500.5,
        category: 'groceries',
      })
    ).rejects.toThrow('Transaction amount must be expressed in cents');
  });

  it('enforces single transaction limit of KES 5,000', async () => {
    const { service } = createService();

    await expect(
      service.create({
        id: 'txn-2',
        userId: 'user-1',
        type: 'payment',
        amount: 600_000,
        category: 'groceries',
      })
    ).rejects.toThrow('Single transaction limit exceeded');
  });

  it('enforces daily transaction cap of KES 20,000', async () => {
    const { service } = createService({ dailyTotal: 1_950_000 });

    await expect(
      service.create({
        id: 'txn-3',
        userId: 'user-1',
        type: 'payment',
        amount: 100_000,
        category: 'groceries',
      })
    ).rejects.toThrow('Daily transaction limit exceeded');
  });

  it('allows transaction when limits respected and persists via repository', async () => {
    const { service, transactionRepository } = createService({ dailyTotal: 500_000 });

    const transaction = await service.create({
      id: 'txn-4',
      userId: 'user-1',
      type: 'payment',
      amount: 150_000,
      category: 'groceries',
      metadata: {
        description: 'Payment to test merchant',
      },
    });

    expect(transaction.id).toBe('txn-4');
    expect(transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(transactionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'txn-4',
      amount: 150_000,
    }));
  });
});
