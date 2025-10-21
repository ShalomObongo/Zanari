/**
 * WalletService manages balance operations and ensures financial integrity.
 */

import { UUID } from '../models/base';
import { Wallet, WalletType, validateWallet } from '../models/Wallet';
import { Clock, Logger, NullLogger, SystemClock, WalletRepository } from './types';

export interface CreditOptions {
  userId: UUID;
  walletType: WalletType;
  amount: number;
}

export interface DebitOptions {
  userId: UUID;
  walletType: WalletType;
  amount: number;
}

export class WalletService {
  private readonly walletRepository: WalletRepository;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    walletRepository: WalletRepository;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.walletRepository = options.walletRepository;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async getWallet(userId: UUID, walletType: WalletType): Promise<Wallet | null> {
    return this.walletRepository.findByUserAndType(userId, walletType);
  }

  async listWallets(userId: UUID): Promise<Wallet[]> {
    return this.walletRepository.listByUser(userId);
  }

  async requireWalletById(userId: UUID, walletId: UUID): Promise<Wallet> {
    const wallet = await this.walletRepository.findById(walletId);
    if (!wallet || wallet.userId !== userId) {
      throw new Error('Wallet not found');
    }
    return wallet;
  }

  async credit(options: CreditOptions): Promise<Wallet> {
    const wallet = await this.requireWallet(options.userId, options.walletType);
    const now = this.clock.now();

    wallet.balance += options.amount;
    wallet.availableBalance += options.amount;
    wallet.lastTransactionAt = now;
    wallet.updatedAt = now;
    validateWallet(wallet);

    const saved = await this.walletRepository.save(wallet);
    this.logger.info('Wallet credited', {
      userId: options.userId,
      walletType: options.walletType,
      amount: options.amount,
      newBalance: wallet.balance,
    });
    return saved;
  }

  async debit(options: DebitOptions): Promise<Wallet> {
    const wallet = await this.requireWallet(options.userId, options.walletType);
    if (wallet.availableBalance < options.amount) {
      throw new Error('Insufficient funds');
    }

    const now = this.clock.now();
    wallet.balance -= options.amount;
    wallet.availableBalance -= options.amount;
    wallet.lastTransactionAt = now;
    wallet.updatedAt = now;
    validateWallet(wallet);

    const saved = await this.walletRepository.save(wallet);
    this.logger.info('Wallet debited', {
      userId: options.userId,
      walletType: options.walletType,
      amount: options.amount,
      newBalance: wallet.balance,
    });
    return saved;
  }

  async transferRoundUp(userId: UUID, roundUpAmount: number): Promise<{ mainWallet: Wallet; savingsWallet: Wallet }> {
    if (!Number.isInteger(roundUpAmount) || roundUpAmount <= 0) {
      throw new Error('Round-up amount must be positive integer (cents)');
    }

    const mainWallet = await this.requireWallet(userId, 'main');
    if (mainWallet.availableBalance < roundUpAmount) {
      throw new Error('Insufficient funds for round-up');
    }

    const savingsWallet = await this.requireWallet(userId, 'savings');
    const now = this.clock.now();

    mainWallet.balance -= roundUpAmount;
    mainWallet.availableBalance -= roundUpAmount;
    mainWallet.lastTransactionAt = now;
    mainWallet.updatedAt = now;

    savingsWallet.balance += roundUpAmount;
    savingsWallet.availableBalance += roundUpAmount;
    savingsWallet.lastTransactionAt = now;
    savingsWallet.updatedAt = now;

    validateWallet(mainWallet);
    validateWallet(savingsWallet);

    const [updatedMain, updatedSavings] = await Promise.all([
      this.walletRepository.save(mainWallet),
      this.walletRepository.save(savingsWallet),
    ]);

    this.logger.info('Round-up transfer completed', {
      userId,
      roundUpAmount,
      mainBalance: updatedMain.balance,
      savingsBalance: updatedSavings.balance,
    });

    return { mainWallet: updatedMain, savingsWallet: updatedSavings };
  }

  private async requireWallet(userId: UUID, walletType: WalletType): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserAndType(userId, walletType);
    if (!wallet) {
      throw new Error(`Wallet not found for type ${walletType}`);
    }
    return wallet;
  }
}
