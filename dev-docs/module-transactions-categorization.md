# Module: Transactions & Categorization

This module handles the recording, retrieval, and classification of all financial activities within the app. It ensures a complete audit trail and provides users with insights into their spending habits.

## User Journey

1.  **View History**: User opens the app and sees a list of recent transactions on the dashboard.
2.  **Filter & Search**: User navigates to "All Transactions" to filter by type (Payment, Transfer) or Category (Groceries, Transport).
3.  **Auto-Categorization**: When a payment is made (e.g., to "Naivas Supermarket"), the system automatically tags it as "Groceries".
4.  **Manual Retagging**: If the system gets it wrong, the user can tap the transaction and change the category (e.g., from "Groceries" to "Entertainment").
5.  **Spending Insights**: (Future) Users view charts showing spending breakdown by category.

## Backend Implementation

### Service: `TransactionService` (`api/src/services/TransactionService.ts`)
Manages the lifecycle and integrity of transaction records.

-   **`create(options)`**:
    -   Enforces **Limits**: Checks Single Transaction Limit (KES 5,000) and Daily Limit (KES 20,000).
    -   Records the transaction with an initial status (usually `pending` or `completed`).
-   **`list(options)`**:
    -   Retrieves transactions with pagination (`limit`, `offset`).
    -   Supports filtering by `type` and `category`.
-   **`markStatus(transaction, status)`**:
    -   Updates the status (e.g., `pending` -> `completed` or `failed`).
    -   Sets `completedAt` timestamp.

### Service: `CategorizationService` (`api/src/services/CategorizationService.ts`)
Intelligent tagging engine.

-   **`autoCategorizeTransaction(options)`**:
    -   Called after a transaction is created.
    -   Uses `classify()` logic to determine the category.
    -   Updates the transaction record if a match is found.
-   **`classify(input)`**:
    -   **Keyword Matching**: Checks merchant name/description against a map of keywords (e.g., "Uber" -> Transport, "KPLC" -> Utilities).
    -   **Heuristics**: Large amounts (> KES 50k) might default to "School Fees" or "Business" if unknown.
-   **`manualCategorize(options)`**:
    -   Allows user override.
    -   Sets `autoCategorized = false` to prevent future overwrites by the system for that specific record.

### Data Model

-   **`transactions` Table**:
    -   `type`: Enum (`payment`, `transfer_in`, `transfer_out`, `round_up`, etc.).
    -   `category`: Enum (`groceries`, `transport`, `utilities`, etc.).
    -   `merchant_info`: JSONB containing Name, Till Number, etc.
    -   `auto_categorized`: Boolean flag.

## Frontend Implementation

### State Management (`src/store/transactionStore.ts`)
The `useTransactionStore` manages the transaction history feed.

-   **State**:
    -   `transactions`: List of loaded transactions.
    -   `pagination`: Tracks `offset` and `has_more` for infinite scrolling.
    -   `filters`: Active filters applied by the user.
-   **Actions**:
    -   `fetchTransactions()`: Loads the initial page.
    -   `loadMoreTransactions()`: Fetches the next page and appends to the list.
    -   `updateTransactionCategory(id, category)`: Optimistically updates the category in the UI while calling the API.

### UI Integration
-   **Transaction List**: A reusable component displaying icons, merchant names, dates, and amounts.
-   **Infinite Scroll**: Automatically triggers `loadMoreTransactions` when reaching the bottom.
-   **Category Picker**: A modal allowing users to select a new category for a transaction.

## API Endpoints

-   `GET /transactions`: List with pagination/filtering.
-   `GET /transactions/:id`: Get details.
-   `PATCH /transactions/:id/category`: Update category.
-   `GET /transactions/categories`: List available categories.
