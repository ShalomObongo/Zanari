/**
 * Integration Scenario: Savings Goal Creation and Progress
 *
 * Implements Quickstart Scenario 3 to ensure a user can create a savings
 * goal, observe progress from prior round-ups, and celebrate milestone
 * achievements when contributions push the goal past configured thresholds.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: Savings Goal Lifecycle (T028)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should create a goal and track milestone progress automatically', async () => {
    const { helpers, services, stubs, user } = env;

    // Simulate existing round-up savings from previous activity.
    await helpers.topUpSavingsWallet(2_000); // KES 20.00 available

    const targetAmount = 500_000; // KES 5,000.00
    const targetDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 200); // ~200 days ahead

    const goal = await helpers.createSavingsGoal({
      name: 'Emergency Fund',
      targetAmount,
      targetDate,
      lockIn: false,
    });

    expect(goal.name).toBe('Emergency Fund');
    expect(goal.targetAmount).toBe(targetAmount);
    expect(goal.currentAmount).toBe(0);
    expect(goal.lockInEnabled).toBe(false);
    expect(goal.status).toBe('active');

    // Apply prior savings toward the goal to reflect initial progress.
    await helpers.contributeToGoal(goal.id, 2_000);
    const [updatedGoal] = await services.savingsGoalService.listGoals(user.id);
    if (!updatedGoal) {
      throw new Error('Savings goal not found after contribution');
    }

    expect(updatedGoal.currentAmount).toBe(2_000);
    const initialProgress = (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100;
    expect(initialProgress).toBeCloseTo(0.4, 1);
    expect(updatedGoal.milestones.every((milestone) => milestone.celebrated === false)).toBe(true);

    // Continue saving until the first milestone (25%) is achieved.
    const contributionToMilestone = 123_000; // KES 1,230.00
    const milestoneResult = await services.savingsGoalService.recordContribution(goal.id, contributionToMilestone);

    expect(milestoneResult.completed).toBe(false);
    expect(milestoneResult.goal.currentAmount).toBe(125_000); // KES 1,250.00 total saved
    const milestonePercentages = milestoneResult.milestonesReached.map((milestone) => milestone.percentage);
    expect(milestonePercentages).toContain(25);
    expect(milestoneResult.goal.milestones.find((milestone) => milestone.percentage === 25)?.celebrated).toBe(true);

    // Notifications should include the milestone celebration.
    const notifications = helpers.listNotifications().filter((notification) => notification.userId === user.id);
    expect(notifications.some((entry) => entry.payload.title === 'Savings Milestone Achieved' && entry.payload.data?.milestone === 25)).toBe(true);

    // Later milestones remain pending.
    expect(milestoneResult.goal.milestones.filter((milestone) => milestone.celebrated).length).toBe(1);
    expect(milestoneResult.goal.status).toBe('active');
  });
});
