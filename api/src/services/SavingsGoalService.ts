/**
 * SavingsGoalService manages goal lifecycle, progress tracking, and milestone celebrations.
 */

import { randomUUID } from 'node:crypto';

import { UUID } from '../models/base';
import { SavingsGoal, SavingsGoalMilestone, SavingsGoalStatus, createSavingsGoal, validateSavingsGoal } from '../models/SavingsGoal';
import { Clock, Logger, NullLogger, NotificationService, SavingsGoalRepository, SystemClock } from './types';

export interface CreateGoalInput {
  userId: UUID;
  name: string;
  targetAmount: number;
  description?: string | null;
  targetDate?: Date | null;
  lockInEnabled?: boolean;
}

export interface ContributionResult {
  goal: SavingsGoal;
  milestonesReached: SavingsGoalMilestone[];
  completed: boolean;
}

export class SavingsGoalService {
  private readonly repository: SavingsGoalRepository;
  private readonly notificationService: NotificationService;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    repository: SavingsGoalRepository;
    notificationService: NotificationService;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.repository = options.repository;
    this.notificationService = options.notificationService;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async createGoal(input: CreateGoalInput): Promise<SavingsGoal> {
    const goal = createSavingsGoal({
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      targetAmount: input.targetAmount,
      description: input.description ?? null,
      targetDate: input.targetDate ?? null,
      lockInEnabled: input.lockInEnabled ?? false,
    });

    const saved = await this.repository.save(goal);
    this.logger.info('Savings goal created', { userId: goal.userId, goalId: goal.id, targetAmount: goal.targetAmount });
    return saved;
  }

  async listGoals(userId: UUID): Promise<SavingsGoal[]> {
    return this.repository.listByUser(userId);
  }

  async getGoal(goalId: UUID): Promise<SavingsGoal> {
    return this.requireGoal(goalId);
  }

  async recordContribution(goalId: UUID, amount: number): Promise<ContributionResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Contribution amount must be a positive integer (cents)');
    }

    const goal = await this.requireGoal(goalId);
    const updatedAmount = Math.min(goal.targetAmount, goal.currentAmount + amount);
    const now = this.clock.now();

    const milestonesReached: SavingsGoalMilestone[] = [];
    const updatedMilestones = goal.milestones.map((milestone) => {
      if (updatedAmount >= milestone.amount && !milestone.celebrated) {
        const reachedMilestone: SavingsGoalMilestone = {
          ...milestone,
          reachedAt: milestone.reachedAt ?? now,
          celebrated: true,
        };
        milestonesReached.push(reachedMilestone);
        return reachedMilestone;
      }
      return milestone;
    });

    let status: SavingsGoalStatus = goal.status;
    let completedAt = goal.completedAt ?? null;
    if (updatedAmount >= goal.targetAmount) {
      status = 'completed';
      completedAt = now;
    }

    const updated: SavingsGoal = {
      ...goal,
      currentAmount: updatedAmount,
      milestones: updatedMilestones,
      status,
      completedAt,
      updatedAt: now,
    };

    validateSavingsGoal(updated);
    const saved = await this.repository.save(updated);

    await Promise.all(
      milestonesReached.map((milestone) =>
        this.notificationService.notifyUser(goal.userId, {
          title: 'Savings Milestone Achieved',
          body: `You hit ${milestone.percentage}% on ${goal.name}!`,
          data: { goalId: goal.id, milestone: milestone.percentage },
        }),
      ),
    );

    if (status === 'completed' && completedAt === now) {
      await this.notificationService.notifyUser(goal.userId, {
        title: 'Goal Completed',
        body: `You reached your savings goal "${goal.name}"!`,
        data: { goalId: goal.id },
      });
    }

    this.logger.info('Savings goal contribution recorded', {
      goalId: goal.id,
      amount,
      newAmount: updatedAmount,
      completed: status === 'completed',
    });

    return {
      goal: saved,
      milestonesReached,
      completed: status === 'completed',
    };
  }

  async updateGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    validateSavingsGoal(goal);
    const saved = await this.repository.save({ ...goal, updatedAt: this.clock.now() });
    return saved;
  }

  private async requireGoal(goalId: UUID): Promise<SavingsGoal> {
    const goal = await this.repository.findById(goalId);
    if (!goal) {
      throw new Error('Savings goal not found');
    }
    return goal;
  }
}
