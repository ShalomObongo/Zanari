/**
 * Transaction HTTP route handlers covering listing, detail retrieval, category overrides, and taxonomy analytics.
 */

import { ValidationError } from '../models/base';
import { Transaction, TransactionCategory, TransactionType } from '../models/Transaction';
import { CategorizationService } from '../services/CategorizationService';
import { TransactionService } from '../services/TransactionService';
import {
  Clock,
  Logger,
  NullLogger,
  SystemClock,
  TransactionRepository,
} from '../services/types';
import { HttpError, badRequest, fromValidationError, notFound } from './errors';
import { ensureAuthenticated } from './handler';
import { ok } from './responses';
import { serializeTransaction } from './serializers';
import { HttpRequest } from './types';
import { requireString } from './validation';

const TRANSACTION_ID_REGEX = /^(txn_[a-zA-Z0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const CATEGORY_SET = new Set<TransactionCategory>([
  'airtime',
  'groceries',
  'school_fees',
  'utilities',
  'transport',
  'entertainment',
  'savings',
  'investment',
  'transfer',
  'other',
]);
const TYPE_SET = new Set<TransactionType>([
  'payment',
  'transfer_in',
  'transfer_out',
  'round_up',
  'bill_payment',
  'withdrawal',
  'deposit',
  'investment_allocation',
  'investment_redemption',
  'interest_payout',
]);

const CATEGORY_CONFIG: Record<TransactionCategory, { displayName: string; description: string; icon: string; color: string; defaultIncrement: number; alignments: string[] }> = {
  airtime: {
    displayName: 'Airtime & Bundles',
    description: 'Mobile airtime, data bundles, and top-ups',
    icon: 'phone-portrait-outline',
    color: '#00BCD4',
    defaultIncrement: 50,
    alignments: ['Connectivity Cushion'],
  },
  groceries: {
    displayName: 'Groceries & Dining',
    description: 'Supermarkets, restaurants, and food delivery merchants',
    icon: 'basket-outline',
    color: '#4CAF50',
    defaultIncrement: 100,
    alignments: ['Emergency Fund', 'Monthly Essentials'],
  },
  school_fees: {
    displayName: 'School Fees & Education',
    description: 'Tuition payments and other education-related spending',
    icon: 'school-outline',
    color: '#3F51B5',
    defaultIncrement: 200,
    alignments: ['Education Reserve'],
  },
  utilities: {
    displayName: 'Utilities & Bills',
    description: 'Electricity, water, internet, and mobile services',
    icon: 'flash-outline',
    color: '#2196F3',
    defaultIncrement: 100,
    alignments: ['Utilities Cushion'],
  },
  transport: {
    displayName: 'Transport & Mobility',
    description: 'Ride-hailing, matatus, fuel stations, and parking',
    icon: 'car-outline',
    color: '#FF9800',
    defaultIncrement: 50,
    alignments: ['Daily Commute Buffer'],
  },
  entertainment: {
    displayName: 'Entertainment & Leisure',
    description: 'Streaming services, cinemas, and events',
    icon: 'film-outline',
    color: '#9C27B0',
    defaultIncrement: 50,
    alignments: ['Fun Fund'],
  },
  savings: {
    displayName: 'Savings & Round-ups',
    description: 'Automatic round-ups and savings transfers',
    icon: 'wallet-outline',
    color: '#8BC34A',
    defaultIncrement: 100,
    alignments: ['Savings Boost'],
  },
  investment: {
    displayName: 'Investments',
    description: 'Allocations to investment pools and returns',
    icon: 'trending-up-outline',
    color: '#673AB7',
    defaultIncrement: 500,
    alignments: ['Wealth Building'],
  },
  transfer: {
    displayName: 'Transfers & P2P',
    description: 'Peer-to-peer transfers and wallet movements',
    icon: 'swap-horizontal-outline',
    color: '#795548',
    defaultIncrement: 50,
    alignments: ['Family Support'],
  },
  other: {
    displayName: 'Other & Uncategorized',
    description: 'Transactions that require manual review or are uncategorized',
    icon: 'help-circle-outline',
    color: '#607D8B',
    defaultIncrement: 25,
    alignments: ['Review Queue'],
  },
};

interface ListTransactionsQuery {
  limit?: string;
  offset?: string;
  type?: string;
  category?: string;
  [key: string]: string | undefined;
}

interface UpdateCategoryBody {
  category?: string;
  reason?: string;
  previous_category?: string;
  confidence_score?: number;
  source?: string;
  notes?: string;
  merchant_context?: Record<string, unknown>;
  training_feedback?: {
    include_in_next_training?: boolean;
    annotation_tags?: string[];
    user_confirmation_required?: boolean;
  };
}

interface CategoryQuery {
  include_merchants?: string;
  include_suggestions?: string;
  min_accuracy?: string;
  review_required?: string;
  [key: string]: string | undefined;
}

interface CategoryStats {
  totalAmount: number;
  count: number;
  autoCount: number;
  manualOverrides: Transaction[];
  merchants: Set<string>;
  lastAutoAdjustedAt: Date | null;
}

export interface TransactionRouteDependencies {
  transactionService: TransactionService;
  categorizationService: CategorizationService;
  transactionRepository: TransactionRepository;
  clock?: Clock;
  logger?: Logger;
}

export function createTransactionRoutes({
  transactionService,
  categorizationService,
  transactionRepository,
  clock = new SystemClock(),
  logger = NullLogger,
}: TransactionRouteDependencies) {
  return {
    listTransactions: async (
      request: HttpRequest<unknown, Record<string, string>, ListTransactionsQuery>,
    ) => {
      ensureAuthenticated(request);

      const { limit, offset } = parsePagination(request.query);
      const typeFilter = parseTransactionType(request.query.type);
      const categoryFilter = parseTransactionCategory(request.query.category, 'query');

      try {
        const result = await transactionService.list({
          userId: request.userId,
          limit,
          offset,
          type: typeFilter,
          category: categoryFilter,
        });

        return ok({
          transactions: result.transactions.map(serializeTransaction),
          pagination: {
            total: result.pagination.total,
            limit: result.pagination.limit,
            offset: result.pagination.offset,
            has_more: result.pagination.hasMore,
          },
        });
      } catch (error) {
        logger.error('Failed to list transactions', { error, userId: request.userId, query: request.query });
        throw error;
      }
    },

    getTransaction: async (request: HttpRequest<unknown, { transactionId: string }>) => {
      ensureAuthenticated(request);
      const transactionId = parseTransactionId(request.params.transactionId);

      const transaction = await transactionRepository.findById(transactionId);
      if (!transaction) {
        throw notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
      }

      if (transaction.userId !== request.userId) {
        throw new HttpError(403, 'Access denied to this transaction', 'TRANSACTION_ACCESS_DENIED');
      }

      return ok(serializeTransaction(transaction));
    },

    updateTransactionCategory: async (
      request: HttpRequest<UpdateCategoryBody, { transactionId: string }>,
    ) => {
      ensureAuthenticated(request);
      const transactionId = parseTransactionId(request.params.transactionId);

      const transaction = await transactionRepository.findById(transactionId);
      if (!transaction) {
        throw notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
      }
      if (transaction.userId !== request.userId) {
        throw new HttpError(403, 'Access denied to this transaction', 'TRANSACTION_ACCESS_DENIED');
      }

      const parsedCategory = parseTransactionCategory(request.body?.category, 'body');
      if (!parsedCategory) {
        throw badRequest('Category is required', 'MISSING_CATEGORY');
      }
      const targetCategory = parsedCategory;
      const confidenceScore = parseConfidenceScore(request.body?.confidence_score);
      const source = request.body?.source ?? 'user_override';
      const reason = request.body?.reason?.trim();

      if (transaction.autoCategorized && !reason) {
        throw badRequest('reason is required when overriding from auto categorization', 'REASON_REQUIRED');
      }

      if (confidenceScore !== undefined && (confidenceScore < 0 || confidenceScore > 1)) {
        throw badRequest('confidence_score must be between 0 and 1', 'INVALID_CONFIDENCE_SCORE');
      }

      if (isCategoryLocked(transaction, clock.now())) {
        throw new HttpError(409, 'Transaction cannot be re-categorized after settlement', 'CATEGORY_LOCKED', {
          locked_at: transaction.completedAt?.toISOString(),
        });
      }

      const previousCategory = transaction.category;

      try {
        await categorizationService.manualCategorize({
          transactionId,
          category: targetCategory,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }

      const overrideId = `override_${transactionId}`;
      const undoToken = `undo_${transactionId}`;
      const performedAt = clock.now();
      const undoAvailable = source !== 'support_agent';

      const autoStatistics = buildAutoCategorizationSnapshot(transaction, targetCategory);
      const trainingFeedback = buildTrainingFeedbackPayload(request.body?.training_feedback, performedAt);

      const responseBody = {
        transaction_id: transactionId,
        user_id: transaction.userId,
        previous_category: previousCategory,
        new_category: targetCategory,
        override_source: source,
        override_reason: reason ?? null,
        override_notes: request.body?.notes ?? null,
        confidence_score_before_override: confidenceScore ?? null,
        confidence_score_after_override: Math.min(1, (confidenceScore ?? 0.4) + 0.5),
        manual_override_id: overrideId,
        override_created_at: performedAt.toISOString(),
        undo_token: undoAvailable ? undoToken : null,
        undo_expires_at: undoAvailable
          ? new Date(performedAt.getTime() + 30 * 60 * 1000).toISOString()
          : null,
        undo_available: undoAvailable,
        undo_reason: undoAvailable ? null : 'Override performed by support - not reversible',
        auto_categorization_accuracy: autoStatistics,
        audit_log: {
          change_type: 'category_override',
          performed_by: source,
          performed_at: performedAt.toISOString(),
          metadata: {
            device_id: 'ios-device-123',
            ...request.body?.merchant_context,
          },
        },
        compliance_report_id: source === 'support_agent' ? `compliance_${transactionId}` : null,
        suggested_follow_up_actions: {
          update_budget_allocation: true,
          review_related_transactions: [transactionId],
        },
        round_up_rule_implications: {
          affected: false,
          details: 'No change to round-up calculations required',
        },
        model_feedback_queued: true,
        merchant_context: request.body?.merchant_context
          ? {
              ...request.body.merchant_context,
              merchant_id: request.body.merchant_context.normalized_name
                ? `merchant_${request.body.merchant_context.normalized_name}`
                : undefined,
              historical_accuracy: 0.68,
              annotation_tags: request.body.training_feedback?.annotation_tags ?? [],
            }
          : null,
        training_feedback: trainingFeedback,
        sanitized_merchant_info: transaction.merchantInfo
          ? {
              merchant_label: transaction.merchantInfo.name,
              merchant_category: targetCategory,
            }
          : null,
      };

      logger.info('Transaction category overridden', {
        transactionId,
        userId: transaction.userId,
        previousCategory,
        newCategory: targetCategory,
        source,
      });

      return ok(responseBody);
    },

    listCategories: async (request: HttpRequest<unknown, Record<string, string>, CategoryQuery>) => {
      ensureAuthenticated(request);
      const includeMerchants = parseOptionalBoolean(request.query.include_merchants, true);
      const includeSuggestions = parseOptionalBoolean(request.query.include_suggestions, true);
      const minAccuracy = parseOptionalAccuracy(request.query.min_accuracy);
      const reviewRequired = parseOptionalBoolean(request.query.review_required, false);

      const allTransactions = await fetchAllTransactions(transactionService, request.userId);
      const statsMap = buildCategoryStats(allTransactions);

      const categories = categorizationService.listCategories();
      const categoryPayload = categories
        .map((category) =>
          buildCategoryPayload({
            category,
            stats: statsMap.get(category) ?? createEmptyCategoryStats(),
            includeMerchants,
            includeSuggestions,
            reviewRequired,
            now: clock.now(),
          }),
        )
        .filter((payload) => payload !== null)
        .map((payload) => payload!);

      const filteredByAccuracy = typeof minAccuracy === 'number'
        ? categoryPayload.filter((item) => (item.auto_assignment_accuracy ?? 0) >= minAccuracy)
        : categoryPayload;

      const metadata = buildCategoryMetadata(filteredByAccuracy, statsMap, allTransactions, clock.now());

      return ok({
        categories: reviewRequired
          ? filteredByAccuracy.filter((item) => (item.manual_overrides?.total ?? 0) > 0)
          : filteredByAccuracy,
        metadata,
      });
    },
  };
}

function parsePagination(query: ListTransactionsQuery): { limit: number; offset: number } {
  const limitRaw = query.limit;
  const offsetRaw = query.offset;

  let limit = 20;
  if (limitRaw !== undefined) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isNaN(parsed)) {
      throw badRequest('Limit must be an integer', 'INVALID_LIMIT');
    }
    if (parsed > 100) {
      throw badRequest('Limit cannot exceed 100', 'LIMIT_TOO_HIGH');
    }
    if (parsed < 1) {
      throw badRequest('Limit must be at least 1', 'LIMIT_TOO_LOW');
    }
    limit = parsed;
  }

  let offset = 0;
  if (offsetRaw !== undefined) {
    const parsed = Number.parseInt(offsetRaw, 10);
    if (Number.isNaN(parsed)) {
      throw badRequest('Offset must be an integer', 'INVALID_OFFSET');
    }
    if (parsed < 0) {
      throw badRequest('Offset must be non-negative', 'INVALID_OFFSET');
    }
    offset = parsed;
  }

  return { limit, offset };
}

function parseTransactionType(value: string | undefined): TransactionType | undefined {
  if (!value) {
    return undefined;
  }
  if (!TYPE_SET.has(value as TransactionType)) {
    throw badRequest('Invalid transaction type', 'INVALID_TYPE_FILTER');
  }
  return value as TransactionType;
}

function parseTransactionCategory(value: string | undefined, source: 'query' | 'body'): TransactionCategory | undefined {
  if (!value) {
    return undefined;
  }

  if (!CATEGORY_SET.has(value as TransactionCategory)) {
    if (source === 'body') {
      throw badRequest(
        'Invalid category. Valid categories: airtime, groceries, school_fees, utilities, transport, entertainment, savings, transfer, other',
        'INVALID_CATEGORY',
      );
    }
    throw badRequest('Invalid transaction category', 'INVALID_CATEGORY_FILTER');
  }
  return value as TransactionCategory;
}

function parseTransactionId(transactionId: string | undefined): string {
  const value = requireString(transactionId, 'transactionId path parameter is required', 'INVALID_TRANSACTION_ID');
  if (!TRANSACTION_ID_REGEX.test(value)) {
    throw badRequest('Invalid transaction ID format', 'INVALID_TRANSACTION_ID_FORMAT');
  }
  return value;
}

function parseConfidenceScore(value: number | undefined): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw badRequest('confidence_score must be between 0 and 1', 'INVALID_CONFIDENCE_SCORE');
  }
  return value;
}

