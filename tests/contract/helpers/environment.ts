import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from '../../integration/helpers/environment';
import { executeRoute } from '../../../api/src/routes/handler';
import { HttpRequest, HttpResponse, RouteHandler } from '../../../api/src/routes/types';
import { createAuthRoutes } from '../../../api/src/routes/auth';
import { createWalletRoutes } from '../../../api/src/routes/wallets';
import { createPaymentRoutes } from '../../../api/src/routes/payments';
import { createSavingsGoalRoutes } from '../../../api/src/routes/savings-goals';
import { createRoundUpRuleRoutes } from '../../../api/src/routes/round-up-rules';
import { createKYCRoutes } from '../../../api/src/routes/kyc';
import { createTransactionRoutes } from '../../../api/src/routes/transactions';

export interface RouteInvocationOptions<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
> {
  body?: TBody | null;
  params?: TParams;
  query?: TQuery;
  headers?: Record<string, string | undefined>;
  userId?: string;
}

export interface ContractTestEnvironment {
  integration: IntegrationTestEnvironment;
  userId: string;
  routes: {
    auth: ReturnType<typeof createAuthRoutes>;
    wallets: ReturnType<typeof createWalletRoutes>;
    payments: ReturnType<typeof createPaymentRoutes>;
    savings: ReturnType<typeof createSavingsGoalRoutes>;
    roundUp: ReturnType<typeof createRoundUpRuleRoutes>;
    kyc: ReturnType<typeof createKYCRoutes>;
    transactions: ReturnType<typeof createTransactionRoutes>;
  };
  execute<TRequest extends HttpRequest = HttpRequest>(
    handler: RouteHandler<TRequest>,
    options?: RouteInvocationOptions<TRequest['body'], TRequest['params'], TRequest['query']>,
  ): Promise<HttpResponse<any>>;
  executeAsUser<TRequest extends HttpRequest = HttpRequest>(
    handler: RouteHandler<TRequest>,
    options?: RouteInvocationOptions<TRequest['body'], TRequest['params'], TRequest['query']>,
  ): Promise<HttpResponse<any>>;
  buildRequest(
    options?: RouteInvocationOptions,
  ): HttpRequest;
  authHeaders(token?: string): Record<string, string>;
}

function buildHttpRequest(
  options: RouteInvocationOptions = {},
): HttpRequest {
  return {
    body: (options.body ?? undefined) as unknown,
    params: (options.params ?? {}) as Record<string, string>,
    query: (options.query ?? {}) as Record<string, string | undefined>,
    headers: { ...(options.headers ?? {}) },
    ...(options.userId ? { userId: options.userId } : {}),
  };
}

export async function createContractTestEnvironment(): Promise<ContractTestEnvironment> {
  const integration = await createIntegrationTestEnvironment();

  const routes = {
    auth: createAuthRoutes({
      authService: integration.services.authService,
      registrationService: integration.services.registrationService,
    }),
    wallets: createWalletRoutes({
      walletService: integration.services.walletService,
      transactionService: integration.services.transactionService,
      authService: integration.services.authService,
    }),
    payments: createPaymentRoutes({
      paymentService: integration.services.paymentService,
      authService: integration.services.authService,
      walletService: integration.services.walletService,
      userRepository: integration.repositories.userRepository,
      transactionRepository: integration.repositories.transactionRepository,
      roundUpRuleRepository: integration.repositories.roundUpRuleRepository,
    }),
    savings: createSavingsGoalRoutes({
      savingsGoalService: integration.services.savingsGoalService,
      walletService: integration.services.walletService,
    }),
    roundUp: createRoundUpRuleRoutes({
      roundUpRuleRepository: integration.repositories.roundUpRuleRepository,
      transactionRepository: integration.repositories.transactionRepository,
      autoAnalyzeService: integration.services.autoAnalyzeService,
    }),
    kyc: createKYCRoutes({
      kycService: integration.services.kycService,
    }),
    transactions: createTransactionRoutes({
      transactionService: integration.services.transactionService,
      categorizationService: integration.services.categorizationService,
      transactionRepository: integration.repositories.transactionRepository,
    }),
  };

  const executeWithRequest = async <TRequest extends HttpRequest = HttpRequest>(
    handler: RouteHandler<TRequest>,
    options: RouteInvocationOptions<TRequest['body'], TRequest['params'], TRequest['query']> = {},
  ): Promise<HttpResponse<any>> => {
    const request = buildHttpRequest(options);
    return executeRoute(handler as RouteHandler, request);
  };

  const defaultUserId = integration.user.id;

  return {
    integration,
    userId: defaultUserId,
    routes,
    execute: executeWithRequest,
    executeAsUser: (handler, options = {}) =>
      executeWithRequest(handler, { ...options, userId: options.userId ?? defaultUserId }),
    buildRequest: (options) => buildHttpRequest(options),
    authHeaders: (token = 'test-access-token') => ({ Authorization: `Bearer ${token}` }),
  };
}
