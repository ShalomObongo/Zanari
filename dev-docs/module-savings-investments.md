# Feature: Savings Investments (Yield on Savings)

This module enables users to earn interest on their savings by allocating funds from their **Savings Wallet** into a **Yield Pool**.

## Overview

-   **Concept**: Users can move money between their "Cash" savings wallet and an "Invested" position.
-   **Yield**: Interest is accrued continuously based on an annual yield (default 12% APY).
-   **Liquidity**: Users can redeem (withdraw) their investment back to their savings wallet instantly.
-   **Interest Claiming**: Accrued interest sits in a separate bucket until the user explicitly "Claims" it, which moves it to the savings wallet.

## Backend Implementation

### Service: `SavingsInvestmentService`
Located in `api/src/services/SavingsInvestmentService.ts`.

#### Key Responsibilities
1.  **Interest Accrual**:
    -   **High Precision**: Uses floating-point math (no integer rounding) for internal calculations to support micro-accruals.
    -   **Batch Processing**: A background script (`scripts/accrue-interest.ts`) runs periodically to calculate and persist interest for all users.
    -   **On-Demand**: The service also calculates pending interest on-the-fly when `getSummary` is called, ensuring the UI is always up-to-date.
    -   **Formula**: `(Invested Amount * APY * Time Elapsed) / (MS_PER_YEAR)`.
    -   **Source of Truth**: Rates are fetched dynamically from the `investment_products` table.

2.  **Allocation (Invest)**:
    -   Debits the **Savings Wallet** (via `WalletService`).
    -   Credits the **Investment Position**.
    -   Creates a transaction record with type `investment_allocation` and status `completed`.
    -   Validates minimum investment amount (default KES 5.00).

3.  **Redemption (Withdraw)**:
    -   Debits the **Investment Position**.
    -   Credits the **Savings Wallet**.
    -   Creates a transaction record with type `investment_redemption` and status `completed`.
    -   Ensures the user cannot withdraw more than they have invested.

4.  **Claiming Interest**:
    -   Moves `accruedInterest` from the position to the **Savings Wallet**.
    -   **Rounding**: The high-precision accrued interest is floored to the nearest cent (integer) only at the moment of payout.
    -   Creates a transaction record with type `interest_payout` and status `completed`.
    -   Resets `accruedInterest` to 0.

### Data Model
-   **`investment_products`**: Defines available products and their dynamic APY rates (e.g., "Standard Savings" @ 12%).
-   **`savings_investment_preferences`**: Stores user settings like `auto_invest_enabled` and `target_allocation_pct`.
-   **`savings_investment_positions`**: Stores the `invested_amount`, `accrued_interest` (NUMERIC 20,10), and `last_accrued_at`.

### API Endpoints
-   `GET /investments/savings/summary`: Returns current balances, accrued interest, and projected yield.
-   `POST /investments/savings/allocate`: Move cash to investment.
-   `POST /investments/savings/redeem`: Move investment to cash.
-   `POST /investments/savings/claim-interest`: Cash out interest.
-   `POST /investments/savings/preferences`: Update auto-invest settings.
-   `GET /transactions?category=investment`: Retrieve investment history (allocations, redemptions, payouts).

## Frontend Implementation

### Store: `useSavingsInvestmentStore`
Located in `src/store/investmentStore.ts`.

-   **State**: Holds the `summary` object (invested amount, accrued interest, etc.).
-   **Actions**: `fetchSummary`, `allocate`, `redeem`, `claimInterest`.
-   **Mapping**: Converts snake_case API responses to camelCase for the UI.

### UI Integration
-   **Dashboard**: Displays the total value (Cash + Invested + Interest) in the "Total Balance".
-   **Savings Screen**: Provides the interface to Invest, Redeem, and Claim interest. Shows a breakdown of "Cash" vs "Invested".