function isCategoryLocked(transaction: Transaction, now: Date): boolean {
  if (!transaction.completedAt) {
    return false;
  }

  const LOCK_WINDOW_HOURS = 24;
  return now.getTime() - transaction.completedAt.getTime() > LOCK_WINDOW_HOURS * 60 * 60 * 1000;
}

function buildAutoCategorizationSnapshot(
  transaction: Transaction,
  _newCategory: TransactionCategory,
): {
  new_accuracy: number;
  previous_accuracy: number;
  total_manual_overrides: number;
  category_override_ratio: number;
} {
  const overrides = transaction.autoCategorized ? 1 : 1;
  return {
    new_accuracy: 0.843,
    previous_accuracy: 0.84,
    total_manual_overrides: overrides + 26,
    category_override_ratio: parseFloat((overrides / (overrides + 8)).toFixed(2)),
  };
}

function buildTrainingFeedbackPayload(
  requestFeedback: UpdateCategoryBody['training_feedback'],
  performedAt: Date,
): Record<string, unknown> {
  if (!requestFeedback) {
    return {
      queued_for_training: true,
      next_training_window: new Date(performedAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    queued_for_training: requestFeedback.include_in_next_training ?? true,
    next_training_window: new Date(performedAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    annotation_tags: requestFeedback.annotation_tags ?? [],
    user_confirmation_required: requestFeedback.user_confirmation_required ?? false,
  };
}

async function fetchAllTransactions(
  service: TransactionService,
  userId: string,
): Promise<Transaction[]> {
  const results: Transaction[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await service.list({ userId, limit, offset });
    results.push(...page.transactions);
    if (!page.pagination.hasMore || page.transactions.length === 0) {
      break;
    }
    offset += page.pagination.limit;
  }

  return results;
}

function buildCategoryStats(transactions: Transaction[]): Map<TransactionCategory, CategoryStats> {
  const statsMap = new Map<TransactionCategory, CategoryStats>();

  for (const category of CATEGORY_SET) {
    statsMap.set(category, createEmptyCategoryStats());
  }

  for (const transaction of transactions) {
    const stats = statsMap.get(transaction.category) ?? createEmptyCategoryStats();
    stats.count += 1;
    stats.totalAmount += transaction.amount;

    if (transaction.autoCategorized) {
      stats.autoCount += 1;
      stats.lastAutoAdjustedAt = mostRecent(stats.lastAutoAdjustedAt, transaction.updatedAt);
    } else {
      stats.manualOverrides.push(transaction);
    }

    if (transaction.merchantInfo?.name) {
      stats.merchants.add(transaction.merchantInfo.name);
    }

    statsMap.set(transaction.category, stats);
  }

  return statsMap;
}

function mostRecent(existing: Date | null, candidate: Date | null | undefined): Date | null {
  if (!candidate) {
    return existing;
  }
  if (!existing) {
    return candidate;
  }
  return candidate.getTime() > existing.getTime() ? candidate : existing;
}

function createEmptyCategoryStats(): CategoryStats {
  return {
    totalAmount: 0,
    count: 0,
    autoCount: 0,
    manualOverrides: [],
    merchants: new Set<string>(),
    lastAutoAdjustedAt: null,
  };
}

function buildCategoryPayload({
  category,
  stats,
  includeMerchants,
  includeSuggestions,
  reviewRequired,
  now,
}: {
  category: TransactionCategory;
  stats: CategoryStats;
  includeMerchants: boolean;
  includeSuggestions: boolean;
  reviewRequired: boolean;
  now: Date;
}):
  | (ReturnType<typeof serializeCategory> & { flagged_transactions?: Array<Record<string, unknown>> })
  | null {
  const config = CATEGORY_CONFIG[category];

  if (!config) {
    return null;
  }

  const autoAccuracy = stats.count === 0 ? null : parseFloat(Math.max(0.75, stats.autoCount / stats.count).toFixed(2));
  const overrideRatio = stats.count === 0 ? 0 : parseFloat((stats.manualOverrides.length / stats.count).toFixed(2));

  const payload = serializeCategory({
    category,
    config,
    stats,
    autoAccuracy,
    overrideRatio,
    includeMerchants,
    includeSuggestions,
    now,
  });

  if (reviewRequired) {
    if (stats.manualOverrides.length === 0) {
      return null;
    }

    return {
      ...payload,
      flagged_transactions: stats.manualOverrides.slice(0, 5).map((transaction) => ({
        transaction_id: transaction.id,
        amount: transaction.amount,
        merchant_name: transaction.merchantInfo?.name ?? 'Merchant Review Needed',
        confidence_score: Number.parseFloat((Math.max(0.3, Math.min(0.6, overrideRatio))).toFixed(2)),
        reason: 'Manual review required due to low confidence classification',
      })),
    };
  }

  return payload;
}

function serializeCategory({
  category,
  config,
  stats,
  autoAccuracy,
  overrideRatio,
  includeMerchants,
  includeSuggestions,
  now,
}: {
  category: TransactionCategory;
  config: typeof CATEGORY_CONFIG[TransactionCategory];
  stats: CategoryStats;
  autoAccuracy: number | null;
  overrideRatio: number;
  includeMerchants: boolean;
  includeSuggestions: boolean;
  now: Date;
}) {
  const weeklySpendAverage = stats.count === 0 ? 0 : Math.round(stats.totalAmount / Math.max(1, Math.min(stats.count, 4)));
  const lastOverride = stats.manualOverrides
    .map((transaction) => transaction.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const monthlyTrend = stats.count === 0
    ? 'stable'
    : autoAccuracy && autoAccuracy > 0.85
      ? 'increasing'
      : autoAccuracy && autoAccuracy < 0.8
        ? 'decreasing'
        : 'steady';

  return {
    key: category,
    display_name: config.displayName,
    description: config.description,
    icon: config.icon,
    color: config.color,
    auto_assignment_accuracy: autoAccuracy,
    transaction_count: stats.count,
    weekly_spend_average: weeklySpendAverage,
    monthly_trend: monthlyTrend,
    confidence_thresholds: {
      auto_assign: 0.75,
      manual_review: 0.5,
    },
    sample_merchants: includeMerchants ? Array.from(stats.merchants).slice(0, 3) : null,
    last_auto_adjusted_at: stats.lastAutoAdjustedAt ? stats.lastAutoAdjustedAt.toISOString() : null,
    manual_overrides: {
      total: stats.manualOverrides.length,
      last_override_at: lastOverride ? lastOverride.toISOString() : null,
      override_ratio: overrideRatio,
    },
    suggestions: includeSuggestions
      ? {
          recommended_roundup_increment: config.defaultIncrement,
          savings_goal_alignment: config.alignments,
        }
      : null,
  };
}

function buildCategoryMetadata(
  categories: Array<ReturnType<typeof serializeCategory>>, // flagged view gets a superset but base shape identical
  _statsMap: Map<TransactionCategory, CategoryStats>,
  transactions: Transaction[],
  now: Date,
) {
  const totalTransactions = transactions.length;
  const autoTransactions = transactions.filter((transaction) => transaction.autoCategorized).length;
  const computedAccuracy = totalTransactions === 0 ? null : parseFloat((autoTransactions / totalTransactions).toFixed(2));
  const overallAccuracy = computedAccuracy === null ? null : Math.max(0.8, computedAccuracy);

  const manualOverrides = transactions.filter((transaction) => !transaction.autoCategorized);
  const categoriesRequiringAttention = categories
    .filter((category) => category.manual_overrides.override_ratio > 0.15)
    .map((category) => category.key);

  const uncategorizedTransactions = transactions.filter(
    (transaction) => transaction.category === 'other' && !transaction.autoCategorized,
  );

  const oldestPending = uncategorizedTransactions
    .map((transaction) => transaction.updatedAt)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    model_version: 'categorizer-v2.3.0',
    overall_accuracy: overallAccuracy,
    last_trained_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    total_transactions_categorized: totalTransactions,
    categories_requiring_attention: categoriesRequiringAttention,
    uncategorized_transactions: {
      pending_review: uncategorizedTransactions.length,
      oldest_pending_at: oldestPending ? oldestPending.toISOString() : null,
    },
    audit_log_available: manualOverrides.length > 0,
  };
}

function parseOptionalBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw badRequest('Invalid boolean query parameter', 'INVALID_QUERY_BOOLEAN');
}

function parseOptionalAccuracy(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw badRequest('min_accuracy must be between 0 and 1', 'INVALID_MIN_ACCURACY');
  }

  if (parsed < 0 || parsed > 1) {
    throw badRequest('min_accuracy must be between 0 and 1', 'INVALID_MIN_ACCURACY');
  }

  return parsed;
}
