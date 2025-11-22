import { randomUUID } from 'node:crypto';

import { createUser, User } from '../models/User';
import { createWallet, Wallet } from '../models/Wallet';
import { createRoundUpRule, RoundUpRule } from '../models/RoundUpRule';
import { createSavingsGoal, SavingsGoal } from '../models/SavingsGoal';
import { createKYCDocument, KYCDocument } from '../models/KYCDocument';
import { createAuthSession, AuthSession } from '../models/AuthSession';
import { Transaction } from '../models/Transaction';
import { UUID } from '../models/base';
import { createDefaultPreference, SavingsInvestmentPreference } from '../models/SavingsInvestmentPreference';
import { createSavingsInvestmentPosition, SavingsInvestmentPosition } from '../models/SavingsInvestmentPosition';
import { InvestmentProduct } from '../models/InvestmentProduct';
import { AuthService } from '../services/AuthService';
import { WalletService } from '../services/WalletService';
import { TransactionService } from '../services/TransactionService';
import { PaymentService } from '../services/PaymentService';
import { SavingsGoalService } from '../services/SavingsGoalService';
import { AutoAnalyzeService } from '../services/AutoAnalyzeService';
import { CategorizationService } from '../services/CategorizationService';
import { KYCService } from '../services/KYCService';
import { ConsoleNotificationService } from '../services/ConsoleNotificationService';
import { ConsoleOtpSender } from '../services/ConsoleOtpSender';
import { SmtpOtpSender } from '../services/SmtpOtpSender';
import { RandomTokenService } from '../services/RandomTokenService';
import { CryptoPinHasher } from '../services/CryptoPinHasher';
import { InMemoryRateLimiter } from '../services/InMemoryRateLimiter';
import { ConsoleLogger } from '../services/ConsoleLogger';
import { RegistrationService } from '../services/RegistrationService';
import { InMemoryIdentityProvider } from '../services/IdentityProvider';
import {
  AuthSessionRepository,
  IdentityProvider,
  InvestmentProductRepository,
  KYCDocumentRepository,
  Logger,
  NotificationService,
  OtpSender,
  PaystackClient,
  PinHasher,
  PinTokenService,
  RateLimiter,
  RetryQueue,
  RoundUpRuleRepository,
  SavingsGoalRepository,
  SavingsInvestmentPositionRepository,
  SavingsInvestmentPreferenceRepository,
  TokenService,
  TransactionRepository,
  UserRepository,
  WalletRepository,
} from '../services/types';
import { createAuthRoutes } from '../routes/auth';
import { createWalletRoutes } from '../routes/wallets';
import { createPaymentRoutes } from '../routes/payments';
import { createUserRoutes } from '../routes/users';
import { createSavingsGoalRoutes } from '../routes/savings-goals';
import { createRoundUpRuleRoutes } from '../routes/round-up-rules';
import { createKYCRoutes } from '../routes/kyc';
import { createTransactionRoutes } from '../routes/transactions';
import { createWebhookRoutes } from '../routes/webhooks';
import { SavingsInvestmentService } from '../services/SavingsInvestmentService';
import { createSavingsInvestmentRoutes } from '../routes/savings-investments';

interface CloneOptions<T> {
  transform?: (value: T) => T;
}

const cloneDate = (value?: Date | null): Date | null => (value ? new Date(value.getTime()) : null);

function cloneUser(user: User): User {
  return {
    ...user,
    createdAt: cloneDate(user.createdAt)!,
    updatedAt: cloneDate(user.updatedAt)!,
    dateOfBirth: cloneDate(user.dateOfBirth),
    kycSubmittedAt: cloneDate(user.kycSubmittedAt),
    kycApprovedAt: cloneDate(user.kycApprovedAt),
    pinSetAt: cloneDate(user.pinSetAt),
    lastFailedAttemptAt: cloneDate(user.lastFailedAttemptAt),
    notificationPreferences: { ...user.notificationPreferences },
  };
}

