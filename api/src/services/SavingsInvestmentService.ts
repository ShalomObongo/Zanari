import { randomUUID } from 'node:crypto';

import { SavingsInvestmentPreference, createDefaultPreference } from '../models/SavingsInvestmentPreference';
import { SavingsInvestmentPosition, createSavingsInvestmentPosition } from '../models/SavingsInvestmentPosition';
import { WalletService } from './WalletService';
import {
  Clock,
  Logger,
  NullLogger,
  SavingsInvestmentPreferenceRepository,
  SavingsInvestmentPositionRepository,
  SystemClock,
} from './types';
import { UUID } from '../models/base';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_PRODUCT_CODE = 'default_savings_pool';
const DEFAULT_PRODUCT_NAME = 'Zanari Yield Pool';

export interface SavingsInvestmentSummary {
  autoInvestEnabled: boolean;
  targetAllocationPct: number;
  productCode: string;
  productName: string;
  annualYieldBps: number;
  investedAmount: number;
  accruedInterest: number;
  projectedMonthlyYield: number;
  savingsCashBalance: number;
  savingsAvailableBalance: number;
  totalValue: number;
  lastAccruedAt: Date | null;
}

interface SavingsInvestmentServiceOptions {
  walletService: WalletService;
  preferenceRepository: SavingsInvestmentPreferenceRepository;
  positionRepository: SavingsInvestmentPositionRepository;
  logger?: Logger;
  clock?: Clock;
  annualYieldBps?: number;
  minInvestmentAmount?: number;
}

export class SavingsInvestmentService {
  private readonly walletService: WalletService;
  private readonly preferenceRepository: SavingsInvestmentPreferenceRepository;
  private readonly positionRepository: SavingsInvestmentPositionRepository;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly annualYieldBps: number;
  private readonly minInvestmentAmount: number;

  constructor(options: SavingsInvestmentServiceOptions) {
    this.walletService = options.walletService;
    this.preferenceRepository = options.preferenceRepository;
    this.positionRepository = options.positionRepository;
    this.logger = options.logger ?? NullLogger;
    this.clock = options.clock ?? new SystemClock();
    this.annualYieldBps = options.annualYieldBps ?? 1200; // 12% APY baseline
    this.minInvestmentAmount = options.minInvestmentAmount ?? 500; // cents (KES 5)
  }

  async getSummary(userId: UUID): Promise<SavingsInvestmentSummary> {
    const wallet = await this.requireSavingsWallet(userId);
    const preference = await this.preferenceRepository.getOrCreateDefault(userId);
    const position = await this.ensurePosition(userId);
    const accruedPosition = await this.accrueInterest(position);
    return this.buildSummary(wallet.balance, wallet.availableBalance, preference, accruedPosition);
  }

