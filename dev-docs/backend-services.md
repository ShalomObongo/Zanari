# Backend Services

This document outlines the key services in the backend and their responsibilities.

## Core Services

### AuthService
-   **Responsibility**: Manages user authentication and session handling.
-   **Key Functions**: Login, Registration, OTP verification, PIN setup/verification.
-   **Dependencies**: `UserRepository`, `AuthSessionRepository`, `OtpSender`, `PinHasher`.

### WalletService
-   **Responsibility**: Manages user wallets and balances.
-   **Key Functions**: Creating wallets, processing withdrawals, internal transfers (e.g., to savings).
-   **Dependencies**: `WalletRepository`.

### TransactionService
-   **Responsibility**: Records and retrieves transaction history.
-   **Key Functions**: Logging transactions, listing user transactions, categorizing transactions.
-   **Dependencies**: `TransactionRepository`.

### PaymentService
-   **Responsibility**: Orchestrates money movement and external payment processing.
-   **Key Functions**:
    -   `previewTransfer`: Calculates fees and final amounts.
    -   `verifyPayment`: Verifies Paystack transactions.
    -   `transferPeer`: Handles P2P transfers between users.
    -   `topUpWallet`: Handles wallet funding.
-   **Dependencies**: `PaystackClient`, `WalletService`, `TransactionService`.

### SavingsGoalService
-   **Responsibility**: Manages user savings goals.
-   **Key Functions**: Creating goals, tracking progress, processing deposits/withdrawals for specific goals.
-   **Dependencies**: `SavingsGoalRepository`.

### KYCService
-   **Responsibility**: Handles Know Your Customer (KYC) compliance.
-   **Key Functions**: Uploading documents, tracking verification status.
-   **Dependencies**: `KYCDocumentRepository`.

## Support Services

### AutoAnalyzeService
-   **Responsibility**: Analyzes transaction patterns to suggest or trigger round-ups.
-   **Dependencies**: `TransactionRepository`, `RoundUpRuleRepository`.

### CategorizationService
-   **Responsibility**: Assigns categories to transactions based on merchant data or user rules.

### NotificationService
-   **Responsibility**: Abstract interface for sending user notifications (Push, Email, SMS).
-   **Implementations**: `ConsoleNotificationService` (Dev), others can be added.

### OtpSender
-   **Responsibility**: Abstract interface for delivering One-Time Passwords.
-   **Implementations**: `SmtpOtpSender` (Email), `SupabaseOtpSender` (Native), `ConsoleOtpSender` (Dev).

### PinHasher
-   **Responsibility**: Securely hashes and verifies transaction PINs.
-   **Implementation**: `CryptoPinHasher`.
