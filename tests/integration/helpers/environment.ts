import { randomUUID, createHash } from 'node:crypto';
import { AuthService } from '../../../api/src/services/AuthService';
import { WalletService } from '../../../api/src/services/WalletService';
import { TransactionService } from '../../../api/src/services/TransactionService';
import { PaymentService } from '../../../api/src/services/PaymentService';
import { SavingsGoalService } from '../../../api/src/services/SavingsGoalService';
import { AutoAnalyzeService } from '../../../api/src/services/AutoAnalyzeService';
import { CategorizationService } from '../../../api/src/services/CategorizationService';
import { KYCService } from '../../../api/src/services/KYCService';
import { createUser, User } from '../../../api/src/models/User';
import { createWallet, Wallet } from '../../../api/src/models/Wallet';
import { createRoundUpRule, RoundUpRule } from '../../../api/src/models/RoundUpRule';
import { createSavingsGoal, SavingsGoal } from '../../../api/src/models/SavingsGoal';
import { createKYCDocument, KYCDocument } from '../../../api/src/models/KYCDocument';
import { AuthSession } from '../../../api/src/models/AuthSession';
import { Transaction } from '../../../api/src/models/Transaction';
import { UUID } from '../../../api/src/models/base';
import { createDefaultPreference, SavingsInvestmentPreference } from '../../../api/src/models/SavingsInvestmentPreference';
import { createSavingsInvestmentPosition, SavingsInvestmentPosition } from '../../../api/src/models/SavingsInvestmentPosition';
import {
  AuthSessionRepository,
  CategorizationRule,
  NotificationService,
  OtpSender,
  PaystackClient,
  PinHasher,
  PinTokenService,
  RateLimiter,
  RetryQueue,
  SavingsGoalRepository,
  RoundUpRuleRepository,
  KYCDocumentRepository,
  SavingsInvestmentPreferenceRepository,
  SavingsInvestmentPositionRepository,
  TokenService,
  TransactionClassificationInput,
  TransactionRepository,
  UserRepository,
  WalletRepository,
  IdentityProvider,
} from '../../../api/src/services/types';
import { RegistrationService } from '../../../api/src/services/RegistrationService';
import { InMemoryIdentityProvider } from '../../../api/src/services/IdentityProvider';
import { SavingsInvestmentService } from '../../../api/src/services/SavingsInvestmentService';

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
      ? { ...wallet.withdrawalRestrictions, lockedUntil: cloneDate(wallet.withdrawalRestrictions.lockedUntil) }
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

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<UUID, User>();

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
    for (const user of this.users.values()) {
      if (user.email === email.toLowerCase()) {
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

  list(): User[] {
    return [...this.users.values()].map(cloneUser);
  }
}

class InMemoryWalletRepository implements WalletRepository {
  private readonly wallets = new Map<UUID, Wallet>();

  async insert(wallet: Wallet): Promise<Wallet> {
    const copy = cloneWallet(wallet);
    this.wallets.set(copy.id, copy);
    return cloneWallet(copy);
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

  async save(goal: SavingsGoal): Promise<SavingsGoal> {
    const copy = cloneGoal(goal);
    this.goals.set(copy.id, copy);
    return cloneGoal(copy);
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

  async delete(goalId: UUID): Promise<void> {
    this.goals.delete(goalId);
  }
}

class InMemoryRoundUpRuleRepository implements RoundUpRuleRepository {
  private readonly rules = new Map<UUID, RoundUpRule>();

  async save(rule: RoundUpRule): Promise<RoundUpRule> {
    const copy = cloneRule(rule);
    this.rules.set(copy.userId, copy);
    return cloneRule(copy);
  }

  async findByUserId(userId: UUID): Promise<RoundUpRule | null> {
    const rule = this.rules.get(userId);
    return rule ? cloneRule(rule) : null;
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
}

class InMemoryKYCDocumentRepository implements KYCDocumentRepository {
  private readonly documents = new Map<UUID, KYCDocument>();

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
    const copy = { ...session, createdAt: cloneDate(session.createdAt)!, updatedAt: cloneDate(session.updatedAt)! };
    this.sessions.set(copy.id, copy);
    return { ...copy, createdAt: cloneDate(copy.createdAt)!, updatedAt: cloneDate(copy.updatedAt)! };
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session, createdAt: cloneDate(session.createdAt)!, updatedAt: cloneDate(session.updatedAt)! } : null;
  }

  async save(session: AuthSession): Promise<AuthSession> {
    const copy = { ...session, createdAt: cloneDate(session.createdAt)!, updatedAt: cloneDate(session.updatedAt)! };
    this.sessions.set(copy.id, copy);
    return { ...copy, createdAt: cloneDate(copy.createdAt)!, updatedAt: cloneDate(copy.updatedAt)! };
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class TestOtpSender implements OtpSender {
  public lastEmailOtp: { email: string; otp: string } | null = null;
  public lastSmsOtp: { phone: string; otp: string } | null = null;

  async sendEmailOtp(email: string, otpCode: string): Promise<void> {
    this.lastEmailOtp = { email, otp: otpCode };
  }

  async sendSmsOtp(phone: string, otpCode: string): Promise<void> {
    this.lastSmsOtp = { phone, otp: otpCode };
  }
}

class TestTokenService implements TokenService {
  async issueAccessToken(user: User): Promise<string> {
    return `access-${user.id}-${Date.now()}`;
  }

  async issueRefreshToken(user: User): Promise<string> {
    return `refresh-${user.id}-${Date.now()}`;
  }

  async revokeRefreshToken(): Promise<void> {
    // noop
  }
}

class TestPinHasher implements PinHasher {
  async hash(pin: string): Promise<string> {
    return createHash('sha256').update(`test-salt-${pin}`).digest('hex');
  }

  async compare(pin: string, hash: string): Promise<boolean> {
    const expected = await this.hash(pin);
    return hash === expected;
  }
}

interface PinTokenRecord {
  userId: UUID;
  expiresAt: Date;
}

class TestPinTokenService implements PinTokenService {
  private readonly tokens = new Map<string, PinTokenRecord>();

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

class AllowAllRateLimiter implements RateLimiter {
  async consume(): Promise<{ allowed: boolean; retryAfterSeconds?: number | undefined }> {
    return { allowed: true };
  }
}

interface TestPaystackChargeRequest {
  amount: number;
  reference: string;
  metadata: Record<string, unknown>;
  currency: string;
  email: string;
}

interface TestPaystackTransferRequest {
  amount: number;
  reference: string;
  recipient: { phone?: string; email?: string };
  currency: string;
}

class TestPaystackClient implements PaystackClient {
  public charges: TestPaystackChargeRequest[] = [];
  public transfers: TestPaystackTransferRequest[] = [];
  public recipients: Array<{
    name: string;
    accountNumber: string;
    bankCode: string;
    type: 'mobile_money' | 'nuban';
    currency: string;
    phone?: string;
    email?: string;
  }> = [];
  private recipientDirectory = new Map<string, { phone?: string; email?: string; name?: string }>();

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
    this.charges.push({
      amount: payload.amount,
      reference: payload.reference,
      metadata: payload.metadata ?? {},
      currency: payload.currency,
      email: payload.email,
    });

    return {
      authorizationUrl: `https://checkout.paystack.com/${payload.reference}`,
      accessCode: `AC_${payload.reference}`,
      reference: payload.reference,
      status: 'success',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      raw: {
        authorization_url: `https://checkout.paystack.com/${payload.reference}`,
        access_code: `AC_${payload.reference}`,
        reference: payload.reference,
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
    const charge = this.charges.find((item) => item.reference === reference);
    return {
      status: 'success',
      amount: charge?.amount ?? 0,
      currency: charge?.currency ?? 'KES',
      paidAt: new Date(),
      channel: 'mobile_money',
      fees: 0,
      metadata: charge?.metadata,
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
    const phone = typeof payload.metadata?.phone === 'string' ? payload.metadata.phone : undefined;
    const email = typeof payload.metadata?.email === 'string' ? payload.metadata.email : undefined;

    const recipientCode = `RCP_${payload.accountNumber ?? payload.name}`;

    this.recipients.push({
      name: payload.name,
      accountNumber: payload.accountNumber,
      bankCode: payload.bankCode,
      type: payload.type,
      currency: payload.currency,
      phone,
      email,
    });

    this.recipientDirectory.set(recipientCode, {
      phone,
      email,
      name: payload.name,
    });

    return {
      recipientCode,
      raw: { recipient_code: recipientCode },
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
    const recipientDetails = this.recipientDirectory.get(payload.recipient) ?? {};

    this.transfers.push({
      amount: payload.amount,
      reference: payload.reference,
      recipient: {
        phone: recipientDetails.phone,
        email: recipientDetails.email,
      },
      currency: payload.currency,
    });

    return {
      status: 'success',
      transferCode: `TRF_${payload.reference}`,
      reference: payload.reference,
      raw: {
        transfer_code: `TRF_${payload.reference}`,
        reference: payload.reference,
      },
    };
  }

  async verifyTransfer(reference: string): Promise<{
    status: 'success' | 'failed' | 'pending' | 'reversed';
    transferCode: string;
    raw: Record<string, unknown>;
  }> {
    return {
      status: 'success',
      transferCode: `TRF_${reference}`,
      raw: { reference },
    };
  }
}

interface NotificationRecord {
  userId: UUID;
  payload: Parameters<NotificationService['notifyUser']>[1];
}

class TestNotificationService implements NotificationService {
  public notifications: NotificationRecord[] = [];

  async notifyUser(userId: UUID, payload: { title: string; body: string; data?: Record<string, unknown> | undefined }): Promise<void> {
    this.notifications.push({ userId, payload });
  }
}

interface RetryJob {
  id: string;
  runAt: Date;
  payload: Record<string, unknown>;
}

class TestRetryQueue implements RetryQueue {
  public jobs: RetryJob[] = [];

  async enqueue(job: RetryJob): Promise<void> {
    this.jobs.push({ ...job, runAt: new Date(job.runAt.getTime()) });
  }
}

export interface IntegrationTestEnvironment {
  user: User;
  mainWallet: Wallet;
  savingsWallet: Wallet;
  roundUpRule: RoundUpRule;
  repositories: {
    userRepository: InMemoryUserRepository;
    walletRepository: InMemoryWalletRepository;
    transactionRepository: InMemoryTransactionRepository;
    savingsGoalRepository: InMemorySavingsGoalRepository;
    roundUpRuleRepository: InMemoryRoundUpRuleRepository;
    kycDocumentRepository: InMemoryKYCDocumentRepository;
    authSessionRepository: InMemoryAuthSessionRepository;
    savingsInvestmentPreferenceRepository: InMemorySavingsInvestmentPreferenceRepository;
    savingsInvestmentPositionRepository: InMemorySavingsInvestmentPositionRepository;
  };
  services: {
    authService: AuthService;
    registrationService: RegistrationService;
    walletService: WalletService;
    transactionService: TransactionService;
    paymentService: PaymentService;
    savingsGoalService: SavingsGoalService;
    autoAnalyzeService: AutoAnalyzeService;
    categorizationService: CategorizationService;
    kycService: KYCService;
    savingsInvestmentService: SavingsInvestmentService;
  };
  stubs: {
    otpSender: TestOtpSender;
    tokenService: TestTokenService;
    pinHasher: TestPinHasher;
    pinTokenService: TestPinTokenService;
    rateLimiter: AllowAllRateLimiter;
    paystackClient: TestPaystackClient;
    notificationService: TestNotificationService;
    retryQueue: TestRetryQueue;
  };
  helpers: {
    refreshUser(): Promise<User>;
    refreshWallet(type: Wallet['walletType']): Promise<Wallet>;
    refreshTransactions(): Promise<Transaction[]>;
    ensurePin(pin?: string): Promise<void>;
    issuePinToken(pin?: string): Promise<string>;
    topUpMainWallet(amount: number): Promise<void>;
    topUpSavingsWallet(amount: number): Promise<void>;
    setRoundUpIncrement(increment: RoundUpRule['incrementType']): Promise<void>;
    createSavingsGoal(input: { name: string; targetAmount: number; targetDate?: Date | null; lockIn?: boolean }): Promise<SavingsGoal>;
    contributeToGoal(goalId: UUID, amount: number): Promise<void>;
    approveKyc(documentId: UUID, notes?: string): Promise<KYCDocument>;
    listNotifications(): NotificationRecord[];
  };
}

const DEFAULT_USER_EMAIL = 'sarah.test@zanari.app';
const DEFAULT_USER_PHONE = '254712345678';

export async function createIntegrationTestEnvironment(): Promise<IntegrationTestEnvironment> {
  const userRepository = new InMemoryUserRepository();
  const walletRepository = new InMemoryWalletRepository();
  const transactionRepository = new InMemoryTransactionRepository();
  const savingsGoalRepository = new InMemorySavingsGoalRepository();
  const roundUpRuleRepository = new InMemoryRoundUpRuleRepository();
  const kycDocumentRepository = new InMemoryKYCDocumentRepository();
  const authSessionRepository = new InMemoryAuthSessionRepository();
  const savingsInvestmentPreferenceRepository = new InMemorySavingsInvestmentPreferenceRepository();
  const savingsInvestmentPositionRepository = new InMemorySavingsInvestmentPositionRepository();

  const otpSender = new TestOtpSender();
  const tokenService = new TestTokenService();
  const pinHasher = new TestPinHasher();
  const pinTokenService = new TestPinTokenService();
  const rateLimiter = new AllowAllRateLimiter();
  const paystackClient = new TestPaystackClient();
  const notificationService = new TestNotificationService();
  const retryQueue = new TestRetryQueue();

  const authService = new AuthService({
    userRepository,
    authSessionRepository,
    otpSender,
    tokenService,
    pinHasher,
    pinTokenService,
    rateLimiter,
  });

  const identityProvider: IdentityProvider = new InMemoryIdentityProvider();
  const registrationService = new RegistrationService({
    userRepository,
    identityProvider,
    authService,
  });

  const walletService = new WalletService({ walletRepository });
  const transactionService = new TransactionService({ transactionRepository });
  const paymentService = new PaymentService({
    transactionService,
    transactionRepository,
    walletService,
    paystackClient,
    roundUpRuleRepository,
    retryQueue,
  });
  const savingsGoalService = new SavingsGoalService({ repository: savingsGoalRepository, notificationService });
  const autoAnalyzeService = new AutoAnalyzeService({ transactionRepository, roundUpRuleRepository });
  const categorizationService = new CategorizationService({ transactionRepository });
  const kycService = new KYCService({ repository: kycDocumentRepository, notificationService });
  const savingsInvestmentService = new SavingsInvestmentService({
    walletService,
    transactionService,
    preferenceRepository: savingsInvestmentPreferenceRepository,
    positionRepository: savingsInvestmentPositionRepository,
  });

  const userId = randomUUID();
  const baseUser = createUser({
    id: userId,
    email: DEFAULT_USER_EMAIL,
    phone: DEFAULT_USER_PHONE,
    firstName: 'Sarah',
    lastName: 'Mutindi',
  });
  await userRepository.create(baseUser);

  const mainWallet = createWallet({ id: randomUUID(), userId, walletType: 'main', balance: 0, availableBalance: 0 });
  const savingsWallet = createWallet({
    id: randomUUID(),
    userId,
    walletType: 'savings',
    balance: 0,
    availableBalance: 0,
    withdrawalRestrictions: { minSettlementDelayMinutes: 2, lockedUntil: null },
  });
  await walletRepository.insert(mainWallet);
  await walletRepository.insert(savingsWallet);

  const roundUpRule = createRoundUpRule({ id: randomUUID(), userId, incrementType: '10', isEnabled: true });
  await roundUpRuleRepository.save(roundUpRule);

  const environment: IntegrationTestEnvironment = {
    user: cloneUser(baseUser),
    mainWallet: cloneWallet(mainWallet),
    savingsWallet: cloneWallet(savingsWallet),
    roundUpRule: cloneRule(roundUpRule),
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
    stubs: {
      otpSender,
      tokenService,
      pinHasher,
      pinTokenService,
      rateLimiter,
      paystackClient,
      notificationService,
      retryQueue,
    },
    helpers: {
      async refreshUser() {
        const fresh = await userRepository.findById(userId);
        if (!fresh) throw new Error('User not found');
        environment.user = cloneUser(fresh);
        return environment.user;
      },
      async refreshWallet(type) {
        const wallet = await walletRepository.findByUserAndType(userId, type);
        if (!wallet) throw new Error(`Wallet ${type} not found`);
        if (type === 'main') {
          environment.mainWallet = cloneWallet(wallet);
        } else {
          environment.savingsWallet = cloneWallet(wallet);
        }
        return cloneWallet(wallet);
      },
      async refreshTransactions() {
        return transactionRepository.listByUser(userId, { limit: 100, offset: 0 });
      },
      async ensurePin(pin = '1234') {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error('User not found');
        if (!user.pinHash) {
          await authService.setupPin(userId, pin);
          await environment.helpers.refreshUser();
        }
      },
      async issuePinToken(pin = '1234') {
        await environment.helpers.ensurePin(pin);
        const result = await authService.verifyPin(userId, pin);
        if (!result.verified || !result.token) {
          throw new Error('Failed to verify PIN');
        }
        return result.token;
      },
      async topUpMainWallet(amount: number) {
        await walletService.credit({ userId, walletType: 'main', amount });
        await environment.helpers.refreshWallet('main');
      },
      async topUpSavingsWallet(amount: number) {
        await walletService.credit({ userId, walletType: 'savings', amount });
        await environment.helpers.refreshWallet('savings');
      },
      async setRoundUpIncrement(increment: RoundUpRule['incrementType']) {
        const rule = await roundUpRuleRepository.findByUserId(userId);
        if (!rule) throw new Error('Round-up rule not found');
        const updated = cloneRule({ ...rule, incrementType: increment, updatedAt: new Date() });
        await roundUpRuleRepository.save(updated);
        environment.roundUpRule = updated;
      },
      async createSavingsGoal({ name, targetAmount, targetDate, lockIn }: { name: string; targetAmount: number; targetDate?: Date | null; lockIn?: boolean }) {
        const goal = await savingsGoalService.createGoal({
          userId,
          name,
          targetAmount,
          targetDate: targetDate ?? null,
          lockInEnabled: lockIn ?? false,
        });
        return cloneGoal(goal);
      },
      async contributeToGoal(goalId: UUID, amount: number) {
        await savingsGoalService.recordContribution(goalId, amount);
      },
      async approveKyc(documentId: UUID, notes?: string) {
        const document = await kycService.updateStatus({
          documentId,
          status: 'approved',
          verificationNotes: notes ?? 'Approved for automated test',
        });
        return cloneDocument(document);
      },
      listNotifications() {
        return [...notificationService.notifications];
      },
    },
  };

  return environment;
}
