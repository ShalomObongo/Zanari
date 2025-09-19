# 8. Epic 2: Goal Management & Visualization

**Goal:** This epic builds on the core savings engine by introducing features that make saving more purposeful and engaging. Users will be able to create specific financial goals, allocate funds towards them, and visually track their progress. This transforms the abstract act of saving into a tangible journey towards a desired outcome.

## Story 2.1: Create a Savings Goal
*As a user, I want to create a new savings goal with a name, target amount, and an optional target date, so that I can start saving for something specific.*

**Acceptance Criteria:**
1.  The user can access a "Create Goal" form from a primary UI element (e.g., a button on the dashboard).
2.  The form must allow the user to input a goal name (e.g., "New Phone"), a target amount, and optionally select a target date.
3.  The user can choose a simple icon or emoji to visually represent the goal.
4.  Upon submission, the new goal is saved and appears on the user's goal list.

## Story 2.2: View Savings Goals
*As a user, I want to see a list of all my savings goals and their progress at a glance, so that I can stay motivated.*

**Acceptance Criteria:**
1.  A dedicated "Goals" screen lists all active savings goals.
2.  Each goal in the list must display its name, the amount saved, and the target amount (e.g., "KES 5,000 / KES 20,000").
3.  A visual progress bar must show the percentage of the goal that has been completed.
4.  Tapping on a goal in the list navigates to a detailed view for that goal.

## Story 2.3: Manually Allocate Savings to Goals
*As a user, I want to manually transfer money from my main Zanari wallet to a specific savings goal, so that I can prioritize my savings.*

**Acceptance Criteria:**
1.  From a goal's detail view, the user can select an option to "Add Money".
2.  The user can specify an amount to transfer from their main wallet balance to the goal.
3.  The transfer fails with a clear error message if the main wallet has insufficient funds.
4.  On successful transfer, the goal's current saved amount is updated, and the main wallet balance is decreased accordingly.
5.  The transfer is recorded as a transaction in the main transaction history.

## Story 2.4. Basic Savings Analytics
*As a user, I want to see a simple chart of my total savings over time, so that I can understand my savings habits.*

**Acceptance Criteria:**
1.  A dedicated "Analytics" or "Progress" screen is accessible from the main navigation.
2.  This screen displays a simple line or bar chart showing the user's total savings balance over the last 30 days.
3.  The chart data is updated whenever the user's savings balance changes.
4.  The view includes at least one summary statistic, such as "Total Saved This Month" or "Average Saved Per Week".

---
