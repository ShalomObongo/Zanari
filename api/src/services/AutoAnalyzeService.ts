/**
 * AutoAnalyzeService scans recent transactions to tune round-up increments.
 */

import { UUID } from '../models/base';
import { RoundUpRule, validateRoundUpRule } from '../models/RoundUpRule';
import { Clock, Logger, NullLogger, RoundUpRuleRepository, SystemClock, TransactionRepository } from './types';

const ANALYSIS_WINDOW_DAYS = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class AutoAnalyzeService {
  private readonly transactionRepository: TransactionRepository;
  private readonly roundUpRuleRepository: RoundUpRuleRepository;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    transactionRepository: TransactionRepository;
    roundUpRuleRepository: RoundUpRuleRepository;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.transactionRepository = options.transactionRepository;
    this.roundUpRuleRepository = options.roundUpRuleRepository;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async analyze(userId: UUID): Promise<RoundUpRule> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const transactions = await this.transactionRepository.listRecentTransactions(userId, since);

    const spendTransactions = transactions.filter((transaction) =>
      ['payment', 'bill_payment', 'transfer_out'].includes(transaction.type),
    );

    if (spendTransactions.length === 0) {
      this.logger.warn('No transactions found for auto-analysis', { userId });
      return this.ensureDefaultRule(userId, now);
    }

    const average = spendTransactions.reduce((total, tx) => total + tx.amount, 0) / spendTransactions.length;
    const stdDeviation = Math.sqrt(
      spendTransactions.reduce((sum, tx) => sum + Math.pow(tx.amount - average, 2), 0) /
        spendTransactions.length,
    );

    // Heuristic: higher average spends -> higher increments, with guardrails
    const recommendedIncrement = this.pickIncrement(average, stdDeviation);

    let rule = await this.roundUpRuleRepository.findByUserId(userId);
    if (!rule) {
      rule = {
        id: `${userId}-rule`,
        userId,
        incrementType: 'auto',
        isEnabled: true,
        autoSettings: null,
        totalRoundUpsCount: 0,
        totalAmountSaved: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const updatedRule: RoundUpRule = {
      ...rule,
      incrementType: 'auto',
      autoSettings: {
        minIncrement: clamp(Math.round(recommendedIncrement / 2), 10, recommendedIncrement),
        maxIncrement: recommendedIncrement,
        analysisPeriodDays: ANALYSIS_WINDOW_DAYS,
        lastAnalysisAt: now,
      },
      updatedAt: now,
    };

    validateRoundUpRule(updatedRule);
    const saved = await this.roundUpRuleRepository.save(updatedRule);

    this.logger.info('Auto-analysis completed', {
      userId,
      recommendedIncrement,
      transactionsAnalyzed: spendTransactions.length,
    });

    return saved;
  }

  private pickIncrement(average: number, deviation: number): number {
    if (average < 5_000) {
      return 10;
    }
    if (average < 20_000) {
      return deviation > 10_000 ? 100 : 50;
    }
    if (average < 50_000) {
      return 100;
    }
    return 200;
  }

  private async ensureDefaultRule(userId: UUID, now: Date): Promise<RoundUpRule> {
    let rule = await this.roundUpRuleRepository.findByUserId(userId);
    if (!rule) {
      rule = {
        id: `${userId}-rule`,
        userId,
        incrementType: '10',
        isEnabled: true,
        autoSettings: null,
        totalRoundUpsCount: 0,
        totalAmountSaved: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    }

    rule.updatedAt = now;
    return this.roundUpRuleRepository.save(rule);
  }
}