function cloneWallet(wallet: Wallet): Wallet {
  return {
    ...wallet,
    createdAt: cloneDate(wallet.createdAt)!,
    updatedAt: cloneDate(wallet.updatedAt)!,
    lastTransactionAt: cloneDate(wallet.lastTransactionAt),
    withdrawalRestrictions: wallet.withdrawalRestrictions
      ? {
          ...wallet.withdrawalRestrictions,
          lockedUntil: cloneDate(wallet.withdrawalRestrictions.lockedUntil ?? null),
        }
      : null,
  };
}

function cloneTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    createdAt: cloneDate(transaction.createdAt)!,
    updatedAt: cloneDate(transaction.updatedAt)!,
    completedAt: cloneDate(transaction.completedAt),
    merchantInfo: transaction.merchantInfo ? { ...transaction.merchantInfo } : null,
    roundUpDetails: transaction.roundUpDetails ? { ...transaction.roundUpDetails } : null,
    retry: { ...transaction.retry },
  };
}

function cloneGoal(goal: SavingsGoal): SavingsGoal {
  return {
    ...goal,
    createdAt: cloneDate(goal.createdAt)!,
    updatedAt: cloneDate(goal.updatedAt)!,
    completedAt: cloneDate(goal.completedAt),
    targetDate: cloneDate(goal.targetDate),
    milestones: goal.milestones.map((milestone) => ({ ...milestone, reachedAt: cloneDate(milestone.reachedAt) })),
  };
}

function cloneRule(rule: RoundUpRule): RoundUpRule {
  return {
    ...rule,
    createdAt: cloneDate(rule.createdAt)!,
    updatedAt: cloneDate(rule.updatedAt)!,
    lastUsedAt: cloneDate(rule.lastUsedAt),
    autoSettings: rule.autoSettings
      ? {
          ...rule.autoSettings,
          lastAnalysisAt: cloneDate(rule.autoSettings.lastAnalysisAt),
        }
      : null,
  };
}

function clonePreference(preference: SavingsInvestmentPreference): SavingsInvestmentPreference {
  return {
    ...preference,
    createdAt: cloneDate(preference.createdAt)!,
    updatedAt: cloneDate(preference.updatedAt)!,
  };
}

function clonePosition(position: SavingsInvestmentPosition): SavingsInvestmentPosition {
  return {
    ...position,
    createdAt: cloneDate(position.createdAt)!,
    updatedAt: cloneDate(position.updatedAt)!,
    lastAccruedAt: cloneDate(position.lastAccruedAt),
  };
}

function cloneDocument(document: KYCDocument): KYCDocument {
  return {
    ...document,
    createdAt: cloneDate(document.createdAt)!,
    updatedAt: cloneDate(document.updatedAt)!,
    uploadedAt: cloneDate(document.uploadedAt)!,
    processedAt: cloneDate(document.processedAt),
    expiresAt: cloneDate(document.expiresAt),
    extractedData: document.extractedData ? { ...document.extractedData } : null,
  };
}

function cloneSession(session: AuthSession): AuthSession {
  return {
    ...session,
    createdAt: cloneDate(session.createdAt)!,
    updatedAt: cloneDate(session.updatedAt)!,
    expiresAt: cloneDate(session.expiresAt)!,
    verifiedAt: cloneDate(session.verifiedAt),
  };
}

function cloneProduct(product: InvestmentProduct): InvestmentProduct {
  return {
    ...product,
    createdAt: cloneDate(product.createdAt)!,
    updatedAt: cloneDate(product.updatedAt)!,
  };
}

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<UUID, User>();

  constructor(initialUsers: User[] = []) {
    initialUsers.forEach((user) => {
      this.users.set(user.id, cloneUser(user));
    });
  }

  async create(user: User): Promise<User> {
    const copy = cloneUser(user);
    this.users.set(copy.id, copy);
    return cloneUser(copy);
  }

  async findById(userId: UUID): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? cloneUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) {
        return cloneUser(user);
      }
    }
    return null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.phone && user.phone === phone) {
        return cloneUser(user);
      }
    }
    return null;
  }

  async update(userId: UUID, update: Partial<User>): Promise<User> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error('User not found');
    }
    const merged: User = cloneUser({ ...existing, ...update, updatedAt: update.updatedAt ?? new Date() });
    this.users.set(userId, cloneUser(merged));
    return cloneUser(merged);
  }

  upsert(user: User): void {
    this.users.set(user.id, cloneUser(user));
  }
}

