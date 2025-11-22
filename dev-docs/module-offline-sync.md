# Module: Offline Sync

This module ensures the app remains functional during network interruptions and recovers gracefully when connectivity is restored.

## User Journey

1.  **Offline Mode**: User opens the app without internet. Cached data (from Zustand persistence) is displayed.
2.  **Action Queueing**: If the user performs an action (currently primarily data refreshes), it is queued.
3.  **Reconnection**: When the device comes back online, the app automatically processes the queue.
4.  **Background Sync**: When the app returns to the foreground, it attempts to flush the queue.

## Frontend Implementation

### Service: `syncService` (`src/services/syncService.ts`)
A robust queue manager that persists operations to `AsyncStorage`.

-   **Storage Key**: `zanari.sync.queue.v1`
-   **Queue Logic**:
    -   **FIFO**: First-In-First-Out processing.
    -   **Persistence**: Queue is saved to disk after every enqueue/dequeue to survive app restarts.
    -   **Retry Strategy**: Exponential backoff (2s, 5s, 15s, 30s, 60s) with a maximum of 5 attempts per operation.
-   **Triggers**:
    -   `AppState` change: Flushes queue when app becomes `active`.
    -   `setOnlineStatus(true)`: Flushes queue when network reachability is restored (typically driven by `NetInfo`).

### Operation Types

The service supports arbitrary string types, but standard operations include:

-   `wallet.refresh`: Reloads wallet balances.
-   `transaction.refresh`: Reloads transaction history.
-   `transaction.loadMore`: Fetches next page of transactions.
-   `savings.refresh`: Reloads savings goals.

### Handlers

Handlers are registered at runtime (usually in `App.tsx` or the service file itself).

```typescript
// Example Registration
syncService.registerHandler('wallet.refresh', async () => {
  await useWalletStore.getState().refreshWallets();
});
```

## Architecture Notes

-   **Read vs. Write**: Currently, the sync service is heavily used for *read* synchronization (refreshing stale data).
-   **Optimistic Updates**: For write operations (like creating a goal), the app currently relies on immediate server connectivity or specific store logic. Future improvements could move write mutations (e.g., `goal.create`) into this queue for true "Offline First" write capabilities.
-   **Error Handling**: If an operation fails 5 times, it is discarded and an `operation:discarded` event is emitted.

## Testing

-   **Integration Tests**: `tests/integration/test_offline_mode.test.ts` verifies that operations are queued when offline and executed when online status is toggled.
