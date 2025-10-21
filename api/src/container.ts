import { getSupabaseClient } from './config/supabase';
import { SupabaseAuthSessionRepository } from './repositories/SupabaseAuthSessionRepository';
import { SupabaseKYCDocumentRepository } from './repositories/SupabaseKYCDocumentRepository';
import { SupabaseRoundUpRuleRepository } from './repositories/SupabaseRoundUpRuleRepository';
import { SupabaseSavingsGoalRepository } from './repositories/SupabaseSavingsGoalRepository';
import { SupabaseTransactionRepository } from './repositories/SupabaseTransactionRepository';
import { SupabaseUserRepository } from './repositories/SupabaseUserRepository';
import { SupabaseWalletRepository } from './repositories/SupabaseWalletRepository';
import { AutoAnalyzeService } from './services/AutoAnalyzeService';
import { AuthService } from './services/AuthService';
import { CategorizationService } from './services/CategorizationService';
import { CryptoPinHasher } from './services/CryptoPinHasher';
import { InMemoryRateLimiter } from './services/InMemoryRateLimiter';
import { KYCService } from './services/KYCService';
import { PaymentService } from './services/PaymentService';
import { RandomTokenService } from './services/RandomTokenService';
import { SavingsGoalService } from './services/SavingsGoalService';
import { SupabasePinTokenService } from './services/SupabasePinTokenService';
import { SupabaseRetryQueue } from './services/SupabaseRetryQueue';
import { TransactionService } from './services/TransactionService';
import { WalletService } from './services/WalletService';
import { ConsoleNotificationService } from './services/ConsoleNotificationService';
import { ConsoleOtpSender } from './services/ConsoleOtpSender';
import { ConsoleLogger } from './services/ConsoleLogger';
import { HttpPaystackClient } from './clients/PaystackClient';
import { createAuthRoutes } from './routes/auth';
import { createPaymentRoutes } from './routes/payments';
import { createWalletRoutes } from './routes/wallets';
import { createTransactionRoutes } from './routes/transactions';
import { createRoundUpRuleRoutes } from './routes/round-up-rules';
import { createSavingsGoalRoutes } from './routes/savings-goals';
import { createKYCRoutes } from './routes/kyc';
import { createWebhookRoutes } from './routes/webhooks';
import { createInMemoryAppContainer, InMemoryPaystackClient, logInMemoryStartup } from './dev/inMemoryAppContainer';
import { RegistrationService } from './services/RegistrationService';
import { SupabaseIdentityProvider } from './services/IdentityProvider';

const logger = new ConsoleLogger();

function hasSupabaseConfig(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && serviceRoleKey);
}

export function createAppContainer() {
  if (!hasSupabaseConfig()) {
    logInMemoryStartup(logger);
    return createInMemoryAppContainer({ logger });
  }

  const supabase = getSupabaseClient();

  const userRepository = new SupabaseUserRepository(supabase);
  const walletRepository = new SupabaseWalletRepository(supabase);
  const transactionRepository = new SupabaseTransactionRepository(supabase);
  const savingsGoalRepository = new SupabaseSavingsGoalRepository(supabase);
  const roundUpRuleRepository = new SupabaseRoundUpRuleRepository(supabase);
  const kycDocumentRepository = new SupabaseKYCDocumentRepository(supabase);
  const authSessionRepository = new SupabaseAuthSessionRepository(supabase);
  const pinTokenService = new SupabasePinTokenService(supabase);
  const retryQueue = new SupabaseRetryQueue(supabase);

  const notificationService = new ConsoleNotificationService();
  const otpSender = new ConsoleOtpSender();
  const tokenService = new RandomTokenService();
  const pinHasher = new CryptoPinHasher();
  const rateLimiter = new InMemoryRateLimiter();

  const transactionService = new TransactionService({
    transactionRepository,
    logger,
  });

  const walletService = new WalletService({
    walletRepository,
    logger,
  });

  const categorizationService = new CategorizationService({
    transactionRepository,
    logger,
  });

  const autoAnalyzeService = new AutoAnalyzeService({
    transactionRepository,
    roundUpRuleRepository,
    logger,
  });

  const savingsGoalService = new SavingsGoalService({
    repository: savingsGoalRepository,
    notificationService,
    logger,
  });

  const kycService = new KYCService({
    repository: kycDocumentRepository,
    notificationService,
    logger,
  });

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const paystackClient = paystackSecret
    ? new HttpPaystackClient({
        secretKey: paystackSecret,
        baseUrl: process.env.PAYSTACK_BASE_URL,
        logger,
      })
    : new InMemoryPaystackClient();

  if (!paystackSecret) {
    logger.warn('PAYSTACK_SECRET_KEY not configured. Falling back to in-memory Paystack client.');
  }

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

  const identityProvider = new SupabaseIdentityProvider(supabase);
  const registrationService = new RegistrationService({
    userRepository,
    identityProvider,
    authService,
  });

  const paymentService = new PaymentService({
    transactionService,
    transactionRepository,
    walletService,
    paystackClient,
    roundUpRuleRepository,
    retryQueue,
    logger,
  });

  const authRoutes = createAuthRoutes({ authService, registrationService });
  const paymentRoutes = createPaymentRoutes({
    paymentService,
    authService,
    walletService,
    userRepository,
    transactionRepository,
    logger,
  });
  const walletRoutes = createWalletRoutes({ walletService, transactionService, authService, logger });
  const transactionRoutes = createTransactionRoutes({
    transactionService,
    categorizationService,
    transactionRepository,
    logger,
  });
  const roundUpRoutes = createRoundUpRuleRoutes({
    roundUpRuleRepository,
    transactionRepository,
    autoAnalyzeService,
    logger,
  });
  const savingsRoutes = createSavingsGoalRoutes({ savingsGoalService, logger });
  const kycRoutes = createKYCRoutes({ kycService, logger });
  const webhookRoutes = createWebhookRoutes({ logger });

  return {
    repositories: {
      userRepository,
      walletRepository,
      transactionRepository,
      savingsGoalRepository,
      roundUpRuleRepository,
      kycDocumentRepository,
      authSessionRepository,
    },
    services: {
      authService,
      registrationService,
      transactionService,
      walletService,
      paymentService,
      savingsGoalService,
      kycService,
      categorizationService,
      autoAnalyzeService,
    },
    routes: {
      auth: authRoutes,
      payments: paymentRoutes,
      wallets: walletRoutes,
      transactions: transactionRoutes,
      roundUp: roundUpRoutes,
      savings: savingsRoutes,
      kyc: kycRoutes,
      webhooks: webhookRoutes,
    },
  };
}