class InMemoryWalletRepository implements WalletRepository {
  private readonly wallets = new Map<UUID, Wallet>();

  constructor(initialWallets: Wallet[] = []) {
    initialWallets.forEach((wallet) => {
      this.wallets.set(wallet.id, cloneWallet(wallet));
    });
  }

  async findById(walletId: UUID): Promise<Wallet | null> {
    const wallet = this.wallets.get(walletId);
    return wallet ? cloneWallet(wallet) : null;
  }

  async findByUserAndType(userId: UUID, walletType: Wallet['walletType']): Promise<Wallet | null> {
    for (const wallet of this.wallets.values()) {
      if (wallet.userId === userId && wallet.walletType === walletType) {
        return cloneWallet(wallet);
      }
    }
    return null;
  }

  async listByUser(userId: UUID): Promise<Wallet[]> {
    return [...this.wallets.values()].filter((wallet) => wallet.userId === userId).map(cloneWallet);
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const copy = cloneWallet(wallet);
    this.wallets.set(copy.id, copy);
    return cloneWallet(copy);
  }

  upsert(wallet: Wallet): void {
    this.wallets.set(wallet.id, cloneWallet(wallet));
  }
}

class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<UUID, Transaction>();

  async create(transaction: Transaction): Promise<Transaction> {
    const copy = cloneTransaction(transaction);
    this.transactions.set(copy.id, copy);
    return cloneTransaction(copy);
  }

  async update(transaction: Transaction): Promise<Transaction> {
    const copy = cloneTransaction(transaction);
    this.transactions.set(copy.id, copy);
    return cloneTransaction(copy);
  }

  async sumUserTransactionsForDay(userId: UUID, dayStart: Date): Promise<number> {
    let sum = 0;
    for (const transaction of this.transactions.values()) {
      if (transaction.userId === userId && transaction.createdAt >= dayStart) {
        sum += transaction.amount;
      }
    }
    return sum;
  }

  async listRecentTransactions(userId: UUID, since: Date): Promise<Transaction[]> {
    return [...this.transactions.values()]
      .filter((transaction) => transaction.userId === userId && transaction.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(cloneTransaction);
  }

  async listByUser(
    userId: UUID,
    options: { limit: number; offset: number; type?: Transaction['type']; category?: Transaction['category'] },
  ): Promise<Transaction[]> {
    const filtered = [...this.transactions.values()].filter((transaction) => {
      if (transaction.userId !== userId) return false;
      if (options.type && transaction.type !== options.type) return false;
      if (options.category && transaction.category !== options.category) return false;
      return true;
    });
    const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const slice = sorted.slice(options.offset, options.offset + options.limit);
    return slice.map(cloneTransaction);
  }

  async countByUser(
    userId: UUID,
    options: { type?: Transaction['type']; category?: Transaction['category'] },
  ): Promise<number> {
    return [...this.transactions.values()].filter((transaction) => {
      if (transaction.userId !== userId) return false;
      if (options.type && transaction.type !== options.type) return false;
      if (options.category && transaction.category !== options.category) return false;
      return true;
    }).length;
  }

  async findById(transactionId: UUID): Promise<Transaction | null> {
    const transaction = this.transactions.get(transactionId);
    return transaction ? cloneTransaction(transaction) : null;
  }

  async findByExternalReference(reference: string): Promise<Transaction | null> {
    for (const transaction of this.transactions.values()) {
      if (transaction.externalReference === reference) {
        return cloneTransaction(transaction);
      }
    }
    return null;
  }
}

class InMemorySavingsGoalRepository implements SavingsGoalRepository {
  private readonly goals = new Map<UUID, SavingsGoal>();

