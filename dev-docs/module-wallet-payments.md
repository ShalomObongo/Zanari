# Module: Wallet & Payments

This module manages the core financial capabilities of the Zanari application, including wallet balances, external payments (Paystack), peer-to-peer transfers, and withdrawals.

## User Journey

1.  **Wallet Overview**: Users can view their "Main" (Spending) and "Savings" wallet balances.
2.  **Top Up**: Users fund their wallet via M-Pesa or Card (processed by Paystack).
3.  **Pay Merchant**: Users pay external merchants (Till/Paybill) directly from their Main wallet.
4.  **Send Money**:
    -   **P2P (Internal)**: Instant, free transfers to other Zanari users.
    -   **P2P (External)**: Transfers to mobile money or bank accounts via Paystack.
5.  **Withdraw**: Users cash out funds from their Main wallet to their mobile money.
6.  **Internal Transfers**: Users move money between their Main and Savings wallets.

## Backend Implementation

### Services

#### `WalletService` (`api/src/services/WalletService.ts`)
Manages the ledger for user wallets.

-   **`credit(userId, walletType, amount)`**: Increases balance.
-   **`debit(userId, walletType, amount)`**: Decreases balance. Throws if insufficient funds.
-   **`transferRoundUp(userId, amount)`**: Atomic transfer from Main to Savings for round-up features.
-   **`getWallet(userId, type)`**: Retrieves wallet state.

#### `PaymentService` (`api/src/services/PaymentService.ts`)
Orchestrates complex payment flows involving external providers.

-   **`payMerchant(request)`**:
    -   Calculates potential **Round-Up**.
    -   Debits user's Main wallet.
    -   Initializes Paystack transaction.
    -   Creates a `payment` transaction record.
    -   If round-up applies, triggers `walletService.transferRoundUp` and creates a `round_up` transaction.
    -   **Failure Handling**: Reverses wallet debits if Paystack initialization fails.

-   **`transferPeer(request)`** (External):
    -   Creates a Paystack Transfer Recipient.
    -   Debits Main wallet.
    -   Initiates Paystack Transfer.
    -   Records `transfer_out` transaction.

-   **`transferPeerInternal(request)`** (Internal):
    -   **Zero Fees**.
    -   Atomic transaction: Debit Sender -> Credit Recipient.
    -   Creates linked `transfer_out` (Sender) and `transfer_in` (Recipient) records.
    -   Applies Round-Up logic to the sender.

-   **`initializeDeposit(request)`**:
    -   Starts a Paystack checkout session for incoming funds.
    -   Does **not** credit wallet immediately (waits for Webhook).

### Data Model

-   **`wallets` Table**:
    -   `wallet_type`: 'main' or 'savings'.
    -   `balance`: Ledger balance in cents.
    -   `available_balance`: Spendable balance (may differ if funds are locked).
-   **`transactions` Table**:
    -   `type`: `payment`, `transfer_in`, `transfer_out`, `deposit`, `withdrawal`.
    -   `external_reference`: Paystack reference.
    -   `round_up_details`: JSONB storing round-up metadata.

## Frontend Implementation

### State Management (`src/store/walletStore.ts`)
The `useWalletStore` manages local wallet state and optimistic updates.

-   **State**:
    -   `wallets`: Array of wallet objects.
    -   `pendingWithdrawals`: Tracks withdrawals that are processing.
-   **Actions**:
    -   `fetchWallets()`: Syncs with backend.
    -   `withdraw(amount, pin)`: Initiates withdrawal.
    -   `transferToSavings(amount)`: Optimistically updates balances (Main - amount, Savings + amount) for instant UI feedback.
    -   `transferFromSavings(amount)`: Inverse of above.

### Key Features

-   **Optimistic UI**: Internal transfers update the UI immediately before the API response confirms, providing a snappy experience.
-   **Round-Up Integration**: Payments automatically calculate and display the "Round Up" amount that will be saved.
-   **Security**: All sensitive actions (Withdraw, Transfer) require a **PIN Token** obtained via `authStore.verifyPin`.

## API Endpoints

-   `GET /wallets`: List user wallets.
-   `POST /wallets/:id/withdraw`: Cash out.
-   `POST /wallets/transfer-to-savings`: Internal move.
-   `POST /wallets/transfer-from-savings`: Internal move.
-   `POST /payments/merchant`: Pay Bill/Till.
-   `POST /payments/transfer`: P2P Transfer.
-   `POST /payments/topup`: Fund wallet.
