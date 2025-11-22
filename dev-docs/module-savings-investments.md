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
    -   Calculated on-the-fly whenever the user's position is accessed (`getSummary`, `allocate`, `redeem`).
    -   Formula: `(Invested Amount * APY * Time Elapsed) / (10000 * MS_PER_YEAR)`.
    -   Updates the `lastAccruedAt` timestamp to ensure interest isn't double-counted.

2.  **Allocation (Invest)**:
    -   Debits the **Savings Wallet** (via `WalletService`).
    -   Credits the **Investment Position**.
    -   Validates minimum investment amount (default KES 5.00).

3.  **Redemption (Withdraw)**:
    -   Debits the **Investment Position**.
    -   Credits the **Savings Wallet**.
    -   Ensures the user cannot withdraw more than they have invested.

4.  **Claiming Interest**:
    -   Moves `accruedInterest` from the position to the **Savings Wallet**.
    -   Resets `accruedInterest` to 0.

### Data Model
-   **`savings_investment_preferences`**: Stores user settings like `auto_invest_enabled` and `target_allocation_pct`.
-   **`savings_investment_positions`**: Stores the `invested_amount`, `accrued_interest`, and `last_accrued_at`.

### API Endpoints
-   `GET /investments/savings/summary`: Returns current balances, accrued interest, and projected yield.
-   `POST /investments/savings/allocate`: Move cash to investment.
-   `POST /investments/savings/redeem`: Move investment to cash.
-   `POST /investments/savings/claim-interest`: Cash out interest.
-   `POST /investments/savings/preferences`: Update auto-invest settings.

## Frontend Implementation

### Store: `useSavingsInvestmentStore`
Located in `src/store/investmentStore.ts`.

-   **State**: Holds the `summary` object (invested amount, accrued interest, etc.).
-   **Actions**: `fetchSummary`, `allocate`, `redeem`, `claimInterest`.
-   **Mapping**: Converts snake_case API responses to camelCase for the UI.

### UI Integration
-   **Dashboard**: Displays the total value (Cash + Invested + Interest) in the "Total Balance".
-   **Savings Screen**: Provides the interface to Invest, Redeem, and Claim interest. Shows a breakdown of "Cash" vs "Invested".