  constructor(initialGoals: SavingsGoal[] = []) {
    initialGoals.forEach((goal) => this.goals.set(goal.id, cloneGoal(goal)));
  }

  async listByUser(userId: UUID): Promise<SavingsGoal[]> {
    return [...this.goals.values()].filter((goal) => goal.userId === userId).map(cloneGoal);
  }

  async findActiveByUser(userId: UUID): Promise<SavingsGoal[]> {
    return [...this.goals.values()]
      .filter((goal) => goal.userId === userId && goal.status === 'active')
      .map(cloneGoal);
  }

  async findById(goalId: UUID): Promise<SavingsGoal | null> {
    const goal = this.goals.get(goalId);
    return goal ? cloneGoal(goal) : null;
  }

  async save(goal: SavingsGoal): Promise<SavingsGoal> {
    const copy = cloneGoal(goal);
    this.goals.set(copy.id, copy);
    return cloneGoal(copy);
  }

  async delete(goalId: UUID): Promise<void> {
    this.goals.delete(goalId);
  }
}

class InMemorySavingsInvestmentPreferenceRepository implements SavingsInvestmentPreferenceRepository {
  private readonly store = new Map<UUID, SavingsInvestmentPreference>();

  constructor(initial: SavingsInvestmentPreference[] = []) {
    initial.forEach((pref) => {
      this.store.set(pref.userId, clonePreference(pref));
    });
  }

  async findByUserId(userId: UUID): Promise<SavingsInvestmentPreference | null> {
    const preference = this.store.get(userId);
    return preference ? clonePreference(preference) : null;
  }

  async save(preference: SavingsInvestmentPreference): Promise<SavingsInvestmentPreference> {
    const copy = clonePreference(preference);
    this.store.set(copy.userId, copy);
    return clonePreference(copy);
  }

  async getOrCreateDefault(userId: UUID): Promise<SavingsInvestmentPreference> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }
    const created = createDefaultPreference(userId);
    await this.save(created);
    return created;
  }
}

class InMemorySavingsInvestmentPositionRepository implements SavingsInvestmentPositionRepository {
  private readonly store = new Map<UUID, SavingsInvestmentPosition>();

  constructor(initial: SavingsInvestmentPosition[] = []) {
    initial.forEach((position) => {
      this.store.set(position.userId, clonePosition(position));
    });
  }

  async findByUserId(userId: UUID): Promise<SavingsInvestmentPosition | null> {
    const position = this.store.get(userId);
    return position ? clonePosition(position) : null;
  }

  async save(position: SavingsInvestmentPosition): Promise<SavingsInvestmentPosition> {
    const copy = clonePosition(position);
    this.store.set(copy.userId, copy);
    return clonePosition(copy);
  }

  async findAllUserIds(): Promise<UUID[]> {
    return Array.from(this.store.keys());
  }
}

class InMemoryRoundUpRuleRepository implements RoundUpRuleRepository {
  private readonly rules = new Map<UUID, RoundUpRule>();

  constructor(initialRules: RoundUpRule[] = []) {
    initialRules.forEach((rule) => this.rules.set(rule.userId, cloneRule(rule)));
  }

  async findByUserId(userId: UUID): Promise<RoundUpRule | null> {
    const rule = this.rules.get(userId);
    return rule ? cloneRule(rule) : null;
  }

  async save(rule: RoundUpRule): Promise<RoundUpRule> {
    const copy = cloneRule(rule);
    this.rules.set(copy.userId, copy);
    return cloneRule(copy);
  }
}

class InMemoryKYCDocumentRepository implements KYCDocumentRepository {
  private readonly documents = new Map<UUID, KYCDocument>();

  constructor(initialDocuments: KYCDocument[] = []) {
    initialDocuments.forEach((document) => this.documents.set(document.id, cloneDocument(document)));
  }

  async create(document: KYCDocument): Promise<KYCDocument> {
    const copy = cloneDocument(document);
    this.documents.set(copy.id, copy);
    return cloneDocument(copy);
  }

