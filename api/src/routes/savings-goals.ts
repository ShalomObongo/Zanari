/**
 * Savings goal HTTP route handlers for goal lifecycle management.
 */

import { ValidationError } from '../models/base';
import { SavingsGoal, SavingsGoalMilestone } from '../models/SavingsGoal';
import { SavingsGoalService } from '../services/SavingsGoalService';
import { Clock, Logger, NullLogger, SystemClock } from '../services/types';
import { HttpError, badRequest, conflict, fromValidationError, notFound } from './errors';
import { ensureAuthenticated } from './handler';
import { created, ok } from './responses';
import { HttpRequest } from './types';
import { requireInteger, requireString } from './validation';

interface CreateSavingsGoalBody {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface UpdateSavingsGoalBody {
  name?: string;
  description?: string | null;
  target_amount?: number;
  target_date?: string | null;
  category?: string | null;
  lock_in_enabled?: boolean;
}

interface ListSavingsGoalsQuery {
  status?: string;
  category?: string;
  page?: string;
  per_page?: string;
  sort?: string;
  archived?: string;
  [key: string]: string | undefined;
}

export interface SavingsGoalRouteDependencies {
  savingsGoalService: SavingsGoalService;
  walletService: any; // WalletService
  clock?: Clock;
  logger?: Logger;
}

const MIN_GOAL_AMOUNT = 500; // cents → KES 5.00
const MAX_GOAL_AMOUNT = 100_000_000; // cents → KES 1,000,000.00
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const TARGET_WARNING_THRESHOLD_DAYS = 7;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CATEGORY = 'general';
const ARCHIVED_STATUSES = new Set(['cancelled']);

const goalCategoryStore = new Map<string, string>();

export function createSavingsGoalRoutes({
  savingsGoalService,
  walletService,
  clock = new SystemClock(),
  logger = NullLogger,
}: SavingsGoalRouteDependencies) {
  return {
    listGoals: async (
      request: HttpRequest<unknown, Record<string, string>, ListSavingsGoalsQuery>,
    ) => {
      ensureAuthenticated(request);

      const page = parsePositiveInt(request.query.page, DEFAULT_PAGE, 'page');
      const perPage = parsePositiveInt(request.query.per_page, DEFAULT_PER_PAGE, 'per_page', MAX_PER_PAGE);
      const includeArchived = parseBoolean(request.query.archived, false);
      const requestedStatuses = parseStatuses(request.query.status);
      const categoryFilter = request.query.category?.trim().toLowerCase() ?? null;
      const sortKey = parseSortKey(request.query.sort);

      const allGoals = await savingsGoalService.listGoals(request.userId);
      const now = clock.now();

      const filteredGoals = allGoals.filter((goal) => {
        if (!includeArchived && ARCHIVED_STATUSES.has(goal.status)) {
          return false;
        }

        if (requestedStatuses && !requestedStatuses.has(goal.status)) {
          return false;
        }

        if (categoryFilter) {
          const category = goalCategoryStore.get(goal.id)?.toLowerCase() ?? DEFAULT_CATEGORY;
          if (category !== categoryFilter) {
            return false;
          }
        }

        return true;
      });

      const sortedGoals = sortGoals(filteredGoals, sortKey);
      const totalItems = sortedGoals.length;
      const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / perPage);
      const start = (page - 1) * perPage;
      const paginatedGoals = start >= sortedGoals.length ? [] : sortedGoals.slice(start, start + perPage);

      const goals = paginatedGoals.map((goal) => buildGoalResponse(goal, now));

      return ok({
        goals,
        pagination: {
          page,
          per_page: perPage,
          total_items: totalItems,
          total_pages: totalPages,
        },
      });
    },

    createGoal: async (request: HttpRequest<CreateSavingsGoalBody>) => {
      ensureAuthenticated(request);

      const parsed = parseCreateGoalBody(request.body, clock);

      const existingGoals = await savingsGoalService.listGoals(request.userId);
      const duplicate = findGoalByName(existingGoals, parsed.name);
      if (duplicate) {
        throw conflict('Goal with this name already exists', 'DUPLICATE_GOAL_NAME');
      }

      try {
        const createdGoal = await savingsGoalService.createGoal({
          userId: request.userId,
          name: parsed.name,
          description: parsed.description,
          targetAmount: parsed.targetAmount,
          targetDate: parsed.targetDate,
          lockInEnabled: parsed.lockInEnabled,
        });

        if (parsed.category) {
          goalCategoryStore.set(createdGoal.id, parsed.category);
        }

        const response = buildGoalResponse(createdGoal, clock.now(), parsed.category);
        logger.info('Savings goal created via API', {
          userId: request.userId,
          goalId: createdGoal.id,
          targetAmount: createdGoal.targetAmount,
        });
        return created(response);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    updateGoal: async (
      request: HttpRequest<UpdateSavingsGoalBody, { goalId: string }>,
    ) => {
      ensureAuthenticated(request);

      const goalId = requireString(request.params.goalId, 'Goal ID is required', 'INVALID_GOAL_ID');

      let goal: SavingsGoal;
      try {
        goal = await savingsGoalService.getGoal(goalId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          throw notFound('Savings goal not found', 'GOAL_NOT_FOUND');
        }
        throw error;
      }

      if (goal.userId !== request.userId) {
        throw new HttpError(403, 'Not authorized to update this goal', 'UNAUTHORIZED_GOAL_ACCESS');
      }

      if (goal.status === 'completed') {
        throw badRequest('Cannot update completed goals', 'GOAL_ALREADY_COMPLETED', { status: goal.status });
      }

      if (goal.status === 'cancelled') {
        throw badRequest('Cannot update cancelled goals', 'GOAL_CANCELLED', { status: goal.status });
      }

      const updates = parseUpdateGoalBody(request.body, clock);
      if (Object.keys(updates).length === 0) {
        throw badRequest('At least one field must be provided for update', 'NO_UPDATE_FIELDS');
      }

      if (updates.name) {
        const existingGoals = await savingsGoalService.listGoals(request.userId);
        const duplicate = findGoalByName(existingGoals, updates.name, goal.id);
        if (duplicate) {
          throw conflict('Goal with this name already exists', 'DUPLICATE_GOAL_NAME');
        }
      }

      const targetAmount = updates.targetAmount ?? goal.targetAmount;
      if (targetAmount < goal.currentAmount) {
        throw badRequest('Target amount cannot be less than current saved amount', 'TARGET_BELOW_CURRENT', {
          current_amount: goal.currentAmount,
          requested_target: targetAmount,
        });
      }

      const now = clock.now();
      const updatedMilestones = updates.targetAmount
        ? recalculateMilestones(goal, targetAmount, now)
        : goal.milestones.map((milestone) => ({ ...milestone }));

      const updatedGoal: SavingsGoal = {
        ...goal,
        name: updates.name ?? goal.name,
        description: updates.description ?? goal.description,
        targetAmount,
        targetDate: updates.targetDate ?? goal.targetDate,
        lockInEnabled: updates.lockInEnabled ?? goal.lockInEnabled,
        milestones: updatedMilestones,
      };

      try {
        const savedGoal = await savingsGoalService.updateGoal(updatedGoal);

        if (updates.category) {
          goalCategoryStore.set(savedGoal.id, updates.category);
        }

        const response = buildGoalResponse(savedGoal, clock.now(), updates.category);
        logger.info('Savings goal updated via API', {
          userId: request.userId,
          goalId: savedGoal.id,
          targetAmount: savedGoal.targetAmount,
        });
        return ok(response);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    cancelGoal: async (request: HttpRequest<unknown, { goalId: string }>) => {
      ensureAuthenticated(request);

      const goalId = requireString(request.params.goalId, 'Goal ID is required', 'INVALID_GOAL_ID');

      let goal: SavingsGoal;
      try {
        goal = await savingsGoalService.getGoal(goalId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          throw notFound('Savings goal not found', 'GOAL_NOT_FOUND');
        }
        throw error;
      }

      if (goal.userId !== request.userId) {
        throw new HttpError(403, 'Not authorized to cancel this goal', 'UNAUTHORIZED_GOAL_ACCESS');
      }

      if (goal.status === 'completed') {
        throw badRequest('Cannot cancel completed goals', 'GOAL_ALREADY_COMPLETED', {
          status: goal.status,
          completed_at: goal.completedAt ? goal.completedAt.toISOString() : null,
        });
      }

      if (goal.status === 'cancelled') {
        throw badRequest('Goal is already cancelled', 'GOAL_ALREADY_CANCELLED', {
          status: goal.status,
          cancelled_at: goal.updatedAt.toISOString(),
        });
      }

      const now = clock.now();

      try {
        const savedGoal = await savingsGoalService.updateGoal({
          ...goal,
          status: 'cancelled',
        });

        const response = buildGoalResponse(savedGoal, now);
        logger.info('Savings goal cancelled via API', {
          userId: request.userId,
          goalId: savedGoal.id,
          savedAmount: savedGoal.currentAmount,
        });
        return ok(response);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

  deleteGoal: async (request: HttpRequest<unknown, { goalId: string }>) => {
      ensureAuthenticated(request);

      const goalId = requireString(request.params.goalId, 'Goal ID is required', 'INVALID_GOAL_ID');

      let goal: SavingsGoal;
      try {
        goal = await savingsGoalService.getGoal(goalId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          throw notFound('Savings goal not found', 'GOAL_NOT_FOUND');
        }
        throw error;
      }

      if (goal.userId !== request.userId) {
        throw new HttpError(403, 'Not authorized to delete this goal', 'UNAUTHORIZED_GOAL_ACCESS');
      }

      // Only allow deletion of completed or cancelled goals
      if (goal.status !== 'completed' && goal.status !== 'cancelled') {
        throw badRequest('Can only delete completed or cancelled goals', 'GOAL_NOT_DELETABLE', {
          status: goal.status,
          message: 'Cancel the goal first before deleting, or wait until it is completed',
        });
      }

      try {
        await savingsGoalService.deleteGoal(goalId);

        logger.info('Savings goal deleted via API', {
          userId: request.userId,
          goalId,
          status: goal.status,
          amount: goal.currentAmount,
        });

        return ok({
          goal_id: goalId,
          deleted: true,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

  async depositToGoal(request: HttpRequest<{ amount: number; source_wallet?: 'main' | 'savings' }, { goalId: string }>) {
    try {
      ensureAuthenticated(request);

      const goalId = requireString(request.params.goalId, 'Goal ID is required', 'INVALID_GOAL_ID');

      if (!request.body) {
        return {
          status: 400 as const,
          body: { error: 'Request body is required', code: 'BAD_REQUEST' },
        };
      }

      const { amount, source_wallet = 'main' } = request.body;

      if (!amount || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return {
          status: 400 as const,
          body: {
            error: 'Amount must be a positive integer (cents)',
            code: 'INVALID_AMOUNT',
          },
        };
      }

      // Validate source_wallet
      if (source_wallet !== 'main' && source_wallet !== 'savings') {
        return {
          status: 400 as const,
          body: {
            error: 'source_wallet must be either "main" or "savings"',
            code: 'INVALID_SOURCE_WALLET',
          },
        };
      }

      // Verify goal exists and belongs to user
      let goal: SavingsGoal;
      try {
        goal = await savingsGoalService.getGoal(goalId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          throw notFound('Savings goal not found', 'GOAL_NOT_FOUND');
        }
        throw error;
      }

      if (goal.userId !== request.userId) {
        throw new HttpError(403, 'Not authorized to deposit to this goal', 'UNAUTHORIZED_GOAL_ACCESS');
      }

      // Check if source wallet has sufficient balance
      const sourceWalletObj = await walletService.getWallet(request.userId, source_wallet);
      if (!sourceWalletObj) {
        return {
          status: 404 as const,
          body: {
            error: `${source_wallet === 'main' ? 'Main' : 'Savings'} wallet not found`,
            code: 'WALLET_NOT_FOUND',
          },
        };
      }

      if (sourceWalletObj.availableBalance < amount) {
        return {
          status: 402 as const,
          body: {
            error: `Insufficient funds in ${source_wallet} wallet`,
            code: 'INSUFFICIENT_FUNDS',
            available_balance: sourceWalletObj.availableBalance,
            required_amount: amount,
          },
        };
      }

      // Debit the source wallet
      await walletService.debit({
        userId: request.userId,
        walletType: source_wallet,
        amount,
      });

      // Record the contribution to the goal
      const result = await savingsGoalService.recordContribution(goalId, amount);
      const now = clock.now();

      logger.info('Deposit to savings goal completed', {
        goalId,
        amount,
        userId: request.userId,
        sourceWallet: source_wallet,
        milestonesReached: result.milestonesReached.length,
        completed: result.completed,
      });

      return {
        status: 200 as const,
        body: {
          goal: buildGoalResponse(result.goal, now),
          milestonesReached: result.milestonesReached.map((m) => buildMilestoneResponse(result.goal, m, now)),
          completed: result.completed,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to deposit to savings goal';
      logger.error('Failed to deposit to savings goal', { error: message });
      return {
        status: 500 as const,
        body: { error: message, code: 'DEPOSIT_FAILED' },
      };
    }
  },

  async withdrawFromGoal(request: HttpRequest<{ destination_wallet: 'main' | 'savings' }, { goalId: string }>) {
    try {
      ensureAuthenticated(request);

      const goalId = requireString(request.params.goalId, 'Goal ID is required', 'INVALID_GOAL_ID');

      if (!request.body) {
        return {
          status: 400 as const,
          body: { error: 'Request body is required', code: 'BAD_REQUEST' },
        };
      }

      const { destination_wallet } = request.body;

      // Validate destination_wallet
      if (destination_wallet !== 'main' && destination_wallet !== 'savings') {
        return {
          status: 400 as const,
          body: {
            error: 'destination_wallet must be either "main" or "savings"',
            code: 'INVALID_DESTINATION_WALLET',
          },
        };
      }

      // Verify goal exists and belongs to user
      let goal: SavingsGoal;
      try {
        goal = await savingsGoalService.getGoal(goalId);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          throw notFound('Savings goal not found', 'GOAL_NOT_FOUND');
        }
        throw error;
      }

      if (goal.userId !== request.userId) {
        throw new HttpError(403, 'Not authorized to withdraw from this goal', 'UNAUTHORIZED_GOAL_ACCESS');
      }

      // Only allow withdrawal from completed goals
      if (goal.status !== 'completed') {
        return {
          status: 400 as const,
          body: {
            error: 'Can only withdraw from completed goals',
            code: 'GOAL_NOT_COMPLETED',
            status: goal.status,
          },
        };
      }

      // Check if there's money to withdraw
      if (goal.currentAmount <= 0) {
        return {
          status: 400 as const,
          body: {
            error: 'No funds available to withdraw',
            code: 'NO_FUNDS_AVAILABLE',
            current_amount: goal.currentAmount,
          },
        };
      }

      const amountToWithdraw = goal.currentAmount;

      // Credit the destination wallet
      await walletService.credit({
        userId: request.userId,
        walletType: destination_wallet,
        amount: amountToWithdraw,
      });

      // Update goal to zero balance
      const updatedGoal = await savingsGoalService.updateGoal({
        ...goal,
        currentAmount: 0,
      });

      const now = clock.now();

      logger.info('Withdrawal from savings goal completed', {
        goalId,
        amount: amountToWithdraw,
        userId: request.userId,
        destinationWallet: destination_wallet,
      });

      return {
        status: 200 as const,
        body: {
          goal: buildGoalResponse(updatedGoal, now),
          amount_withdrawn: amountToWithdraw,
          destination_wallet,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to withdraw from savings goal';
      logger.error('Failed to withdraw from savings goal', { error: message });
      return {
        status: 500 as const,
        body: { error: message, code: 'WITHDRAWAL_FAILED' },
      };
    }
  },
  };
}

function parseCreateGoalBody(body: CreateSavingsGoalBody, clock: Clock) {
  const name = parseGoalName(body.name);
  const description = parseDescription(body.description);
  const targetAmount = parseTargetAmount(body.target_amount);
  const targetDate = parseTargetDate(body.target_date, clock);
  const category = parseCategory(body.category);
  const lockInEnabled = parseBooleanFlag(body.lock_in_enabled, 'lock_in_enabled');

  return {
    name,
    description,
    targetAmount,
    targetDate,
    category,
    lockInEnabled,
  };
}

function parseUpdateGoalBody(body: UpdateSavingsGoalBody, clock: Clock) {
  const parsed: Partial<{
    name: string;
    description: string | null;
    targetAmount: number;
    targetDate: Date | null;
    category: string | null;
    lockInEnabled: boolean;
  }> = {};

  if (body.name !== undefined) {
    parsed.name = parseGoalName(body.name);
  }

  if (body.description !== undefined) {
    parsed.description = parseDescription(body.description);
  }

  if (body.target_amount !== undefined) {
    parsed.targetAmount = parseTargetAmount(body.target_amount);
  }

  if (body.target_date !== undefined) {
    parsed.targetDate = parseTargetDate(body.target_date, clock);
  }

  if (body.category !== undefined) {
    parsed.category = parseCategory(body.category);
  }

  if (body.lock_in_enabled !== undefined) {
    parsed.lockInEnabled = parseBooleanFlag(body.lock_in_enabled, 'lock_in_enabled');
  }

  return parsed;
}

function parseGoalName(rawName: string | undefined | null): string {
  if (rawName === undefined || rawName === null) {
    throw badRequest('Goal name is required', 'MISSING_GOAL_NAME');
  }

  const name = rawName.trim();
  if (name.length === 0) {
    throw badRequest('Goal name cannot be empty', 'EMPTY_GOAL_NAME');
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`Goal name must be ${MAX_NAME_LENGTH} characters or less`, 'GOAL_NAME_TOO_LONG');
  }

  return name;
}

function parseDescription(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const description = raw.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw badRequest('Description must be 200 characters or less', 'DESCRIPTION_TOO_LONG');
  }
  return description.length === 0 ? null : description;
}

function parseTargetAmount(value: number | undefined): number {
  const amount = requireInteger(
    value,
    'Target amount must be in cents (integer)',
    'INVALID_AMOUNT_FORMAT',
  );

  if (amount <= 0) {
    throw badRequest('Target amount must be in cents (integer)', 'INVALID_AMOUNT_FORMAT');
  }

  if (amount < MIN_GOAL_AMOUNT) {
    throw badRequest('Minimum goal amount is KES 5.00', 'AMOUNT_TOO_LOW');
  }

  if (amount > MAX_GOAL_AMOUNT) {
    throw badRequest('Maximum goal amount is KES 1,000,000.00', 'AMOUNT_TOO_HIGH');
  }

  return amount;
}

function parseTargetDate(value: string | null | undefined, clock: Clock): Date | null {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!DATE_REGEX.test(trimmed)) {
    throw badRequest('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw badRequest('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }

  const today = clock.now();
  if (!isFutureDate(date, today)) {
    throw badRequest('Target date must be in the future', 'INVALID_TARGET_DATE');
  }

  return date;
}

function parseCategory(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const category = value.trim();
  if (category.length === 0) {
    return null;
  }

  if (category.length > 50) {
    throw badRequest('Category must be 50 characters or less', 'CATEGORY_TOO_LONG');
  }

  return category;
}

function parseBooleanFlag(value: boolean | undefined, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw badRequest(`${field} must be a boolean`, 'INVALID_BOOLEAN');
  }

  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, field: string, max?: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw badRequest(`${field} must be a positive integer`, 'INVALID_PAGINATION');
  }

  if (max && parsed > max) {
    return max;
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseStatuses(value: string | undefined): Set<string> | null {
  if (!value) {
    return null;
  }
  const statuses = value
    .split(',')
    .map((status) => status.trim())
    .filter((status) => status.length > 0);
  return statuses.length === 0 ? null : new Set(statuses);
}

function parseSortKey(value: string | undefined): 'target_date' | 'created_at' {
  if (!value) {
    return 'created_at';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'target_date') {
    return 'target_date';
  }
  return 'created_at';
}

function sortGoals(goals: SavingsGoal[], sortKey: 'target_date' | 'created_at'): SavingsGoal[] {
  return [...goals].sort((a, b) => {
    if (sortKey === 'target_date') {
      const aTime = a.targetDate ? a.targetDate.getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.targetDate ? b.targetDate.getTime() : Number.POSITIVE_INFINITY;
      if (aTime === bTime) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return aTime - bTime;
    }

    // Default: newest first
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function buildGoalResponse(goal: SavingsGoal, now: Date, categoryOverride?: string | null): Record<string, unknown> {
  const category = categoryOverride ?? goalCategoryStore.get(goal.id) ?? DEFAULT_CATEGORY;
  const progress = goal.targetAmount > 0 ? roundPercentage((goal.currentAmount / goal.targetAmount) * 100) : 0;
  const milestones = goal.milestones.map((milestone) => buildMilestoneResponse(goal, milestone, now));
  const nextMilestone = determineNextMilestone(goal, milestones, now);
  const targetDate = goal.targetDate ? formatDate(goal.targetDate) : null;
  const daysUntilTarget = goal.targetDate ? computeDaysBetween(now, goal.targetDate) : null;
  const targetDateWarning = typeof daysUntilTarget === 'number' && daysUntilTarget >= 0 && daysUntilTarget <= TARGET_WARNING_THRESHOLD_DAYS;

  const finalProgress = ARCHIVED_STATUSES.has(goal.status)
    ? {
        saved_amount: goal.currentAmount,
        target_amount: goal.targetAmount,
        progress_percentage: progress,
      }
    : null;

  return {
    goal_id: goal.id,
    name: goal.name,
    description: goal.description ?? null,
    status: goal.status,
    category,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    progress_percentage: progress,
    target_date: targetDate,
    days_until_target: daysUntilTarget,
    target_date_warning: targetDateWarning,
    lock_in_enabled: goal.lockInEnabled,
    milestones,
    next_milestone: nextMilestone,
    final_progress: finalProgress,
    created_at: goal.createdAt.toISOString(),
    updated_at: goal.updatedAt.toISOString(),
    completed_at: goal.completedAt ? goal.completedAt.toISOString() : null,
  };
}

function buildMilestoneResponse(goal: SavingsGoal, milestone: SavingsGoalMilestone, now: Date) {
  const targetAmount = milestone.amount;
  const milestoneProgress = targetAmount > 0 ? roundPercentage((goal.currentAmount / targetAmount) * 100) : 100;
  const achieved = goal.currentAmount >= targetAmount || milestone.celebrated;
  const achievedAt = achieved ? milestone.reachedAt ?? goal.completedAt ?? goal.updatedAt ?? now : null;

  return {
    milestone_id: `milestone_${milestone.percentage}_${goal.id}`,
    name: milestoneName(milestone.percentage),
    percentage: milestone.percentage,
    target_amount: targetAmount,
    current_amount: Math.min(goal.currentAmount, targetAmount),
    progress_percentage: milestoneProgress > 100 ? 100 : milestoneProgress,
    achieved,
    achieved_at: achievedAt ? achievedAt.toISOString() : null,
    celebrated: achieved ? true : milestone.celebrated,
  };
}

function determineNextMilestone(
  goal: SavingsGoal,
  milestones: Array<ReturnType<typeof buildMilestoneResponse>>,
  now: Date,
) {
  const next = milestones.find((milestone) => !milestone.achieved);
  if (!next) {
    return null;
  }

  const amountRemaining = Math.max(0, next.target_amount - goal.currentAmount);
  let estimatedCompletion: number | null = null;

  if (goal.targetDate && goal.targetAmount > goal.currentAmount) {
    const totalDays = computeDaysBetween(now, goal.targetDate);
    if (typeof totalDays === 'number') {
      const totalRemaining = goal.targetAmount - goal.currentAmount;
      estimatedCompletion = totalRemaining > 0
        ? Math.max(0, Math.round((amountRemaining / totalRemaining) * totalDays))
        : 0;
    }
  }

  return {
    milestone_id: next.milestone_id,
    amount_remaining: amountRemaining,
    target_amount: next.target_amount,
    percentage: next.percentage,
    estimated_completion_days: estimatedCompletion,
  };
}

function recalculateMilestones(goal: SavingsGoal, newTargetAmount: number, now: Date): SavingsGoalMilestone[] {
  return goal.milestones.map((milestone) => {
    const updatedAmount = Math.round((newTargetAmount * milestone.percentage) / 100);
    const achieved = goal.currentAmount >= updatedAmount;
    const wasCelebrated = milestone.celebrated;

    return {
      percentage: milestone.percentage,
      amount: updatedAmount,
      reachedAt: achieved ? milestone.reachedAt ?? now : milestone.reachedAt ?? null,
      celebrated: achieved || wasCelebrated,
    };
  });
}

function findGoalByName(goals: SavingsGoal[], name: string, ignoreId?: string): SavingsGoal | undefined {
  const normalized = name.trim().toLowerCase();
  return goals.find((goal) => goal.id !== ignoreId && goal.name.trim().toLowerCase() === normalized);
}

function roundPercentage(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function computeDaysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - startOfDay(from).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function milestoneName(percentage: number): string {
  if (percentage === 100) {
    return 'Goal Complete';
  }
  return `${percentage}% Milestone`;
}

function formatDate(date: Date): string {
  const [day] = date.toISOString().split('T');
  return day ?? date.toISOString();
}

function isFutureDate(date: Date, now: Date): boolean {
  return date.getTime() > startOfDay(now).getTime();
}
