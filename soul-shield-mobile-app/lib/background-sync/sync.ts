import NetInfo from '@react-native-community/netinfo';
import { QueryClient, dehydrate } from '@tanstack/react-query';

import { fetchMe } from '@/api/auth';
import { getCategories } from '@/api/categories';
import { getTaskHistory, getTasks } from '@/api/tasks';
import { recordSyncOutcome } from '@/lib/background-sync/state';
import { currentDhakaDateString } from '@/lib/background-sync/time';
import { assertCategoryArray, assertTaskArray, assertUser } from '@/lib/background-sync/validate';
import { addDays } from '@/lib/date';
import { syncAllTaskReminders } from '@/lib/notifications';
import { PERSIST_BUSTER, persister } from '@/lib/persister';
import { queryKeys } from '@/lib/query-keys';
import { cachedUserStore, tokenStore } from '@/lib/secure-store';

/** Same 7-day span history.tsx defaults to — large enough to cover every
 * active recurring task at least once (recurrence_days is a subset of the
 * week) without pulling the user's entire history nightly. */
const HISTORY_WINDOW_DAYS = 6;

/** Hard ceiling per request so a stalled/slow connection fails fast instead
 * of leaving the background task (and the OS's wake-lock budget for it)
 * hanging indefinitely. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Full nightly refresh: pulls categories, today's tasks, and a rolling
 * history window fresh from the API, then re-derives reminders from that same
 * fresh data so notifications self-heal too. Called from three places: the
 * scheduled background task (task.ts) runs headlessly with no live app open,
 * so it merges the fresh data straight into the on-disk persisted cache
 * (wholesale-replacing the read-through query cache there, since nothing is
 * watching it live); the reconnect-triggered catch-up (network.ts) and the
 * dev-only manual trigger (profile.tsx) both run with the app in the
 * foreground, so they pass the app's actual mounted QueryClient so every
 * already-rendered screen picks up the refresh immediately via its normal
 * subscription — merged additively there instead of wholesale-replaced, since
 * wiping some *other* query the user is currently looking at (an admin list,
 * a different date) out from under a live screen would be a regression, not
 * a refresh.
 *
 * Deliberately does NOT touch the mutation queue: any mutation still paused
 * (an offline edit not yet sent to the server) is real, not-yet-synced user
 * data, not a stale read-cache entry — wiping it here would be data loss, not
 * a "refresh".
 *
 * Throws on any failure (network, timeout, HTTP, malformed payload) after
 * recording the outcome — callers decide how to surface/log that, but none of
 * them should let a failure here crash their own flow (see call sites).
 */
export async function runFullBackgroundSync(liveClient?: QueryClient): Promise<void> {
  const netState = await NetInfo.fetch();
  const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;
  if (!isOnline) {
    // Not a failure — just not our turn yet. Whatever triggered this call
    // (the periodic background task, or the app coming back online) will
    // naturally get another chance: the background task re-checks on its own
    // next OS-scheduled wake-up within today's sync window, and the reconnect
    // listener only fires once connectivity actually returns.
    await recordSyncOutcome('skipped-offline');
    return;
  }

  const token = await tokenStore.getToken();
  if (!token) {
    // Signed out — nothing to sync, and nothing to retry until a login
    // happens (which fetches everything fresh on its own anyway).
    await recordSyncOutcome('skipped-signed-out');
    return;
  }

  try {
    const today = currentDhakaDateString();
    const from = addDays(today, -HISTORY_WINDOW_DAYS);

    // All four requests must succeed for any of them to be written — a
    // partial batch (e.g. categories refreshed but tasks failed) would leave
    // the local cache internally inconsistent, which is worse than just
    // leaving last night's snapshot in place until the next attempt.
    const [categoriesRaw, tasksRaw, historyRaw, meRaw] = await Promise.all([
      getCategories(token, REQUEST_TIMEOUT_MS),
      getTasks(today, token, REQUEST_TIMEOUT_MS),
      getTaskHistory(from, today, token, REQUEST_TIMEOUT_MS),
      fetchMe(token, REQUEST_TIMEOUT_MS),
    ]);

    const categories = assertCategoryArray(categoriesRaw);
    const tasks = assertTaskArray(tasksRaw, 'tasks');
    const history = assertTaskArray(historyRaw, 'task history');
    const me = assertUser(meRaw);

    if (liveClient) {
      // App is mounted and online right now — write straight into it so
      // every subscribed screen re-renders with fresh data immediately.
      // PersistQueryClientProvider's own throttled save (see app/_layout.tsx)
      // persists this to disk the same way any other query update already
      // does; no separate write needed here.
      liveClient.setQueryData(queryKeys.categories, categories);
      liveClient.setQueryData(queryKeys.tasks(today), tasks);
      liveClient.setQueryData(queryKeys.taskHistory(from, today), history);
    } else {
      // No live client — dehydrating a throwaway one guarantees the fresh
      // snapshot contains exactly these three queries and nothing left over
      // from a previous run, then it replaces the on-disk read-through cache
      // wholesale (preserving only the paused-mutation queue, see above).
      const freshClient = new QueryClient();
      freshClient.setQueryData(queryKeys.categories, categories);
      freshClient.setQueryData(queryKeys.tasks(today), tasks);
      freshClient.setQueryData(queryKeys.taskHistory(from, today), history);
      const fresh = dehydrate(freshClient);

      const previous = await persister.restoreClient();
      await persister.persistClient({
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: {
          queries: fresh.queries,
          mutations: previous?.clientState.mutations ?? [],
        },
      });
    }

    // `me` is cached via SecureStore, not the react-query persister (see
    // lib/persister.ts) — updated separately for the same reason.
    await cachedUserStore.set(me);

    // Self-heals notification scheduling the same way the foreground
    // hook (use-task-reminders-sync.ts) does, so a task edited on another
    // device gets its reminder corrected here too, not just on next app open.
    await syncAllTaskReminders(history);

    await recordSyncOutcome('success');
  } catch (error) {
    await recordSyncOutcome('failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
