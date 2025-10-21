/**
 * Integration Scenario: Offline Functionality and Sync
 *
 * Implements Quickstart Scenario 9 by exercising the sync queue when the app
 * goes offline, ensuring operations are cached and flushed once connectivity
 * resumes.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import syncService, { SyncOperation } from '@/services/syncService';

describe('Integration: Offline Mode (T034)', () => {
  const offlineOperationType = 'offline.test.operation';
  const capturedEvents: Array<{ event: string; operation: SyncOperation }> = [];
  const processedOperations: SyncOperation[] = [];
  const handler = jest.fn(async (operation: SyncOperation) => {
    processedOperations.push(operation);
  });
  let unsubscribe: (() => void) | null = null;

  beforeEach(async () => {
    handler.mockClear();
    capturedEvents.length = 0;
    processedOperations.length = 0;
    syncService.unregisterHandler(offlineOperationType);
    unsubscribe?.();
    unsubscribe = syncService.subscribe((event, operation) => {
      if (operation.type === offlineOperationType) {
        capturedEvents.push({ event, operation });
      }
    });
    syncService.registerHandler(offlineOperationType, handler);
    await syncService.clear();
    syncService.setOnlineStatus(true);
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  it('should queue operations offline and flush when online', async () => {
    syncService.setOnlineStatus(false);

    const opA = await syncService.enqueue(offlineOperationType, { action: 'refresh' });
    const opB = await syncService.enqueue(offlineOperationType, { action: 'loadMore' });

    expect(opA.type).toBe(offlineOperationType);
    expect(opB.type).toBe(offlineOperationType);
    expect(syncService.getQueueSnapshot()).toHaveLength(2);

    // Offline flush should be a no-op.
    const offlineResults = await syncService.flush();
    expect(offlineResults).toHaveLength(0);
    expect(handler).not.toHaveBeenCalled();

    // Restore connectivity and flush pending operations.
  syncService.setOnlineStatus(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const onlineResults = await syncService.flush();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(onlineResults.every((result) => result.success)).toBe(true);
    expect(syncService.getQueueSnapshot()).toHaveLength(0);

  const processedIds = processedOperations.map((operation) => operation.id);
  expect(processedIds).toEqual([opA.id, opB.id]);

    const processedEvents = capturedEvents.filter((entry) => entry.event === 'operation:processed');
    expect(processedEvents).toHaveLength(2);
  });
});
