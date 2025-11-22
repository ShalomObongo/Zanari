# Database Schema

The application uses **Supabase (PostgreSQL)** as its primary data store. The schema is managed via SQL migration files located in `api/migrations/`.

## Core Tables

### `users`
-   Extends Supabase Auth.
-   Stores profile info (Name, DOB, Phone).
-   Stores KYC status (`not_started`, `pending`, `approved`, `rejected`).
-   Stores security settings (PIN hash, failed attempts).
-   Stores notification preferences (JSONB).

### `wallets`
-   Each user has exactly two wallets:
    1.  `main`: For payments and transfers.
    2.  `savings`: For round-ups and savings goals.
-   Balances are stored in **cents** (integers) to avoid floating-point errors.
-   Includes `available_balance` vs `balance` (ledger balance).

### `transactions`
-   The central ledger for all money movement.
-   **Types**: `payment`, `transfer_in`, `transfer_out`, `round_up`, `bill_payment`, `withdrawal`, `deposit`.
-   **Status**: `pending`, `completed`, `failed`, `cancelled`.
-   Stores external references (Paystack ID) and merchant info.
-   Includes retry logic fields (`retry_count`, `next_retry_at`).

### `savings_goals`
-   User-defined targets (e.g., "New Laptop").
-   Tracks `target_amount`, `current_amount`, and `target_date`.
-   Supports "Lock-in" feature to prevent early withdrawal.
-   Tracks milestones (25%, 50%, etc.) in a JSONB array.

### `round_up_rules`
-   Configures the "Round Up" feature.
-   `increment_type`: Fixed amounts (10, 50, 100) or `auto`.
-   Tracks total stats (`total_amount_saved`).

### `kyc_documents`
-   Stores metadata for uploaded identity documents.
-   Actual files are stored in Supabase Storage.
-   Includes verification status and extracted data.

## Security & RLS
-   **Row Level Security (RLS)** is enabled on all tables.
-   Policies ensure users can only access their own data (`auth.uid() = user_id`).
-   Triggers handle automatic updates (e.g., `updated_at` timestamps).

## Triggers & Functions
-   **`create_user_wallets`**: Automatically creates `main` and `savings` wallets when a new user registers.
-   **`validate_transaction_limits`**: Enforces single transaction limits (KES 5,000) and daily limits (KES 20,000).
-   **`update_savings_goal_progress`**: Updates milestones and completion status when savings balances change.
