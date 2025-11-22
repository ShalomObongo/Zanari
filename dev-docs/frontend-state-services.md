# Frontend State & Services

## State Management (Zustand)

The application uses **Zustand** for global state management. Stores are located in `src/store/`.

### Key Stores

-   **`authStore`**:
    -   Manages authentication status (token, user profile).
    -   Handles login/logout actions.
    -   Persists session data to `AsyncStorage`.
-   **`walletStore`**:
    -   Stores wallet balances and details.
    -   Actions to refresh balance and handle local updates after transfers.
-   **`transactionStore`**:
    -   Caches transaction history.
    -   Supports pagination and filtering.
-   **`themeStore`**:
    -   Manages UI theme preferences (Light/Dark mode).

### Persistence
Most stores use the `persist` middleware from Zustand to save their state to `AsyncStorage`. This ensures that data like the user session and theme preference survive app restarts.

## Services (`src/services/`)

### API Client (`api.ts`)
-   A configured **Axios** instance.
-   **Interceptors**:
    -   **Request**: Automatically attaches the `Authorization` header (Bearer token) and `X-User-Id` if available.
    -   **Response**: Handles global errors (e.g., 401 Unauthorized triggers logout).
-   **Base URL**: Dynamically resolved from `EXPO_PUBLIC_API_URL` or defaults to localhost for development.

### SyncService (`syncService.ts`)
-   **Purpose**: Handles offline-first capabilities and data synchronization.
-   **Mechanism**:
    -   Queues mutations (POST/PUT/PATCH) when the device is offline.
    -   Retries queued operations when the connection is restored.
    -   Stores the queue in `AsyncStorage`.

### Paystack Integration (`paystack.ts`)
-   Helper functions to interact with the Paystack SDK or API for initiating payments from the mobile device.