  async update(document: KYCDocument): Promise<KYCDocument> {
    const copy = cloneDocument(document);
    this.documents.set(copy.id, copy);
    return cloneDocument(copy);
  }

  async findByUserAndType(userId: UUID, type: KYCDocument['documentType']): Promise<KYCDocument | null> {
    for (const document of this.documents.values()) {
      if (document.userId === userId && document.documentType === type) {
        return cloneDocument(document);
      }
    }
    return null;
  }

  async findById(documentId: UUID): Promise<KYCDocument | null> {
    const document = this.documents.get(documentId);
    return document ? cloneDocument(document) : null;
  }

  async listByUser(userId: UUID): Promise<KYCDocument[]> {
    return [...this.documents.values()].filter((document) => document.userId === userId).map(cloneDocument);
  }
}

class InMemoryAuthSessionRepository implements AuthSessionRepository {
  private readonly sessions = new Map<string, AuthSession>();

  async create(session: AuthSession): Promise<AuthSession> {
    const copy = cloneSession(session);
    this.sessions.set(copy.id, copy);
    return cloneSession(copy);
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? cloneSession(session) : null;
  }

  async save(session: AuthSession): Promise<AuthSession> {
    const copy = cloneSession(session);
    this.sessions.set(copy.id, copy);
    return cloneSession(copy);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class InMemoryPinTokenService implements PinTokenService {
  private readonly tokens = new Map<string, { userId: UUID; expiresAt: Date }>();

  async issue(userId: UUID, token: string, ttlSeconds: number): Promise<void> {
    this.tokens.set(token, { userId, expiresAt: new Date(Date.now() + ttlSeconds * 1000) });
  }

  async validate(userId: UUID, token: string): Promise<boolean> {
    const record = this.tokens.get(token);
    if (!record) return false;
    if (record.userId !== userId) return false;
    if (record.expiresAt.getTime() < Date.now()) return false;
    return true;
  }

  async invalidate(token: string): Promise<void> {
    this.tokens.delete(token);
  }
}

class InMemoryRetryQueue implements RetryQueue {
  private readonly jobs: Array<{ id: string; runAt: Date; payload: Record<string, unknown> }> = [];

  async enqueue(job: { id: string; runAt: Date; payload: Record<string, unknown> }): Promise<void> {
    this.jobs.push({ ...job, runAt: new Date(job.runAt.getTime()) });
  }

  list(): Array<{ id: string; runAt: Date; payload: Record<string, unknown> }> {
    return this.jobs.map((job) => ({ ...job, runAt: new Date(job.runAt.getTime()), payload: { ...job.payload } }));
  }
}

export class InMemoryPaystackClient implements PaystackClient {
  async initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callbackUrl?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    channels?: string[] | undefined;
  }): Promise<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    status: 'success' | 'pending';
    expiresAt?: Date | undefined;
    raw: Record<string, unknown>;
  }> {
    return {
      authorizationUrl: `https://checkout.paystack.com/${payload.reference}`,
      accessCode: `access_${payload.reference}`,
      reference: payload.reference,
      status: 'success',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      raw: {
        ...payload,
        status: 'success',
      },
    };
  }

  async verifyTransaction(reference: string): Promise<{
    status: 'success' | 'failed' | 'abandoned';
    amount: number;
    currency: string;
    paidAt?: Date | undefined;
    channel?: string | null | undefined;
    fees?: number | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    raw: Record<string, unknown>;
  }> {
    return {
      status: 'success',
      amount: 0,
      currency: 'KES',
      paidAt: new Date(),
      channel: 'mobile_money',
      fees: 0,
      metadata: { reference },
      raw: { reference },
    };
  }

  async createTransferRecipient(payload: {
    type: 'mobile_money' | 'nuban';
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
    metadata?: Record<string, unknown> | undefined;
  }): Promise<{
    recipientCode: string;
    raw: Record<string, unknown>;
  }> {
    const recipientCode = `rcp_${payload.accountNumber}_${Date.now()}`;
    return {
      recipientCode,
      raw: { recipient_code: recipientCode, ...payload },
    };
  }

  async initiateTransfer(payload: {
    amount: number;
    recipient: string;
    reference: string;
    reason?: string | undefined;
    currency: string;
    source?: 'balance' | undefined;
  }): Promise<{
    status: 'success' | 'pending' | 'failed';
    transferCode: string;
    reference: string;
    raw: Record<string, unknown>;
  }> {
    return {
      status: 'success',
      transferCode: `trf_${payload.reference}`,
      reference: payload.reference,
      raw: { ...payload, status: 'success' },
    };
  }

  async verifyTransfer(reference: string): Promise<{
    status: 'success' | 'failed' | 'pending' | 'reversed';
    transferCode: string;
    raw: Record<string, unknown>;
  }> {
    return {
      status: 'success',
      transferCode: `trf_${reference}`,
      raw: { reference },
    };
  }
}

