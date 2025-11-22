# Module: Savings Goals

This module allows users to create, track, and manage specific financial targets. It encourages saving by visualizing progress and celebrating milestones.

## User Journey

1.  **Create Goal**: User defines a goal (e.g., "New Laptop"), sets a target amount (e.g., KES 100,000), and optionally a target date.
2.  **Deposit**: User allocates funds from their **Savings Wallet** (or Main Wallet) to a specific goal.
3.  **Track Progress**: The app displays a progress bar and calculates "Days to Goal".
4.  **Milestones**: As the user saves (25%, 50%, 75%, 100%), the system records milestones and sends notifications.
5.  **Completion**: When the target is reached, the goal is marked as completed.
6.  **Withdraw**: User can move funds back to their wallet (unless "Lock-in" is enabled and the date hasn't passed).

## Backend Implementation

### Service: `SavingsGoalService` (`api/src/services/SavingsGoalService.ts`)

-   **`createGoal(input)`**:
    -   Creates a new `SavingsGoal` record.
    -   Initializes empty milestones array.
    -   Default status: `active`.

-   **`recordContribution(goalId, amount)`**:
    -   Validates amount (positive integer).
    -   Updates `currentAmount`.
    -   **Milestone Logic**: Checks if new balance crosses 25/50/75/100% thresholds. If so, adds a `SavingsGoalMilestone` to the record and triggers a notification.
    -   **Completion Logic**: If `currentAmount >= targetAmount`, updates status to `completed`.

-   **`withdrawFromGoal`** (implied in routes/controller):
    -   Checks `lockInEnabled` and `targetDate`.
    -   Decreases `currentAmount`.
    -   Credits the destination wallet.

### Data Model

-   **`savings_goals` Table**:
    -   `target_amount`: The goal target in cents.
    -   `current_amount`: The amount currently allocated to this goal.
    -   `milestones`: JSONB array storing achieved milestones (`{ percentage: 50, reachedAt: ... }`).
    -   `lock_in_enabled`: Boolean flag.

## Frontend Implementation

### State Management (`src/store/savingsStore.ts`)
The `useSavingsStore` handles the list of goals and their interactions.

-   **State**:
    -   `goals`: Array of `SavingsGoal` objects.
    -   `pagination`: Handles loading large lists of goals.
-   **Actions**:
    -   `createGoal(payload)`: Optimistically adds the new goal to the list.
    -   `depositToGoal(goalId, amount)`: Calls API and updates the specific goal's progress in the local store.
    -   `withdrawFromGoal(goalId)`: Moves funds out of the goal.
    -   `getTotalAllocatedToGoals()`: Helper to calculate how much of the Savings Wallet balance is "reserved" for goals.

### UI Integration
-   **Savings Screen**: Displays a list of active goals.
-   **Goal Details**: Shows a progress ring/bar, recent history, and "Deposit/Withdraw" buttons.
-   **Confetti**: The frontend often triggers visual celebrations when the API returns `milestonesReached`.

## API Endpoints

-   `GET /savings-goals`: List goals (with pagination/filtering).
-   `POST /savings-goals`: Create new goal.
-   `POST /savings-goals/:id/deposit`: Add funds.
-   `POST /savings-goals/:id/withdraw`: Remove funds.
-   `DELETE /savings-goals/:id`: Delete a goal (only if balance is 0).
