import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateMutation,
  defaultShouldDehydrateQuery,
  type QueryClient,
} from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

import { cancelAllTaskReminders } from '@/lib/notifications';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'SOULSHIELD_QUERY_CACHE',
  throttleTime: 1000,
});

// Bump whenever a persisted query/mutation's data shape changes, to
// force-invalidate stale cache instead of shipping a runtime crash from a
// shape mismatch against old persisted data.
// Exported so lib/background-sync/sync.ts can stamp the same buster onto the
// PersistedClient it writes directly (bypassing PersistQueryClientProvider,
// since that's a React component and the background task runs headlessly) —
// a mismatched buster would make the live app discard the fresh sync on next
// restore, thinking it came from a stale build.
export const PERSIST_BUSTER = 'v1';

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: PERSIST_BUSTER,
  dehydrateOptions: {
    // `me` is cached explicitly via SecureStore (see context/auth-context.tsx)
    // rather than through the generic persister, since auth bootstrap needs a
    // synchronously-available fallback that doesn't race the persister's async
    // restore.
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== 'me',
    // Paused mutations (queued while offline) must survive persistence so
    // they can be replayed after an app kill+relaunch.
    shouldDehydrateMutation: (mutation) =>
      defaultShouldDehydrateMutation(mutation) || mutation.state.isPaused,
  },
};

/** Number of mutations queued offline (paused, not yet sent) — surfaced so
 * callers can warn before wiping them out, since clearing the cache discards
 * any queued-but-unsynced change (e.g. an offline delete/edit) rather than
 * sending it. */
export function countPendingMutations(queryClient: QueryClient): number {
  return queryClient
    .getMutationCache()
    .getAll()
    .filter((mutation) => mutation.state.isPaused).length;
}

/** Wipes every locally cached/persisted query and mutation, plus every
 * locally scheduled task reminder — the "offline data" a user might want to
 * reclaim storage from or force a clean re-sync of. Reminders are scheduled
 * via expo-notifications and tracked in their own AsyncStorage key (see
 * lib/notifications.ts), entirely separate from the react-query cache this
 * persister manages — clearing only the query cache would leave already
 * scheduled notifications firing for tasks the app now has no record of.
 * Any task still active on the server gets its reminder naturally
 * re-scheduled next time task data is fetched (see
 * hooks/use-task-reminders-sync.ts's self-heal), so this is safe to do
 * unconditionally rather than trying to work out which reminders are
 * "stale" first.
 *
 * Does not touch the auth session: `me` is cached separately via
 * SecureStore (see context/auth-context.tsx), not through this persister, so
 * clearing this never signs the user out. Any still-paused (unsynced)
 * mutation is discarded rather than sent — check countPendingMutations
 * first and warn the user if that matters. */
export async function clearOfflineCache(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await Promise.all([persister.removeClient(), cancelAllTaskReminders()]);
}
