import type { QueryClient } from '@tanstack/react-query';

import { runFullBackgroundSync } from '@/lib/background-sync/sync';

/** Centralized "a structural task change (create/edit/delete) just got
 * confirmed by the backend — the cached today+N-day window may now be
 * stale" hook, called from both the live mutation hooks
 * (hooks/queries/use-task-mutations.ts) and their durable replay defaults
 * (lib/mutation-defaults.ts) so it fires identically whether the mutation
 * resolved live or replayed headlessly after an app restart (see the doc
 * comment on registerMutationDefaults for why both are needed). Reuses
 * runFullBackgroundSync's existing wholesale-overwrite fetch rather than a
 * bespoke narrower one, since it already does exactly "categories + the
 * forward window + history, freshly, written straight into the live cache."
 *
 * Never rethrows: this runs inside a mutation's `onSuccess`, which
 * Mutation.execute() awaits in the same try/catch as the mutation call
 * itself — letting a refresh failure propagate would make react-query treat
 * an already-server-confirmed change as failed and roll back its optimistic
 * UI. A failure here just means the next natural trigger (foreground open,
 * reconnect, the daily background task) retries — same swallow pattern
 * already used by runForegroundSyncIfDue and lib/network.ts's catch-up. */
export async function refreshTaskCacheAfterStructuralChange(queryClient: QueryClient): Promise<void> {
  try {
    await runFullBackgroundSync(queryClient);
  } catch {
    // See doc comment above — intentionally swallowed.
  }
}
