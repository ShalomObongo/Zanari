/**
 * PaymentService orchestrates merchant payments, Paystack integration, and round-up savings.
 */

import { randomUUID } from 'node:crypto';

import { UUID } from '../models/base';
import { RoundUpRule } from '../models/RoundUpRule';
import { Transaction } from '../models/Transaction';
import { Wallet } from '../models/Wallet';
import {
  Clock,
  Logger,
  NullLogger,
  PaystackClient,
  RetryQueue,
  RoundUpRuleRepository,
  SystemClock,
  TransactionRepository,
} from './types';
import { TransactionService } from './TransactionService';
import { WalletService } from './WalletService';

export interface MerchantPaymentRequest {
  paymentId: UUID;
  userId: UUID;
  amount: number; // cents
  merchantInfo: {
    name: string;
    tillNumber?: string | null;
    paybillNumber?: string | null;
    accountNumber?: string | null;
  };
  description?: string | null;
  pinToken: string;
  customerEmail: string;
  customerPhone?: string | null;
  channels?: string[];
  currency?: string;
  callbackUrl?: string | null;
}

export interface MerchantPaymentResult {
  status: 'success' | 'pending' | 'failed';
  paymentTransaction: Transaction;
  roundUpTransaction?: Transaction | null;
  totalCharged: number;
  roundUpAmount: number;
  scheduledRetry?: { runAt: Date; retryCount: number };
  checkoutSession?: {
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    status: 'success' | 'pending';
    expiresAt?: Date;
  } | null;
}

export interface PeerTransferRequest {
  transferId: UUID;
  userId: UUID;
  amount: number;
  recipient: {
    phone?: string | null;
    email?: string | null;
    name?: string | null;
  };
  description?: string | null;
  pinToken: string;
  currency?: string;
  reason?: string | null;
}

export interface PeerTransferResult {
  status: 'success' | 'pending' | 'failed';
  transferTransaction: Transaction;
  roundUpTransaction?: Transaction | null;
  totalCharged: number;
  roundUpAmount: number;
  paystackTransferReference?: string;
  paystackRecipientCode?: string;
  estimatedCompletion?: Date;
  scheduledRetry?: { runAt: Date; retryCount: number };
  recipientCreated?: boolean;
}

const RETRY_BACKOFF_MS = [1000, 2000, 4000];