class InMemoryInvestmentProductRepository implements InvestmentProductRepository {
  private readonly products = new Map<string, InvestmentProduct>();

  constructor(initialProducts: InvestmentProduct[] = []) {
    initialProducts.forEach((product) => {
      this.products.set(product.code, cloneProduct(product));
    });
  }

  async findByCode(code: string): Promise<InvestmentProduct | null> {
    const product = this.products.get(code);
    return product ? cloneProduct(product) : null;
  }

  async findAllActive(): Promise<InvestmentProduct[]> {
    return [...this.products.values()]
      .filter((p) => p.isActive)
      .map(cloneProduct);
  }
}

interface InMemoryContainerOptions {
  logger: Logger;
}

export function createInMemoryAppContainer({ logger }: InMemoryContainerOptions) {
  const notificationService: NotificationService = new ConsoleNotificationService();
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpFrom = process.env.SMTP_FROM ?? 'no-reply@zanari.app';

  const otpSender: OtpSender = smtpHost && smtpUser && smtpPass
    ? new SmtpOtpSender({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass,
        fromAddress: smtpFrom,
      })
    : new ConsoleOtpSender();
  const tokenService: TokenService = new RandomTokenService();
  const pinHasher: PinHasher = new CryptoPinHasher();
  const pinTokenService: PinTokenService = new InMemoryPinTokenService();
  const rateLimiter: RateLimiter = new InMemoryRateLimiter();
  const retryQueue: RetryQueue = new InMemoryRetryQueue();
  const paystackClient: PaystackClient = new InMemoryPaystackClient();
  const identityProvider: IdentityProvider = new InMemoryIdentityProvider();

  const demoUserId = randomUUID();
  const demoUser = createUser({
    id: demoUserId,
    email: 'sarah.test@zanari.app',
    phone: '254712345678',
    firstName: 'Sarah',
    lastName: 'Mutindi',
  });

  const mainWallet = createWallet({
    id: randomUUID(),
    userId: demoUserId,
    walletType: 'main',
    balance: 250_000,
    availableBalance: 250_000,
  });

  const savingsWallet = createWallet({
    id: randomUUID(),
    userId: demoUserId,
    walletType: 'savings',
    balance: 75_000,
    availableBalance: 75_000,
    withdrawalRestrictions: {
      minSettlementDelayMinutes: 5,
      lockedUntil: null,
    },
  });

  const roundUpRule = createRoundUpRule({
    id: randomUUID(),
    userId: demoUserId,
    incrementType: '10',
    isEnabled: true,
  });

  const defaultProduct: InvestmentProduct = {
    id: randomUUID(),
    code: 'default_savings_pool',
    name: 'Zanari Yield Pool',
    annualYieldBps: 1200,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userRepository = new InMemoryUserRepository([demoUser]);
  const walletRepository = new InMemoryWalletRepository([mainWallet, savingsWallet]);
  const transactionRepository = new InMemoryTransactionRepository();
  const savingsGoalRepository = new InMemorySavingsGoalRepository();
  const roundUpRuleRepository = new InMemoryRoundUpRuleRepository([roundUpRule]);
  const kycDocumentRepository = new InMemoryKYCDocumentRepository();
  const authSessionRepository = new InMemoryAuthSessionRepository();
  const savingsInvestmentPreferenceRepository = new InMemorySavingsInvestmentPreferenceRepository();
  const savingsInvestmentPositionRepository = new InMemorySavingsInvestmentPositionRepository();
  const investmentProductRepository = new InMemoryInvestmentProductRepository([defaultProduct]);

  const authService = new AuthService({
    userRepository,
    authSessionRepository,
    otpSender,
    tokenService,
    pinHasher,
    pinTokenService,
    rateLimiter,
    logger,
  });

  const registrationService = new RegistrationService({
    userRepository,
    identityProvider,
    authService,
  });

  const walletService = new WalletService({ walletRepository, logger });
  const transactionService = new TransactionService({ transactionRepository, logger });
  const paymentService = new PaymentService({
    transactionService,
    transactionRepository,
    walletService,
    paystackClient,
    roundUpRuleRepository,
    retryQueue,
    logger,
  });
  const savingsGoalService = new SavingsGoalService({ repository: savingsGoalRepository, notificationService, logger });
  const savingsInvestmentService = new SavingsInvestmentService({
    walletService,
    transactionService,
    preferenceRepository: savingsInvestmentPreferenceRepository,
    positionRepository: savingsInvestmentPositionRepository,
    productRepository: investmentProductRepository,
    logger,
  });
  const autoAnalyzeService = new AutoAnalyzeService({ transactionRepository, roundUpRuleRepository, logger });
  const categorizationService = new CategorizationService({ transactionRepository, logger });
  const kycService = new KYCService({ repository: kycDocumentRepository, notificationService, logger });

  const authRoutes = createAuthRoutes({ authService, registrationService });
  const userRoutes = createUserRoutes({ userRepository, logger });
  const walletRoutes = createWalletRoutes({
    walletService,
    transactionService,
    authService,
    savingsInvestmentService,
    logger,
  });
  const paymentRoutes = createPaymentRoutes({
    paymentService,
    authService,
    walletService,
    userRepository,
    transactionRepository,
    roundUpRuleRepository,
    logger,
  });
  const savingsRoutes = createSavingsGoalRoutes({ savingsGoalService, walletService, logger });
  const savingsInvestmentRoutes = createSavingsInvestmentRoutes({ savingsInvestmentService, logger });
  const roundUpRoutes = createRoundUpRuleRoutes({
    roundUpRuleRepository,
    transactionRepository,
    autoAnalyzeService,
    logger,
  });
  const kycRoutes = createKYCRoutes({ kycService, logger });
  const transactionRoutes = createTransactionRoutes({
    transactionService,
    categorizationService,
    transactionRepository,
    logger,
  });
  const webhookRoutes = createWebhookRoutes({ logger });

  return {
    seedUser: {
      email: demoUser.email,
      phone: demoUser.phone,
    },
    repositories: {
      userRepository,
      walletRepository,
      transactionRepository,
      savingsGoalRepository,
      roundUpRuleRepository,
      kycDocumentRepository,
      authSessionRepository,
      savingsInvestmentPreferenceRepository,
      savingsInvestmentPositionRepository,
      investmentProductRepository,
    },
    services: {
      authService,
      registrationService,
      walletService,
      transactionService,
      paymentService,
      savingsGoalService,
      autoAnalyzeService,
      categorizationService,
      kycService,
      savingsInvestmentService,
    },
    routes: {
      auth: authRoutes,
      users: userRoutes,
      wallets: walletRoutes,
      payments: paymentRoutes,
      savings: savingsRoutes,
      investments: savingsInvestmentRoutes,
      roundUp: roundUpRoutes,
      kyc: kycRoutes,
      transactions: transactionRoutes,
      webhooks: webhookRoutes,
    },
  };
}

export function logInMemoryStartup(logger: Logger | ConsoleLogger) {
  logger.info('Launching Zanari API in in-memory mode. Supabase credentials not configured.');
  logger.info('Seed user: email="sarah.test@zanari.app" phone="254712345678" (request OTP via /auth/login).');
}
