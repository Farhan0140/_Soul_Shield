import { useSyncExternalStore } from 'react';

import { getSyncStatusSnapshot, subscribeSyncStatus } from '@/lib/background-sync/sync-status';

/** Whether a full background sync (today + the forward offline window) is
 * currently in flight — see lib/background-sync/sync-status.ts. */
export function useBackgroundSyncStatus(): boolean {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatusSnapshot);
}
