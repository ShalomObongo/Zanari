import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useWalletStore } from '@/store/walletStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSavingsStore } from '@/store/savingsStore';

const STORAGE_KEY = 'zanari.sync.queue.v1';
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export type SyncOperationType =
  | 'wallet.refresh'
  | 'transaction.refresh'
  | 'transaction.loadMore'
  | 'savings.refresh'
  | 'custom';

export interface SyncOperation<TPayload = unknown> {
  id: string;
  type: SyncOperationType | string;
  payload?: TPayload;
  attempts: number;
  nextRunAt: number;
  createdAt: number;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  operation: SyncOperation;
  error?: unknown;
}

type SyncHandler<TPayload = unknown> = (operation: SyncOperation<TPayload>) => Promise<void>;

type SyncServiceEventType = 'operation:queued' | 'operation:processed' | 'operation:failed' | 'operation:discarded' | 'queue:restored';

export type SyncServiceListener = (event: SyncServiceEventType, operation: SyncOperation, error?: unknown) => void;

const listeners = new Set<SyncServiceListener>();

function emit(event: SyncServiceEventType, operation: SyncOperation, error?: unknown) {
  listeners.forEach((listener) => {
    try {
      listener(event, operation, error);
    } catch (listenerError) {
      console.warn('SyncService listener error', listenerError);
    }
  });
}

const generateId = () => `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const getRetryDelay = (attempt: number): number => {
  const safe = (index: number) => RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 2_000;
  if (attempt <= 0) {
    return safe(0);
  }
  return safe(Math.min(attempt, RETRY_DELAYS_MS.length - 1));
};

class SyncServiceClass {
  private handlers = new Map<string, SyncHandler>();
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private initialized = false;
  private online = true;
  private appState: AppStateStatus = AppState.currentState;

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    this.appState = nextState;
    if (nextState === 'active' && this.online) {
      void this.flush();
    }
  };

  registerHandler(type: SyncOperationType | string, handler: SyncHandler) {
    this.handlers.set(type, handler);
  }

  unregisterHandler(type: SyncOperationType | string) {
    this.handlers.delete(type);
  }

  subscribe(listener: SyncServiceListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  setOnlineStatus(isOnline: boolean) {
    this.online = isOnline;
    if (isOnline) {
      void this.flush();
    }
  }

  async enqueue<TPayload = unknown>(type: SyncOperationType | string, payload?: TPayload): Promise<SyncOperation<TPayload>> {
    await this.ensureInitialized();

    const operation: SyncOperation<TPayload> = {
      id: generateId(),
      type,
      payload,
      attempts: 0,
      createdAt: Date.now(),
      nextRunAt: Date.now(),
    };

    this.queue.push(operation);
    await this.persistQueue();
    emit('operation:queued', operation);

    if (this.online && this.appState === 'active') {
      void this.flush();
    }

    return operation;
  }

  async flush(): Promise<SyncResult[]> {
    await this.ensureInitialized();
    if (this.isProcessing || !this.online) {
      return [];
    }

    this.isProcessing = true;
    const results: SyncResult[] = [];

    try {
      const now = Date.now();

      for (const operation of [...this.queue]) {
        if (operation.nextRunAt > now) {
          continue;
        }

        const handler = this.handlers.get(operation.type);
        if (!handler) {
          await this.removeOperation(operation.id);
          emit('operation:discarded', operation);
          results.push({ success: true, operation });
          continue;
        }

        try {
          await handler(operation);
          await this.removeOperation(operation.id);
          emit('operation:processed', operation);
          results.push({ success: true, operation });
        } catch (error) {
          operation.attempts += 1;
          operation.lastError = error instanceof Error ? error.message : String(error);

          if (operation.attempts >= MAX_ATTEMPTS) {
            await this.removeOperation(operation.id);
            emit('operation:discarded', operation, error);
            results.push({ success: false, operation, error });
          } else {
            const delay = getRetryDelay(operation.attempts);
            operation.nextRunAt = Date.now() + delay;
            emit('operation:failed', operation, error);
          }
        }
      }

      await this.persistQueue();
      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  async clear() {
    this.queue = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  getQueueSnapshot(): SyncOperation[] {
    return [...this.queue];
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SyncOperation[] = JSON.parse(raw);
        this.queue = parsed.map((op) => ({
          ...op,
          nextRunAt: typeof op.nextRunAt === 'number' ? op.nextRunAt : Date.now(),
        }));
        if (this.queue.length > 0) {
          const firstOperation = this.queue[0];
          if (firstOperation) {
            emit('queue:restored', firstOperation);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to restore sync queue', error);
      this.queue = [];
    } finally {
      this.initialized = true;
    }
  }

  private async removeOperation(operationId: string) {
    this.queue = this.queue.filter((op) => op.id !== operationId);
  }

  private async persistQueue() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to persist sync queue', error);
    }
  }
}

export const syncService = new SyncServiceClass();

syncService.registerHandler('wallet.refresh', async () => {
  await useWalletStore.getState().refreshWallets();
});

syncService.registerHandler('savings.refresh', async () => {
  await useSavingsStore.getState().refreshGoals();
});

syncService.registerHandler('transaction.refresh', async () => {
  await useTransactionStore.getState().refreshTransactions();
});

syncService.registerHandler('transaction.loadMore', async () => {
  const { pagination } = useTransactionStore.getState();
  if (pagination.has_more) {
    await useTransactionStore.getState().loadMoreTransactions();
  }
});

void syncService.flush();

export default syncService;
