import { SavingsInvestmentService } from '../services/SavingsInvestmentService';
import { Logger, NullLogger } from '../services/types';
import { ensureAuthenticated } from './handler';
import { HttpError, badRequest } from './errors';
import { ok } from './responses';
import { HttpRequest } from './types';
import { requireNumber } from './validation';

interface SavingsInvestmentRouteDependencies {
  savingsInvestmentService: SavingsInvestmentService;
  logger?: Logger;
}

interface PreferenceBody {
  auto_invest_enabled?: boolean;
  target_allocation_pct?: number;
}

interface TransferBody {
  amount?: number;
}

const mapSummary = (summary: Awaited<ReturnType<SavingsInvestmentService['getSummary']>>) => ({
  auto_invest_enabled: summary.autoInvestEnabled,
  target_allocation_pct: summary.targetAllocationPct,
  product_code: summary.productCode,
  product_name: summary.productName,
  annual_yield_bps: summary.annualYieldBps,
  invested_amount: summary.investedAmount,
  accrued_interest: summary.accruedInterest,
  projected_monthly_yield: summary.projectedMonthlyYield,
  savings_cash_balance: summary.savingsCashBalance,
  savings_available_balance: summary.savingsAvailableBalance,
  total_value: summary.totalValue,
  last_accrued_at: summary.lastAccruedAt ? summary.lastAccruedAt.toISOString() : null,
});

export function createSavingsInvestmentRoutes({ savingsInvestmentService, logger = NullLogger }: SavingsInvestmentRouteDependencies) {
  return {
    getSummary: async (request: HttpRequest) => {
      ensureAuthenticated(request);
      const summary = await savingsInvestmentService.getSummary(request.userId);
      return ok({ summary: mapSummary(summary) });
    },

    updatePreference: async (request: HttpRequest<PreferenceBody>) => {
      ensureAuthenticated(request);
      const body = request.body ?? {};
      if (body.target_allocation_pct !== undefined) {
        if (!Number.isFinite(body.target_allocation_pct)) {
          throw badRequest('target_allocation_pct must be a number', 'INVALID_TARGET_ALLOCATION');
        }
        if (body.target_allocation_pct < 0 || body.target_allocation_pct > 100) {
          throw badRequest('target_allocation_pct must be between 0 and 100', 'INVALID_TARGET_ALLOCATION');
        }
      }

      const summary = await savingsInvestmentService.updatePreference(request.userId, {
        autoInvestEnabled: body.auto_invest_enabled,
        targetAllocationPct: body.target_allocation_pct,
      });
      logger.info('Savings investment preference updated via API', { userId: request.userId });
      return ok({ summary: mapSummary(summary) });
    },

    allocate: async (request: HttpRequest<TransferBody>) => {
      ensureAuthenticated(request);
      const amount = requireNumber(request.body?.amount, 'Amount must be provided', 'INVALID_AMOUNT');
      const summary = await savingsInvestmentService.allocate(request.userId, amount);
      return ok({ summary: mapSummary(summary) });
    },

    redeem: async (request: HttpRequest<TransferBody>) => {
      ensureAuthenticated(request);
      const amount = requireNumber(request.body?.amount, 'Amount must be provided', 'INVALID_AMOUNT');
      const summary = await savingsInvestmentService.redeem(request.userId, amount);
      return ok({ summary: mapSummary(summary) });
    },

    claimInterest: async (request: HttpRequest) => {
      ensureAuthenticated(request);
      const summary = await savingsInvestmentService.claimAccruedInterest(request.userId);
      return ok({ summary: mapSummary(summary) });
    },
  };
}
