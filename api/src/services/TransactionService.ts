/**
 * TransactionService enforces transaction limits and lifecycle transitions.
 */

import { UUID } from '../models/base';
import {
  Transaction,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  createTransaction,
  validateTransaction,
} from '../models/Transaction';
import { Clock, Logger, NullLogger, SystemClock, TransactionRepository } from './types';

const SINGLE_TRANSACTION_LIMIT = 500_000; // KES 5,000 in cents
const DAILY_TRANSACTION_LIMIT = 2_000_000; // KES 20,000 in cents

export interface CreateTransactionOptions {
  id: UUID;
  userId: UUID;
  type: TransactionType;
  amount: number;
  category: Transaction['category'];
  autoCategorized?: boolean;
  metadata?: Partial<Transaction>;
}

export interface ListTransactionsOptions {
  userId: UUID;
  limit?: number;
  offset?: number;
  type?: TransactionType;
  category?: TransactionCategory;
}

export interface ListTransactionsResult {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class TransactionService {
  private readonly transactionRepository: TransactionRepository;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    transactionRepository: TransactionRepository;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.transactionRepository = options.transactionRepository;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async create(options: CreateTransactionOptions): Promise<Transaction> {
    this.assertWithinSingleLimit(options.amount);

    const now = this.clock.now();
    const dayStart = this.startOfDay(now);
    const dayTotal = await this.transactionRepository.sumUserTransactionsForDay(options.userId, dayStart);
    if (dayTotal + options.amount > DAILY_TRANSACTION_LIMIT) {
      throw new Error('Daily transaction limit exceeded');
    }

    const transaction = createTransaction({
      id: options.id,
      userId: options.userId,
      type: options.type,
      amount: options.amount,
      category: options.category,
      autoCategorized: options.autoCategorized ?? true,
      ...options.metadata,
    });

    const saved = await this.transactionRepository.create(transaction);

    this.logger.info('Transaction created', {
      userId: options.userId,
      transactionId: saved.id,
      amount: saved.amount,
      type: saved.type,
    });

    return saved;
  }

  async list(options: ListTransactionsOptions): Promise<ListTransactionsResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const offset = Math.max(0, options.offset ?? 0);

    const [transactions, total] = await Promise.all([
      this.transactionRepository.listByUser(options.userId, {
        limit,
        offset,
        type: options.type,
        category: options.category,
      }),
      this.transactionRepository.countByUser(options.userId, {
        type: options.type,
        category: options.category,
      }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
    };
  }

  async getById(userId: UUID, transactionId: UUID): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }

  async updateCategory(transaction: Transaction, category: TransactionCategory, autoCategorized: boolean): Promise<Transaction> {
    const updated: Transaction = {
      ...transaction,
      category,
      autoCategorized,
      updatedAt: this.clock.now(),
    };

    validateTransaction(updated);
    return this.transactionRepository.update(updated);
  }

  async markStatus(transaction: Transaction, status: TransactionStatus): Promise<Transaction> {
    const updated: Transaction = {
      ...transaction,
      status,
      completedAt: status === 'completed' ? this.clock.now() : transaction.completedAt,
      updatedAt: this.clock.now(),
    };

    validateTransaction(updated);
    const saved = await this.transactionRepository.update(updated);

    this.logger.info('Transaction status updated', {
      transactionId: saved.id,
      status,
    });

    return saved;
  }

  private assertWithinSingleLimit(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new Error('Transaction amount must be expressed in cents');
    }
    if (amount > SINGLE_TRANSACTION_LIMIT) {
      throw new Error('Single transaction limit exceeded');
    }
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }
}