export class PaymentService {
  private readonly transactionService: TransactionService;
  private readonly transactionRepository: TransactionRepository;
  private readonly walletService: WalletService;
  private readonly paystackClient: PaystackClient;
  private readonly roundUpRuleRepository: RoundUpRuleRepository;
  private readonly retryQueue: RetryQueue;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    transactionService: TransactionService;
    transactionRepository: TransactionRepository;
    walletService: WalletService;
    paystackClient: PaystackClient;
    roundUpRuleRepository: RoundUpRuleRepository;
    retryQueue: RetryQueue;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.transactionService = options.transactionService;
    this.transactionRepository = options.transactionRepository;
    this.walletService = options.walletService;
    this.paystackClient = options.paystackClient;
    this.roundUpRuleRepository = options.roundUpRuleRepository;
    this.retryQueue = options.retryQueue;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async payMerchant(request: MerchantPaymentRequest): Promise<MerchantPaymentResult> {
    const currency = request.currency ?? 'KES';
    const roundUpRule = await this.roundUpRuleRepository.findByUserId(request.userId);
    let { roundUpAmount, incrementUsed } = this.calculateRoundUp(request.amount, roundUpRule);

    const mainWallet = await this.requireMainWallet(request.userId);
    if (mainWallet.availableBalance < request.amount + roundUpAmount) {
      if (mainWallet.availableBalance >= request.amount) {
        this.logger.warn('Skipping round-up due to insufficient funds', {
          userId: request.userId,
          requestedRoundUp: roundUpAmount,
          availableBalance: mainWallet.availableBalance,
        });
        roundUpAmount = 0;
        incrementUsed = '0';
      } else {
        throw new Error('Insufficient funds');
      }
    }

    const paystackSession = await this.paystackClient.initializeTransaction({
      email: request.customerEmail,
      amount: request.amount,
      currency,
      reference: request.paymentId,
      callbackUrl: request.callbackUrl ?? undefined,
      metadata: {
        userId: request.userId,
        merchant: request.merchantInfo,
        description: request.description,
        roundUpAmount,
        customerPhone: request.customerPhone,
      },
      channels: request.channels,
    });

    await this.walletService.debit({ userId: request.userId, walletType: 'main', amount: request.amount });

    let paymentRecord: Transaction | null = null;
    let roundUpTransaction: Transaction | null = null;

    try {
      if (roundUpAmount > 0) {
        await this.walletService.transferRoundUp(request.userId, roundUpAmount);
      }

      const paymentTransaction = await this.transactionService.create({
        id: request.paymentId,
        userId: request.userId,
        type: 'payment',
        amount: request.amount,
        category: 'groceries',
        autoCategorized: false,
        metadata: {
          description: request.description ?? `Payment to ${request.merchantInfo.name}`,
          merchantInfo: {
            name: request.merchantInfo.name,
            tillNumber: request.merchantInfo.tillNumber ?? null,
            paybillNumber: request.merchantInfo.paybillNumber ?? null,
            accountNumber: request.merchantInfo.accountNumber ?? null,
          },
        } as Partial<Transaction>,
      });

      paymentRecord = paymentTransaction;

      if (roundUpAmount > 0) {
        roundUpTransaction = await this.transactionService.create({
          id: randomUUID(),
          userId: request.userId,
          type: 'round_up',
          amount: roundUpAmount,
          category: 'savings',
          autoCategorized: true,
          metadata: {
            description: `Round-up savings for ${request.merchantInfo.name}`,
            roundUpDetails: {
              originalAmount: request.amount,
              roundUpAmount,
              roundUpRule: incrementUsed,
              relatedTransactionId: paymentTransaction.id,
            },
          } as Partial<Transaction>,
        });

        paymentRecord = await this.transactionRepository.update({
          ...paymentTransaction,
          roundUpDetails: {
            originalAmount: request.amount,
            roundUpAmount,
            roundUpRule: incrementUsed,
            relatedTransactionId: roundUpTransaction.id,
          },
          updatedAt: this.clock.now(),
        });
      }

      paymentRecord = await this.transactionRepository.update({
        ...paymentRecord,
        externalReference: paystackSession.reference,
        externalTransactionId: paystackSession.accessCode,
        paymentMethod: this.resolvePaymentMethod(request.channels),
        updatedAt: this.clock.now(),
      });

      return {
        status: 'pending',
        paymentTransaction: paymentRecord,
        roundUpTransaction,
        totalCharged: request.amount + roundUpAmount,
        roundUpAmount,
        checkoutSession: {
          authorizationUrl: paystackSession.authorizationUrl,
          accessCode: paystackSession.accessCode,
          reference: paystackSession.reference,
          status: paystackSession.status,
          expiresAt: paystackSession.expiresAt,
        },
        scheduledRetry: undefined,
      };
    } catch (error) {
      await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: request.amount });
      if (roundUpAmount > 0) {
        await this.walletService.debit({ userId: request.userId, walletType: 'savings', amount: roundUpAmount });
        await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: roundUpAmount });
      }

      if (paymentRecord) {
        const failedRecord = await this.transactionService.markStatus(paymentRecord, 'failed');
        const scheduledRetry = await this.scheduleRetry(failedRecord);
        return {
          status: 'failed',
          paymentTransaction: failedRecord,
          roundUpTransaction: null,
          totalCharged: request.amount,
          roundUpAmount: 0,
          scheduledRetry: scheduledRetry ?? undefined,
          checkoutSession: null,
        };
      }

      throw error;
    }
  }

  async initializeDeposit(request: {
    depositId: UUID;
    userId: UUID;
    amount: number; // cents
    description?: string | null;
    customerEmail: string;
    customerPhone?: string | null;
    channels?: string[];
    currency?: string;
    callbackUrl?: string | null;
  }): Promise<{
    status: 'pending' | 'failed';
    depositTransaction: Transaction;
    checkoutSession: {
      authorizationUrl: string;
      accessCode: string;
      reference: string;
      status: 'success' | 'pending';
      expiresAt?: Date;
    } | null;
  }> {
    const currency = request.currency ?? 'KES';

    // For deposits (top-ups), we DO NOT check wallet balance or perform any wallet debits here.
    // We only initialize a Paystack checkout session and record a pending 'deposit' transaction.
    const paystackSession = await this.paystackClient.initializeTransaction({
      email: request.customerEmail,
      amount: request.amount,
      currency,
      reference: request.depositId,
      callbackUrl: request.callbackUrl ?? undefined,
      metadata: {
        userId: request.userId,
        description: request.description ?? 'Wallet top-up',
        customerPhone: request.customerPhone,
      },
      channels: request.channels,
    });

    let depositRecord: Transaction | null = null;

    try {
      const depositTransaction = await this.transactionService.create({
        id: request.depositId,
        userId: request.userId,
        type: 'deposit',
        amount: request.amount,
        category: 'savings',
        autoCategorized: false,
        metadata: {
          description: request.description ?? 'Wallet top-up',
        } as Partial<Transaction>,
      });

      depositRecord = await this.transactionRepository.update({
        ...depositTransaction,
        externalReference: paystackSession.reference,
        externalTransactionId: paystackSession.accessCode,
        paymentMethod: this.resolvePaymentMethod(request.channels),
        updatedAt: this.clock.now(),
      });

      return {
        status: 'pending',
        depositTransaction: depositRecord,
        checkoutSession: {
          authorizationUrl: paystackSession.authorizationUrl,
          accessCode: paystackSession.accessCode,
          reference: paystackSession.reference,
          status: paystackSession.status,
          expiresAt: paystackSession.expiresAt,
        },
      };
    } catch (error) {
      if (depositRecord) {
        const failedRecord = await this.transactionService.markStatus(depositRecord, 'failed');
        return {
          status: 'failed',
          depositTransaction: failedRecord,
          checkoutSession: null,
        };
      }
      throw error;
    }
  }

  async transferPeer(request: PeerTransferRequest): Promise<PeerTransferResult> {
    const currency = request.currency ?? 'KES';
    const roundUpRule = await this.roundUpRuleRepository.findByUserId(request.userId);
    let { roundUpAmount, incrementUsed } = this.calculateRoundUp(request.amount, roundUpRule);

    const mainWallet = await this.requireMainWallet(request.userId);
    if (mainWallet.availableBalance < request.amount + roundUpAmount) {
      if (mainWallet.availableBalance >= request.amount) {
        this.logger.warn('Skipping round-up for transfer due to insufficient funds', {
          userId: request.userId,
          requestedRoundUp: roundUpAmount,
          availableBalance: mainWallet.availableBalance,
        });
        roundUpAmount = 0;
        incrementUsed = '0';
      } else {
        throw new Error('Insufficient funds');
      }
    }

    const recipientCode = await this.createPaystackRecipient(request);

    await this.walletService.debit({ userId: request.userId, walletType: 'main', amount: request.amount });

    let transferRecord: Transaction | null = null;
    let roundUpTransaction: Transaction | null = null;

    try {
      if (roundUpAmount > 0) {
        await this.walletService.transferRoundUp(request.userId, roundUpAmount);
      }

      const transferTransaction = await this.transactionService.create({
        id: request.transferId,
        userId: request.userId,
        type: 'transfer_out',
        amount: request.amount,
        category: 'transfer',
        autoCategorized: false,
        metadata: {
          description: request.description ?? 'Peer transfer',
          recipient: {
            phone: request.recipient.phone ?? null,
            email: request.recipient.email ?? null,
            name: request.recipient.name ?? null,
          },
        } as Partial<Transaction>,
      });

      transferRecord = transferTransaction;

      if (roundUpAmount > 0) {
        roundUpTransaction = await this.transactionService.create({
          id: randomUUID(),
          userId: request.userId,
          type: 'round_up',
          amount: roundUpAmount,
          category: 'savings',
          autoCategorized: true,
          metadata: {
            description: 'Round-up savings for transfer',
            roundUpDetails: {
              originalAmount: request.amount,
              roundUpAmount,
              roundUpRule: incrementUsed,
              relatedTransactionId: transferTransaction.id,
            },
          } as Partial<Transaction>,
        });

        transferRecord = await this.transactionRepository.update({
          ...transferTransaction,
          roundUpDetails: {
            originalAmount: request.amount,
            roundUpAmount,
            roundUpRule: incrementUsed,
            relatedTransactionId: roundUpTransaction.id,
          },
          updatedAt: this.clock.now(),
        });
      }

      const paystackTransfer = await this.paystackClient.initiateTransfer({
        amount: request.amount,
        recipient: recipientCode.recipientCode,
        reference: request.transferId,
        reason: request.reason ?? request.description ?? 'Peer transfer',
        currency,
      });

      transferRecord = await this.transactionRepository.update({
        ...transferRecord,
        externalReference: paystackTransfer.reference,
        externalTransactionId: paystackTransfer.transferCode,
        updatedAt: this.clock.now(),
      });

      const transferStatus = paystackTransfer.status === 'failed' ? 'failed' : 'pending';
      let scheduledRetryInfo: { runAt: Date; retryCount: number } | null = null;

      if (transferStatus === 'failed') {
        transferRecord = await this.transactionService.markStatus(transferRecord, 'failed');
        if (roundUpTransaction) {
          roundUpTransaction = await this.transactionService.markStatus(roundUpTransaction, 'failed');
        }

        scheduledRetryInfo = await this.scheduleRetry(transferRecord);

        await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: request.amount });
        if (roundUpAmount > 0) {
          await this.walletService.debit({ userId: request.userId, walletType: 'savings', amount: roundUpAmount });
          await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: roundUpAmount });
        }
      }

      return {
        status: transferStatus,
        transferTransaction: transferRecord,
        roundUpTransaction,
        totalCharged: request.amount + roundUpAmount,
        roundUpAmount,
        paystackTransferReference: paystackTransfer.transferCode,
        paystackRecipientCode: recipientCode.recipientCode,
        estimatedCompletion: undefined,
        scheduledRetry: scheduledRetryInfo ?? undefined,
        recipientCreated: recipientCode.created,
      };
    } catch (error) {
      await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: request.amount });
      if (roundUpAmount > 0) {
        await this.walletService.debit({ userId: request.userId, walletType: 'savings', amount: roundUpAmount });
        await this.walletService.credit({ userId: request.userId, walletType: 'main', amount: roundUpAmount });
      }

      if (transferRecord) {
        const failedRecord = await this.transactionService.markStatus(transferRecord, 'failed');
        const scheduledRetry = await this.scheduleRetry(failedRecord);
        return {
          status: 'failed',
          transferTransaction: failedRecord,
          roundUpTransaction: null,
          totalCharged: request.amount,
          roundUpAmount: 0,
          paystackTransferReference: undefined,
          paystackRecipientCode: recipientCode.recipientCode,
          estimatedCompletion: undefined,
          scheduledRetry: scheduledRetry ?? undefined,
          recipientCreated: recipientCode.created,
        };
      }

      throw error;
    }
  }

  private calculateRoundUp(amount: number, rule: RoundUpRule | null): { roundUpAmount: number; incrementUsed: string } {
    if (!rule || !rule.isEnabled) {
      return { roundUpAmount: 0, incrementUsed: 'disabled' };
    }

    let increment = parseInt(rule.incrementType, 10);
    if (Number.isNaN(increment) || rule.incrementType === 'auto') {
      increment = rule.autoSettings?.maxIncrement ?? rule.autoSettings?.minIncrement ?? 10;
    }

    const roundUpAmount = Math.ceil(amount / increment) * increment - amount;
    if (roundUpAmount === 0) {
      return { roundUpAmount: 0, incrementUsed: increment.toString() };
    }

    return { roundUpAmount, incrementUsed: increment.toString() };
  }

  private async requireMainWallet(userId: UUID): Promise<Wallet> {
    const wallet = await this.walletService.getWallet(userId, 'main');
    if (!wallet) {
      throw new Error('Main wallet not found');
    }
    return wallet;
  }

  private async scheduleRetry(transaction: Transaction): Promise<{ runAt: Date; retryCount: number } | null> {
    const currentCount = transaction.retry.retryCount;
    if (currentCount >= RETRY_BACKOFF_MS.length) {
      this.logger.warn('Retry limit reached for transaction', { transactionId: transaction.id });
      return null;
    }

    const delayMs = RETRY_BACKOFF_MS[currentCount];
    if (delayMs === undefined) {
      this.logger.warn('Retry backoff missing for transaction', { transactionId: transaction.id, currentCount });
      return null;
    }
    const runAt = new Date(this.clock.now().getTime() + delayMs);

    const updated: Transaction = {
      ...transaction,
      retry: {
        retryCount: currentCount + 1,
        lastRetryAt: this.clock.now(),
        nextRetryAt: runAt,
      },
      updatedAt: this.clock.now(),
    };

    await this.transactionRepository.update(updated);
    await this.retryQueue.enqueue({
      id: `retry_${transaction.id}_${currentCount + 1}`,
      runAt,
      payload: {
        transactionId: transaction.id,
        userId: transaction.userId,
      },
    });

    this.logger.info('Scheduled payment retry', {
      transactionId: transaction.id,
      retryCount: currentCount + 1,
      runAt: runAt.toISOString(),
    });

    return { runAt, retryCount: currentCount + 1 };
  }

  private async createPaystackRecipient(request: PeerTransferRequest): Promise<{ recipientCode: string; created: boolean }> {
    const phone = request.recipient.phone ?? undefined;
    const email = request.recipient.email ?? undefined;
    const name = request.recipient.name ?? phone ?? email ?? 'Recipient';
    const currency = request.currency ?? 'KES';

    const accountNumber = phone ? this.normalizePhone(phone) : this.deriveVirtualAccountNumber(request.transferId, email);
  const bankCode = phone ? 'MPESA' : '999999';
    const type: 'mobile_money' | 'nuban' = phone ? 'mobile_money' : 'nuban';

    const response = await this.paystackClient.createTransferRecipient({
      type,
      name,
      accountNumber,
      bankCode,
      currency,
      metadata: {
        phone,
        email,
      },
    });

    return { recipientCode: response.recipientCode, created: true };
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');

    if (digits.length === 0) {
      throw new Error('Recipient phone number is required for mobile money transfers');
    }

    if (digits.length === 9 && digits.startsWith('7')) {
      return `0${digits}`;
    }

    if (digits.length === 12 && digits.startsWith('254')) {
      return `0${digits.slice(3)}`;
    }

    if (digits.length === 13 && digits.startsWith('2540')) {
      return digits.slice(3);
    }

    if (digits.length === 10 && digits.startsWith('0')) {
      return digits;
    }

    if (digits.length === 10 && digits.startsWith('7')) {
      return `0${digits.slice(1)}`;
    }

    if (digits.length > 10) {
      return `0${digits.slice(-9)}`;
    }

    return digits.startsWith('0') ? digits : `0${digits}`;
  }

  private deriveVirtualAccountNumber(reference: UUID, email?: string): string {
    const numericSeed = `${reference.replace(/[^0-9]/g, '')}${email ? this.simpleHash(email) : ''}`;
    const padded = (numericSeed || '0').padEnd(10, '0');
    return padded.slice(0, 10);
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return `${hash}`;
  }

  private resolvePaymentMethod(channels?: string[] | null): Transaction['paymentMethod'] {
    if (!channels || channels.length === 0) {
      return null;
    }

    if (channels.includes('mobile_money')) {
      return 'mpesa';
    }

    if (channels.includes('card')) {
      return 'card';
    }

    return null;
  }
}
