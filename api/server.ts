/**
 * Development API Server
 *
 * Wires the framework-agnostic route handlers to Express and connects
 * infrastructure dependencies (Supabase, Paystack, etc.) via the
 * application container.
 */

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { createAppContainer } from './src/container';
import { executeRoute } from './src/routes/handler';
import { HttpRequest, RouteHandler } from './src/routes/types';

// Load environment variables before bootstrapping dependencies
dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT ?? 3000);

// Compose application container (Supabase, repositories, services, routes)
const container = createAppContainer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (basic dev logger)
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    supabase_url: process.env.SUPABASE_URL ?? 'not_configured',
  });
});

const normalizeHeaders = (headers: Request['headers']): Record<string, string | undefined> => {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.length > 0 ? String(value[0]) : undefined;
    } else if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    } else if (typeof value === 'number') {
      normalized[key.toLowerCase()] = String(value);
    } else if (value != null) {
      normalized[key.toLowerCase()] = String(value);
    } else {
      normalized[key.toLowerCase()] = undefined;
    }
  }
  return normalized;
};

const normalizeQuery = (query: Request['query']): Record<string, string | undefined> => {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      normalized[key] = value.length > 0 ? String(value[0]) : undefined;
    } else if (value === null || value === undefined) {
      normalized[key] = undefined;
    } else if (typeof value === 'object') {
      normalized[key] = JSON.stringify(value);
    } else {
      normalized[key] = String(value);
    }
  }
  return normalized;
};

const ACCESS_TOKEN_REGEX = /^access-([0-9a-fA-F-]{36})-[0-9a-fA-F-]{36}$/;

const resolveUserId = (req: Request): string | undefined => {
  const userHeader = req.headers['x-user-id'] ?? req.headers['x-userid'];
  if (Array.isArray(userHeader)) {
    const candidate = userHeader.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (candidate) {
      return candidate.trim();
    }
  } else if (typeof userHeader === 'string' && userHeader.trim().length > 0) {
    return userHeader.trim();
  }

  const authHeader = req.header('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    const match = ACCESS_TOKEN_REGEX.exec(token);
    if (match) {
      return match[1];
    }
  }

  return undefined;
};

const adaptRoute = <TRequest extends HttpRequest = HttpRequest>(handler: RouteHandler<TRequest>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const headers = normalizeHeaders(req.headers);
    const query = normalizeQuery(req.query);

    const request: HttpRequest = {
      body: (req.body ?? undefined) as TRequest['body'],
      params: (req.params ?? {}) as Record<string, string>,
      query: query as TRequest['query'],
      headers,
    };

    const userId = resolveUserId(req);
    if (userId) {
      request.userId = userId;
    }

    try {
      const response = await executeRoute(handler as RouteHandler, request);
      if (response.headers) {
        res.set(response.headers);
      }

      if (response.body === undefined) {
        res.status(response.status).end();
      } else if (typeof response.body === 'object' && response.body !== null) {
        res.status(response.status).json(response.body);
      } else {
        res.status(response.status).send(response.body as string);
      }
    } catch (error) {
      next(error);
    }
  };
};

// Authentication
app.post('/auth/register', adaptRoute(container.routes.auth.register));
app.post('/auth/login', adaptRoute(container.routes.auth.login));
app.post('/auth/verify-otp', adaptRoute(container.routes.auth.verifyOtp));
app.post('/auth/setup-pin', adaptRoute(container.routes.auth.setupPin));
app.post('/auth/verify-pin', adaptRoute(container.routes.auth.verifyPin));
app.patch('/auth/profile', adaptRoute(container.routes.auth.updateProfile));
app.put('/auth/profile', adaptRoute(container.routes.auth.updateProfile));

// Users
app.get('/users/lookup', adaptRoute(container.routes.users.lookupUser));

// Wallets
app.get('/wallets', adaptRoute(container.routes.wallets.listWallets));
app.post('/wallets/:walletId/withdraw', adaptRoute(container.routes.wallets.withdraw));
app.post('/wallets/transfer-to-savings', adaptRoute(container.routes.wallets.transferToSavings));
app.post('/wallets/transfer-from-savings', adaptRoute(container.routes.wallets.transferFromSavings));

// Payments
app.post('/payments/preview', adaptRoute(container.routes.payments.previewTransfer));
app.post('/payments/verify', adaptRoute(container.routes.payments.verifyPayment));
app.post('/payments/merchant', adaptRoute(container.routes.payments.payMerchant));
app.post('/payments/transfer', adaptRoute(container.routes.payments.transferPeer));
app.post('/payments/topup', adaptRoute(container.routes.payments.topUpWallet));

// Savings goals
app.get('/savings-goals', adaptRoute(container.routes.savings.listGoals));
app.post('/savings-goals', adaptRoute(container.routes.savings.createGoal));
app.put('/savings-goals/:goalId', adaptRoute(container.routes.savings.updateGoal));
app.patch('/savings-goals/:goalId', adaptRoute(container.routes.savings.updateGoal));
app.delete('/savings-goals/:goalId', adaptRoute(container.routes.savings.deleteGoal));
app.post('/savings-goals/:goalId/deposit', adaptRoute(container.routes.savings.depositToGoal));
app.post('/savings-goals/:goalId/withdraw', adaptRoute(container.routes.savings.withdrawFromGoal));
app.post('/savings-goals/:goalId/cancel', adaptRoute(container.routes.savings.cancelGoal));

// Savings investments (Phase 1 yield-on-savings)
app.get('/investments/savings/summary', adaptRoute(container.routes.investments.getSummary));
app.post('/investments/savings/preferences', adaptRoute(container.routes.investments.updatePreference));
app.post('/investments/savings/allocate', adaptRoute(container.routes.investments.allocate));
app.post('/investments/savings/redeem', adaptRoute(container.routes.investments.redeem));
app.post('/investments/savings/claim-interest', adaptRoute(container.routes.investments.claimInterest));

// Round-up rules
app.get('/round-up-rules', adaptRoute(container.routes.roundUp.getRule));
app.put('/round-up-rules', adaptRoute(container.routes.roundUp.updateRule));
app.patch('/round-up-rules', adaptRoute(container.routes.roundUp.updateRule));
app.get('/round-up-rules/auto-analysis', adaptRoute(container.routes.roundUp.autoAnalyze));

// Transactions
app.get('/transactions', adaptRoute(container.routes.transactions.listTransactions));
app.get('/transactions/categories', adaptRoute(container.routes.transactions.listCategories));
app.get('/transactions/:transactionId', adaptRoute(container.routes.transactions.getTransaction));
app.patch('/transactions/:transactionId/category', adaptRoute(container.routes.transactions.updateTransactionCategory));

// KYC
app.get('/kyc/documents', adaptRoute(container.routes.kyc.listDocuments));
app.post('/kyc/documents', adaptRoute(container.routes.kyc.initiateUpload));

// Webhooks
app.post('/webhooks/paystack', adaptRoute(container.routes.webhooks.handlePaystackWebhook));

// Error handling middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Zanari2 API Server (Supabase-backed)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🚀 Server running on: http://localhost:${PORT}`);
  console.log(`  📝 Health check: http://localhost:${PORT}/health`);
  console.log(`  🔐 Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

export default app;