  async updatePreference(userId: UUID, updates: Partial<Omit<SavingsInvestmentPreference, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<SavingsInvestmentSummary> {
    const preference = await this.preferenceRepository.getOrCreateDefault(userId);
    const nextPreference: SavingsInvestmentPreference = {
      ...preference,
      autoInvestEnabled: updates.autoInvestEnabled ?? preference.autoInvestEnabled,
      targetAllocationPct: updates.targetAllocationPct ?? preference.targetAllocationPct,
      preferredProductCode: updates.preferredProductCode ?? preference.preferredProductCode ?? DEFAULT_PRODUCT_CODE,
      updatedAt: this.clock.now(),
    };
    await this.preferenceRepository.save(nextPreference);
    this.logger.info('Updated savings investment preference', { userId, autoInvestEnabled: nextPreference.autoInvestEnabled });
    return this.getSummary(userId);
  }

  async allocate(userId: UUID, amount: number): Promise<SavingsInvestmentSummary> {
    this.assertPositiveAmount(amount);
    const wallet = await this.requireSavingsWallet(userId);
    if (wallet.availableBalance < amount) {
      throw new Error('Insufficient funds in savings wallet');
    }

    await this.walletService.debit({ userId, walletType: 'savings', amount });

    const position = await this.ensurePosition(userId);
    const updatedPosition: SavingsInvestmentPosition = {
      ...position,
      investedAmount: position.investedAmount + amount,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);
    this.logger.info('Allocated savings to investment', { userId, amount });
    return this.getSummary(userId);
  }

  async redeem(userId: UUID, amount: number): Promise<SavingsInvestmentSummary> {
    this.assertPositiveAmount(amount);
    const position = await this.ensurePosition(userId);
    if (position.investedAmount < amount) {
      throw new Error('Requested amount exceeds invested balance');
    }

    const updatedPosition: SavingsInvestmentPosition = {
      ...position,
      investedAmount: position.investedAmount - amount,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);

    await this.walletService.credit({ userId, walletType: 'savings', amount });
    this.logger.info('Redeemed investment back to savings', { userId, amount });
    return this.getSummary(userId);
  }

  async claimAccruedInterest(userId: UUID): Promise<SavingsInvestmentSummary> {
    const position = await this.ensurePosition(userId);
    await this.accrueInterest(position);
    const refreshed = await this.positionRepository.findByUserId(userId);
    if (!refreshed) {
      throw new Error('Investment position not found');
    }

    if (refreshed.accruedInterest <= 0) {
      return this.getSummary(userId);
    }

    const payout = refreshed.accruedInterest;
    const updatedPosition: SavingsInvestmentPosition = {
      ...refreshed,
      accruedInterest: 0,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);
    await this.walletService.credit({ userId, walletType: 'savings', amount: payout });
    this.logger.info('Credited accrued interest to savings wallet', { userId, payout });
    return this.getSummary(userId);
  }

  async autoAllocateSurplus(userId: UUID): Promise<void> {
    const preference = await this.preferenceRepository.getOrCreateDefault(userId);
    if (!preference.autoInvestEnabled || preference.targetAllocationPct <= 0) {
      return;
    }

    const wallet = await this.requireSavingsWallet(userId);
    const position = await this.ensurePosition(userId);
    const totalValue = wallet.balance + position.investedAmount;
    if (totalValue <= 0) {
      return;
    }

    const targetInvested = Math.floor((totalValue * preference.targetAllocationPct) / 100);
    if (targetInvested <= position.investedAmount) {
      return;
    }

    const delta = targetInvested - position.investedAmount;
    const amount = Math.min(delta, wallet.availableBalance);
    if (amount < this.minInvestmentAmount) {
      return;
    }

    await this.allocate(userId, amount);
  }

  private assertPositiveAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Amount must be a positive integer in cents');
    }
    if (amount < this.minInvestmentAmount) {
      throw new Error(`Minimum investment amount is ${this.minInvestmentAmount} cents`);
    }
  }

  private async ensurePosition(userId: UUID): Promise<SavingsInvestmentPosition> {
    const existing = await this.positionRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const created = createSavingsInvestmentPosition({ id: randomUUID(), userId, productCode: DEFAULT_PRODUCT_CODE });
    return this.positionRepository.save(created);
  }

  private async accrueInterest(position: SavingsInvestmentPosition): Promise<SavingsInvestmentPosition> {
    if (position.investedAmount <= 0) {
      return position;
    }

    const now = this.clock.now();
    const lastAccrual = position.lastAccruedAt ?? position.updatedAt ?? position.createdAt;
    const elapsedMs = now.getTime() - lastAccrual.getTime();
    if (elapsedMs <= 0) {
      return position;
    }

    const interest = Math.floor((position.investedAmount * this.annualYieldBps * elapsedMs) / (10000 * MS_PER_YEAR));
    if (interest <= 0) {
      return position;
    }

    const updated: SavingsInvestmentPosition = {
      ...position,
      accruedInterest: position.accruedInterest + interest,
      lastAccruedAt: now,
      updatedAt: now,
    };
    await this.positionRepository.save(updated);
    this.logger.info('Accrued investment interest', { userId: position.userId, interest });
    return updated;
  }

  private buildSummary(
    savingsBalance: number,
    savingsAvailable: number,
    preference: SavingsInvestmentPreference,
    position: SavingsInvestmentPosition,
  ): SavingsInvestmentSummary {
    const projectedMonthlyYield = Math.floor((position.investedAmount * this.annualYieldBps) / (10000 * 12));
    const totalValue = savingsBalance + position.investedAmount + position.accruedInterest;
    return {
      autoInvestEnabled: preference.autoInvestEnabled,
      targetAllocationPct: preference.targetAllocationPct,
      productCode: position.productCode ?? DEFAULT_PRODUCT_CODE,
      productName: DEFAULT_PRODUCT_NAME,
      annualYieldBps: this.annualYieldBps,
      investedAmount: position.investedAmount,
      accruedInterest: position.accruedInterest,
      projectedMonthlyYield,
      savingsCashBalance: savingsBalance,
      savingsAvailableBalance: savingsAvailable,
      totalValue,
      lastAccruedAt: position.lastAccruedAt,
    };
  }

  private async requireSavingsWallet(userId: UUID) {
    const wallet = await this.walletService.getWallet(userId, 'savings');
    if (!wallet) {
      throw new Error('Savings wallet not found');
    }
    return wallet;
  }
}
