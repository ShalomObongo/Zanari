import { randomUUID } from 'node:crypto';

import { SavingsInvestmentPreference, createDefaultPreference } from '../models/SavingsInvestmentPreference';
import { SavingsInvestmentPosition, createSavingsInvestmentPosition } from '../models/SavingsInvestmentPosition';
import { WalletService } from './WalletService';
import { TransactionService } from './TransactionService';
import {
  Clock,
  Logger,
  NullLogger,
  SavingsInvestmentPreferenceRepository,
  SavingsInvestmentPositionRepository,
  InvestmentProductRepository,
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
  transactionService: TransactionService;
  preferenceRepository: SavingsInvestmentPreferenceRepository;
  positionRepository: SavingsInvestmentPositionRepository;
  productRepository: InvestmentProductRepository;
  logger?: Logger;
  clock?: Clock;
  minInvestmentAmount?: number;
}

export class SavingsInvestmentService {
  private readonly walletService: WalletService;
  private readonly transactionService: TransactionService;
  private readonly preferenceRepository: SavingsInvestmentPreferenceRepository;
  private readonly positionRepository: SavingsInvestmentPositionRepository;
  private readonly productRepository: InvestmentProductRepository;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly minInvestmentAmount: number;

  constructor(options: SavingsInvestmentServiceOptions) {
    this.walletService = options.walletService;
    this.transactionService = options.transactionService;
    this.preferenceRepository = options.preferenceRepository;
    this.positionRepository = options.positionRepository;
    this.productRepository = options.productRepository;
    this.logger = options.logger ?? NullLogger;
    this.clock = options.clock ?? new SystemClock();
    this.minInvestmentAmount = options.minInvestmentAmount ?? 500; // cents (KES 5)
  }

  async getSummary(userId: UUID): Promise<SavingsInvestmentSummary> {
    const wallet = await this.requireSavingsWallet(userId);
    const preference = await this.preferenceRepository.getOrCreateDefault(userId);
    const position = await this.ensurePosition(userId);
    const accruedPosition = await this.accrueInterest(position);
    const product = await this.productRepository.findByCode(accruedPosition.productCode);
    
    return this.buildSummary(
      wallet.balance, 
      wallet.availableBalance, 
      preference, 
      accruedPosition,
      product?.annualYieldBps ?? 0,
      product?.name ?? DEFAULT_PRODUCT_NAME
    );
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

    await this.transactionService.create({
      id: randomUUID(),
      userId,
      type: 'investment_allocation',
      amount,
      category: 'investment',
      description: 'Allocation to Zanari Yield Pool',
      status: 'completed',
      skipLimits: true,
    });

    const position = await this.ensurePosition(userId);
    // Accrue interest before changing principal
    const accruedPosition = await this.accrueInterest(position);
    
    const updatedPosition: SavingsInvestmentPosition = {
      ...accruedPosition,
      investedAmount: accruedPosition.investedAmount + amount,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);
    this.logger.info('Allocated savings to investment', { userId, amount });
    return this.getSummary(userId);
  }

  async redeem(userId: UUID, amount: number): Promise<SavingsInvestmentSummary> {
    this.assertPositiveAmount(amount);
    const position = await this.ensurePosition(userId);
    // Accrue interest before changing principal
    const accruedPosition = await this.accrueInterest(position);

    if (accruedPosition.investedAmount < amount) {
      throw new Error('Requested amount exceeds invested balance');
    }

    const updatedPosition: SavingsInvestmentPosition = {
      ...accruedPosition,
      investedAmount: accruedPosition.investedAmount - amount,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);

    await this.walletService.credit({ userId, walletType: 'savings', amount });

    await this.transactionService.create({
      id: randomUUID(),
      userId,
      type: 'investment_redemption',
      amount,
      category: 'investment',
      description: 'Redemption from Zanari Yield Pool',
      status: 'completed',
      skipLimits: true,
    });

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

    if (refreshed.accruedInterest < 1) { // Less than 1 cent
      return this.getSummary(userId);
    }

    const payout = Math.floor(refreshed.accruedInterest);
    const remaining = refreshed.accruedInterest - payout;
    
    const updatedPosition: SavingsInvestmentPosition = {
      ...refreshed,
      accruedInterest: remaining,
      updatedAt: this.clock.now(),
    };
    await this.positionRepository.save(updatedPosition);
    await this.walletService.credit({ userId, walletType: 'savings', amount: payout });

    await this.transactionService.create({
      id: randomUUID(),
      userId,
      type: 'interest_payout',
      amount: payout,
      category: 'investment',
      description: 'Interest Payout from Zanari Yield Pool',
      status: 'completed',
      skipLimits: true,
    });

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

    const product = await this.productRepository.findByCode(position.productCode);
    const annualYieldBps = product?.annualYieldBps ?? 0;

    // High precision calculation: (Principal * Rate * Time) / Constants
    // Rate is in BPS (1/10000), Time is in ms
    const interest = (position.investedAmount * annualYieldBps * elapsedMs) / (10000 * MS_PER_YEAR);
    
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
    annualYieldBps: number,
    productName: string
  ): SavingsInvestmentSummary {
    const projectedMonthlyYield = Math.floor((position.investedAmount * annualYieldBps) / (10000 * 12));
    const totalValue = savingsBalance + position.investedAmount + position.accruedInterest;
    return {
      autoInvestEnabled: preference.autoInvestEnabled,
      targetAllocationPct: preference.targetAllocationPct,
      productCode: position.productCode ?? DEFAULT_PRODUCT_CODE,
      productName: productName,
      annualYieldBps: annualYieldBps,
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
