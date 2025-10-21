/**
 * CategorizationService applies rule-based merchant classification with manual overrides.
 */

import { UUID } from '../models/base';
import { Transaction, TransactionCategory } from '../models/Transaction';
import {
  CategorizationRule,
  Clock,
  Logger,
  NullLogger,
  SystemClock,
  TransactionClassificationInput,
  TransactionRepository,
} from './types';

const KEYWORD_CATEGORY_MAP: Record<TransactionCategory, string[]> = {
  airtime: ['airtime', 'safaricom', 'topup'],
  groceries: ['supermarket', 'groceries', 'market', 'food', 'java'],
  school_fees: ['school', 'tuition', 'university'],
  utilities: ['electric', 'water', 'kplc', 'utility', 'bill'],
  transport: ['uber', 'bolt', 'fuel', 'matatu', 'transport'],
  entertainment: ['movie', 'cinema', 'netflix', 'spotify', 'entertainment'],
  savings: ['savings', 'round-up', 'roundup'],
  transfer: ['transfer', 'send money', 'p2p'],
  other: [],
};

export interface CategorizeOptions {
  transactionId: UUID;
}

export interface ManualCategorizeOptions {
  transactionId: UUID;
  category: TransactionCategory;
}

export class CategorizationService {
  private readonly transactionRepository: TransactionRepository;
  private readonly rules: CategorizationRule[];
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    transactionRepository: TransactionRepository;
    rules?: CategorizationRule[];
    clock?: Clock;
    logger?: Logger;
  }) {
    this.transactionRepository = options.transactionRepository;
    this.rules = options.rules ?? [];
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async autoCategorizeTransaction(options: CategorizeOptions): Promise<Transaction> {
    const transaction = await this.requireTransaction(options.transactionId);
    if (!transaction.autoCategorized) {
      return transaction;
    }

    const category = this.classify({
      amount: transaction.amount,
      merchantName: transaction.merchantInfo?.name ?? null,
      description: transaction.description ?? null,
      type: transaction.type,
    });

    if (category === transaction.category) {
      return transaction;
    }

    const updated: Transaction = {
      ...transaction,
      category,
      updatedAt: this.clock.now(),
    };

    const saved = await this.transactionRepository.update(updated);
    this.logger.info('Transaction auto-categorized', {
      transactionId: transaction.id,
      previousCategory: transaction.category,
      category,
    });
    return saved;
  }

  async manualCategorize(options: ManualCategorizeOptions): Promise<Transaction> {
    const transaction = await this.requireTransaction(options.transactionId);
    const updated: Transaction = {
      ...transaction,
      category: options.category,
      autoCategorized: false,
      updatedAt: this.clock.now(),
    };

    const saved = await this.transactionRepository.update(updated);
    this.logger.info('Transaction manually re-tagged', {
      transactionId: transaction.id,
      category: options.category,
    });
    return saved;
  }

  listCategories(): TransactionCategory[] {
    return Object.keys(KEYWORD_CATEGORY_MAP) as TransactionCategory[];
  }

  classify(input: TransactionClassificationInput): TransactionCategory {
    if (input.type === 'round_up') {
      return 'savings';
    }

    const normalizedMerchant = input.merchantName?.toLowerCase() ?? '';
    for (const rule of this.rules) {
      if (rule.merchantName && normalizedMerchant.includes(rule.merchantName.toLowerCase())) {
        return rule.category;
      }
      if (rule.keywords?.some((keyword) => this.matchesKeyword(keyword, input))) {
        return rule.category;
      }
    }

    for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP) as [TransactionCategory, string[]][]) {
      if (keywords.some((keyword) => this.matchesKeyword(keyword, input))) {
        return category;
      }
    }

    // Amount-based fallback heuristics
    if (input.amount >= 50_000) {
      return 'school_fees';
    }
    if (input.amount >= 20_000) {
      return 'utilities';
    }

    return 'other';
  }

  private matchesKeyword(keyword: string, input: TransactionClassificationInput): boolean {
    const normalizedKeyword = keyword.toLowerCase();
    return (
      (input.merchantName ?? '').toLowerCase().includes(normalizedKeyword) ||
      (input.description ?? '').toLowerCase().includes(normalizedKeyword)
    );
  }

  private async requireTransaction(transactionId: UUID): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }
}
