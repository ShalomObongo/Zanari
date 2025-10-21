/**
 * Savings goal domain model capturing user savings objectives.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type SavingsGoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface SavingsGoalMilestone {
  percentage: number;
  amount: number;
  reachedAt?: Date | null;
  celebrated: boolean;
}

export interface SavingsGoal extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date | null;
  completedAt?: Date | null;
  status: SavingsGoalStatus;
  lockInEnabled: boolean;
  milestones: SavingsGoalMilestone[];
}

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  status: SavingsGoalStatus;
  lock_in_enabled: boolean;
  milestones?: Array<{
    percentage: number;
    amount: number;
    reached_at?: string | null;
    celebrated: boolean;
  }>;
}

export interface CreateSavingsGoalInput {
  id: UUID;
  userId: UUID;
  name: string;
  targetAmount: number;
  currentAmount?: number;
  description?: string | null;
  targetDate?: Date | null;
  lockInEnabled?: boolean;
}

function validateMilestone(milestone: SavingsGoalMilestone): void {
  assert(milestone.percentage >= 0 && milestone.percentage <= 100, 'Milestone percentage must be 0-100');
  assert(Number.isInteger(milestone.amount), 'Milestone amount stored in cents');
}

export function validateSavingsGoal(goal: SavingsGoal): void {
  assert(goal.name.length > 0 && goal.name.length <= 50, 'Goal name must be 1-50 characters');
  assert(Number.isInteger(goal.targetAmount) && goal.targetAmount > 0, 'Target amount must be positive integer');
  assert(Number.isInteger(goal.currentAmount) && goal.currentAmount >= 0, 'Current amount must be non-negative integer');
  assert(goal.currentAmount <= goal.targetAmount, 'Current amount cannot exceed target amount');
  if (goal.targetDate) {
    assert(goal.targetDate.getTime() > Date.now(), 'Target date must be in the future');
  }
  const percentages = new Set<number>();
  goal.milestones.forEach((milestone) => {
    validateMilestone(milestone);
    assert(!percentages.has(milestone.percentage), 'Milestone percentages must be unique');
    percentages.add(milestone.percentage);
  });
}

export function createSavingsGoal(input: CreateSavingsGoalInput): SavingsGoal {
  const now = new Date();
  const milestones: SavingsGoalMilestone[] = [25, 50, 75, 100].map((percentage) => ({
    percentage,
    amount: Math.round((input.targetAmount * percentage) / 100),
    reachedAt: null,
    celebrated: false,
  }));

  const goal: SavingsGoal = {
    id: input.id,
    userId: input.userId,
    name: input.name.trim(),
    description: input.description ?? null,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount ?? 0,
    targetDate: input.targetDate ?? null,
    completedAt: null,
    status: 'active',
    lockInEnabled: input.lockInEnabled ?? false,
    milestones,
    createdAt: now,
    updatedAt: now,
  };

  validateSavingsGoal(goal);
  return goal;
}

export function fromRow(row: SavingsGoalRow): SavingsGoal {
  const goal: SavingsGoal = {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    targetDate: row.target_date ? new Date(row.target_date) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    status: row.status,
    lockInEnabled: row.lock_in_enabled,
    milestones: (row.milestones ?? []).map((milestone) => ({
      percentage: milestone.percentage,
      amount: milestone.amount,
      reachedAt: milestone.reached_at ? new Date(milestone.reached_at) : null,
      celebrated: milestone.celebrated,
    })),
  };

  validateSavingsGoal(goal);
  return goal;
}

export function toRow(goal: SavingsGoal): SavingsGoalRow {
  validateSavingsGoal(goal);

  return {
    id: goal.id,
    user_id: goal.userId,
    name: goal.name,
    description: goal.description ?? null,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    target_date: goal.targetDate ? goal.targetDate.toISOString().split('T')[0] : null,
    created_at: goal.createdAt.toISOString(),
    updated_at: goal.updatedAt.toISOString(),
    completed_at: goal.completedAt ? goal.completedAt.toISOString() : null,
    status: goal.status,
    lock_in_enabled: goal.lockInEnabled,
    milestones: goal.milestones.map((milestone) => ({
      percentage: milestone.percentage,
      amount: milestone.amount,
      reached_at: milestone.reachedAt ? milestone.reachedAt.toISOString() : null,
      celebrated: milestone.celebrated,
    })),
  };
}
