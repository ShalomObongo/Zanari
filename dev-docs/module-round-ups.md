# Module: Round-Ups

This module implements the "micro-savings" feature, allowing users to automatically save small amounts with every transaction.

## User Journey

1.  **Enable Round-Ups**: User navigates to settings and enables the feature.
2.  **Select Strategy**: User chooses a rounding increment:
    -   **Nearest 10**: KES 123 -> Save KES 7 (Total KES 130).
    -   **Nearest 50**: KES 123 -> Save KES 27 (Total KES 150).
    -   **Nearest 100**: KES 123 -> Save KES 77 (Total KES 200).
    -   **Auto**: The system analyzes spending habits to pick an optimal amount.
3.  **Transact**: User pays a merchant or sends money.
4.  **Automatic Save**: The app calculates the round-up amount and instantly moves it from the **Main Wallet** to the **Savings Wallet**.
5.  **Track**: User sees "Total Saved via Round-Ups" in their dashboard.

## Backend Implementation

### Service: `RoundUpService` (`api/src/services/RoundUpService.ts`)
Contains the core calculation logic.

-   **`calculateRoundUp(amount, rule)`**:
    -   Input: Transaction amount (cents), User Rule.
    -   Output: `roundUpAmount` (cents).
    -   Logic: `target - (amount % target)`. If remainder is 0, round up is 0.
    -   **Auto Logic**: Uses `autoSettings` (min/max increment) and scales based on transaction size (small tx -> small round up, large tx -> large round up).

### Service: `AutoAnalyzeService` (`api/src/services/AutoAnalyzeService.ts`)
Intelligent background service for the "Auto" strategy.

-   **`analyze(userId)`**:
    -   Scans recent transactions (last 30 days).
    -   Calculates average spend and standard deviation.
    -   **Heuristic**:
        -   Avg < KES 50: Increment 10.
        -   Avg < KES 200: Increment 50.
        -   Avg > KES 500: Increment 100 or 200.
    -   Updates the user's `RoundUpRule` with the recommended settings.

### Integration in Payments
The `PaymentService` calls `calculateRoundUp` before processing any debit or initialization.

1.  **Wallet Payments (Merchant/Internal P2P)**:
    -   **Check Balance**: Ensures `MainWallet` has enough for `TransactionAmount + RoundUpAmount`.
    -   **Execute**: Debit Main (Total) -> Credit Savings (RoundUp) -> Process Payment.

2.  **External Payments (M-Pesa/Card -> Recipient)**:
    -   **Calculation**: Round-up is calculated on `TransactionAmount + Fee`.
    -   **Charge**: The user is charged `TransactionAmount + Fee + RoundUpAmount` via Paystack.
    -   **Settlement**: On success, the `RoundUpAmount` is credited to the user's Savings Wallet.

3.  **Record**: Creates a primary transaction (`payment` or `transfer_out`) and a linked secondary transaction (`round_up`).

### Data Model

-   **`round_up_rules` Table**:
    -   `increment_type`: Enum ('10', '50', '100', 'auto').
    -   `is_enabled`: Boolean.
    -   `total_amount_saved`: Aggregate counter.
    -   `auto_settings`: JSONB for Auto strategy parameters.

## Frontend Implementation

### State Management (`src/store/roundUpStore.ts`)
The `useRoundUpStore` manages the user's configuration.

-   **State**:
    -   `rule`: The current active configuration.
    -   `analysis`: Results from the `AutoAnalyzeService` (spending patterns, potential savings).
-   **Actions**:
    -   `fetchRule()`: Get current settings.
    -   `updateRule(updates)`: Change strategy or toggle on/off.
    -   `fetchAnalysis()`: Trigger a new analysis to see "Potential Savings".

### UI Integration
-   **Settings Screen**: Toggle switch and strategy selector.
-   **Transaction Receipt**: Shows "You saved KES X.XX with this transaction!".
-   **Dashboard**: Displays total round-up savings.

## API Endpoints

-   `GET /round-up-rules`: Get current rule.
-   `PUT /round-up-rules`: Update rule.
-   `GET /round-up-rules/auto-analysis`: Trigger analysis.
