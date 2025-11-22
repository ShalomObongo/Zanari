/**
 * Shared service interfaces and abstractions decoupling domain logic from infrastructure.
 */

import { AuthSession } from '../models/AuthSession';
import { User } from '../models/User';
import { Wallet, WalletType } from '../models/Wallet';
import { Transaction, TransactionCategory, TransactionType } from '../models/Transaction';
import { SavingsGoal } from '../models/SavingsGoal';
import { SavingsInvestmentPreference } from '../models/SavingsInvestmentPreference';
import { SavingsInvestmentPosition } from '../models/SavingsInvestmentPosition';
import { InvestmentProduct } from '../models/InvestmentProduct';
import { RoundUpRule } from '../models/RoundUpRule';
import { KYCDocument, KYCDocumentType } from '../models/KYCDocument';
import { UUID } from '../models/base';

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(userId: UUID): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  update(userId: UUID, update: Partial<User>): Promise<User>;
}

export interface IdentityProvider {
  createIdentity(input: { email: string; phone?: string | null }): Promise<{ id: UUID }>;
}

export interface WalletRepository {
  findById(walletId: UUID): Promise<Wallet | null>;
  findByUserAndType(userId: UUID, walletType: WalletType): Promise<Wallet | null>;
  listByUser(userId: UUID): Promise<Wallet[]>;
  save(wallet: Wallet): Promise<Wallet>;
}

export interface TransactionRepository {
  create(transaction: Transaction): Promise<Transaction>;
  update(transaction: Transaction): Promise<Transaction>;
  sumUserTransactionsForDay(userId: UUID, dayStart: Date): Promise<number>;
  listRecentTransactions(userId: UUID, since: Date): Promise<Transaction[]>;
  listByUser(
    userId: UUID,
    options: {
      limit: number;
      offset: number;
      type?: TransactionType;
      category?: TransactionCategory;
    },
  ): Promise<Transaction[]>;
  countByUser(
    userId: UUID,
    options: { type?: TransactionType; category?: TransactionCategory },
  ): Promise<number>;
  findById(transactionId: UUID): Promise<Transaction | null>;
  findByExternalReference(reference: string): Promise<Transaction | null>;
}

export interface SavingsGoalRepository {
  listByUser(userId: UUID): Promise<SavingsGoal[]>;
  findActiveByUser(userId: UUID): Promise<SavingsGoal[]>;
  findById(goalId: UUID): Promise<SavingsGoal | null>;
  save(goal: SavingsGoal): Promise<SavingsGoal>;
  delete(goalId: UUID): Promise<void>;
}

export interface SavingsInvestmentPreferenceRepository {
  findByUserId(userId: UUID): Promise<SavingsInvestmentPreference | null>;
  save(preference: SavingsInvestmentPreference): Promise<SavingsInvestmentPreference>;
  getOrCreateDefault(userId: UUID): Promise<SavingsInvestmentPreference>;
}

export interface SavingsInvestmentPositionRepository {
  findByUserId(userId: UUID): Promise<SavingsInvestmentPosition | null>;
  findAllUserIds(): Promise<UUID[]>;
  save(position: SavingsInvestmentPosition): Promise<SavingsInvestmentPosition>;
}

export interface InvestmentProductRepository {
  findByCode(code: string): Promise<InvestmentProduct | null>;
  findAllActive(): Promise<InvestmentProduct[]>;
}

export interface RoundUpRuleRepository {
  findByUserId(userId: UUID): Promise<RoundUpRule | null>;
  save(rule: RoundUpRule): Promise<RoundUpRule>;
}

export interface KYCDocumentRepository {
  create(document: KYCDocument): Promise<KYCDocument>;
  update(document: KYCDocument): Promise<KYCDocument>;
  findByUserAndType(userId: UUID, type: KYCDocumentType): Promise<KYCDocument | null>;
  findById(documentId: UUID): Promise<KYCDocument | null>;
  listByUser(userId: UUID): Promise<KYCDocument[]>;
}

export interface NotificationService {
  notifyUser(userId: UUID, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void>;
}

export interface AuthSessionRepository {
  create(session: AuthSession): Promise<AuthSession>;
  findById(sessionId: string): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<AuthSession>;
  delete(sessionId: string): Promise<void>;
}

export interface OtpSender {
  sendEmailOtp(email: string, otpCode: string): Promise<void>;
  sendSmsOtp(phone: string, otpCode: string): Promise<void>;
}

export interface TokenService {
  issueAccessToken(user: User): Promise<string>;
  issueRefreshToken(user: User): Promise<string>;
  revokeRefreshToken(refreshToken: string): Promise<void>;
}

export interface PinTokenService {
  issue(userId: UUID, token: string, ttlSeconds: number): Promise<void>;
  validate(userId: UUID, token: string): Promise<boolean>;
  invalidate(token: string): Promise<void>;
}

export interface RateLimiter {
  consume(
    key: string,
    options?: {
      points?: number;
      durationSeconds?: number;
    },
  ): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

export interface PaystackClient {
  initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    channels?: string[];
  }): Promise<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    status: 'success' | 'pending';
    expiresAt?: Date;
    raw: Record<string, unknown>;
  }>;

  verifyTransaction(reference: string): Promise<{
    status: 'success' | 'failed' | 'abandoned';
    amount: number;
    currency: string;
    paidAt?: Date;
    channel?: string | null;
    fees?: number | null;
    metadata?: Record<string, unknown>;
    raw: Record<string, unknown>;
  }>;

  createTransferRecipient(payload: {
    type: 'mobile_money' | 'nuban';
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    recipientCode: string;
    raw: Record<string, unknown>;
  }>;

  initiateTransfer(payload: {
    amount: number;
    recipient: string;
    reference: string;
    reason?: string;
    currency: string;
    source?: 'balance';
  }): Promise<{
    status: 'success' | 'pending' | 'failed';
    transferCode: string;
    reference: string;
    raw: Record<string, unknown>;
  }>;

  verifyTransfer(reference: string): Promise<{
    status: 'success' | 'failed' | 'pending' | 'reversed';
    transferCode: string;
    raw: Record<string, unknown>;
  }>;
}

export interface CategorizationRule {
  merchantName?: string;
  keywords?: string[];
  category: TransactionCategory;
}

export interface TransactionClassificationInput {
  amount: number;
  merchantName?: string | null;
  description?: string | null;
  type: TransactionType;
}

export interface TransactionClassifier {
  classify(input: TransactionClassificationInput): TransactionCategory;
}

export interface RetryQueue {
  enqueue(job: {
    id: string;
    runAt: Date;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface PinHasher {
  hash(pin: string): Promise<string>;
  compare(pin: string, hash: string): Promise<boolean>;
}

export const NullLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
