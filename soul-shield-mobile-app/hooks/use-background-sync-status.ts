import { useSyncExternalStore } from 'react';

import { getSyncPhaseSnapshot, subscribeSyncStatus, type SyncPhase } from '@/lib/background-sync/sync-status';

/** Current background sync phase ('idle' | 'syncing' | 'synced' | 'failed')
 * — see lib/background-sync/sync-status.ts. */
export function useBackgroundSyncPhase(): SyncPhase {
  return useSyncExternalStore(subscribeSyncStatus, getSyncPhaseSnapshot);
}
