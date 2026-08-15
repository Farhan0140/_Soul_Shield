import NetInfo from '@react-native-community/netinfo';
import { QueryClient, dehydrate } from '@tanstack/react-query';

import { fetchMe } from '@/api/auth';
import { getCategories } from '@/api/categories';
import { getTaskHistory, getTasks } from '@/api/tasks';
import { recordSyncOutcome } from '@/lib/background-sync/state';
import { currentDhakaDateString } from '@/lib/background-sync/time';
import { assertCategoryArray, assertTaskArray, assertUser } from '@/lib/background-sync/validate';
import { addDays, dateRange, todayISODate } from '@/lib/date';
import { syncAllTaskReminders } from '@/lib/notifications';
import { PERSIST_BUSTER, persister } from '@/lib/persister';
import { queryKeys } from '@/lib/query-keys';
import { cachedUserStore, tokenStore } from '@/lib/secure-store';
import { pruneExpiredTaskCache } from '@/lib/background-sync/prune';
import { setSyncStatus } from '@/lib/background-sync/sync-status';

/** Same 7-day span history.tsx defaults to — large enough to cover every
 * active recurring task at least once (recurrence_days is a subset of the
 * week) without pulling the user's entire history nightly. */
const HISTORY_WINDOW_DAYS = 6;

/** How many days beyond today to keep pre-fetched so the app stays fully
 * usable (view/add/edit/delete) for that long without connectivity — the
 * offline guarantee lives entirely in this number: whatever's cached here is
 * what's available offline, nothing more. 3 gives a rolling today+3-day
 * window (today, +1, +2, +3). */
const FORWARD_WINDOW_DAYS = 3;

/** Hard ceiling per request so a stalled/slow connection fails fast instead
 * of leaving the background task (and the OS's wake-lock budget for it)
 * hanging indefinitely. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Full refresh: pulls categories, today + the next FORWARD_WINDOW_DAYS days
 * of tasks, and a rolling backward history window fresh from the API, then
 * re-derives reminders from that same fresh data so notifications self-heal
 * too. Called from four places: the scheduled background task (task.ts) runs
 * headlessly with no live app open, so it merges the fresh data straight into
 * the on-disk persisted cache (wholesale-replacing the read-through query
 * cache there, since nothing is watching it live); the reconnect-triggered
 * catch-up (network.ts), the app-open/foreground trigger
 * (runForegroundSyncIfDue below, wired from app/_layout.tsx), and the
 * dev-only manual trigger (profile.tsx) all run with the app in the
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
async function runFullBackgroundSyncInner(liveClient?: QueryClient): Promise<void> {
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
    const dhakaToday = currentDhakaDateString();
    const from = addDays(dhakaToday, -HISTORY_WINDOW_DAYS);

    // Forward window is keyed on the device-local calendar date
    // (todayISODate), not the Dhaka-anchored date above — that's what the
    // dashboard's date nav and useTasksQuery actually key their cache reads
    // on (app/(tabs)/index.tsx, lib/query-keys.ts), so this must match it
    // exactly or the prefetch would land under a key nothing ever reads.
    const forwardDates = dateRange(todayISODate(), addDays(todayISODate(), FORWARD_WINDOW_DAYS));

    // All requests must succeed for any of them to be written — a partial
    // batch (e.g. categories refreshed but tasks failed) would leave the
    // local cache internally inconsistent, which is worse than just leaving
    // last night's snapshot in place until the next attempt.
    const [categoriesRaw, forwardTasksRaw, historyRaw, meRaw] = await Promise.all([
      getCategories(token, REQUEST_TIMEOUT_MS),
      Promise.all(forwardDates.map((date) => getTasks(date, token, REQUEST_TIMEOUT_MS))),
      getTaskHistory(from, dhakaToday, token, REQUEST_TIMEOUT_MS),
      fetchMe(token, REQUEST_TIMEOUT_MS),
    ]);

    const categories = assertCategoryArray(categoriesRaw);
    const forwardTasksByDate = forwardDates.map((date, i) => ({
      date,
      tasks: assertTaskArray(forwardTasksRaw[i], `tasks ${date}`),
    }));
    const history = assertTaskArray(historyRaw, 'task history');
    const me = assertUser(meRaw);

    if (liveClient) {
      // App is mounted and online right now — write straight into it so
      // every subscribed screen re-renders with fresh data immediately.
      // PersistQueryClientProvider's own throttled save (see app/_layout.tsx)
      // persists this to disk the same way any other query update already
      // does; no separate write needed here.
      liveClient.setQueryData(queryKeys.categories, categories);
      for (const { date, tasks } of forwardTasksByDate) {
        liveClient.setQueryData(queryKeys.tasks(date), tasks);
      }
      liveClient.setQueryData(queryKeys.taskHistory(from, dhakaToday), history);
    } else {
      // No live client — dehydrating a throwaway one guarantees the fresh
      // snapshot contains exactly these queries and nothing left over from a
      // previous run, then it replaces the on-disk read-through cache
      // wholesale (preserving only the paused-mutation queue, see above).
      const freshClient = new QueryClient();
      freshClient.setQueryData(queryKeys.categories, categories);
      for (const { date, tasks } of forwardTasksByDate) {
        freshClient.setQueryData(queryKeys.tasks(date), tasks);
      }
      freshClient.setQueryData(queryKeys.taskHistory(from, dhakaToday), history);
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

// Coalesces concurrent callers onto a single in-flight run — e.g. several
// task edits that were queued offline can all resolve within the same tick
// once connectivity returns, each independently wanting a full refresh (see
// lib/task-cache-refresh.ts); without this they'd fire N redundant parallel
// fetch batches instead of one. Protects every call site (foreground open,
// reconnect catch-up, the headless daily task, the dev manual trigger, and
// the structural-change refresh), not just the newest one.
let syncInFlight: Promise<void> | null = null;

export function runFullBackgroundSync(liveClient?: QueryClient): Promise<void> {
  if (syncInFlight) return syncInFlight;
  // Toggled around the coalesced run (not inside runFullBackgroundSyncInner
  // itself) so every caller sharing this in-flight promise sees one
  // true→false transition, not one per caller — see sync-status.ts, read by
  // DateNavHeader's thin progress indicator.
  setSyncStatus(true);
  syncInFlight = runFullBackgroundSyncInner(liveClient).finally(() => {
    syncInFlight = null;
    setSyncStatus(false);
  });
  return syncInFlight;
}

/** Minimum gap between opportunistic foreground syncs — cold app launch and
 * every subsequent AppState resume both call runForegroundSyncIfDue (see
 * app/_layout.tsx), which would otherwise re-run the full sync on every tab
 * switch back into the app. Module-level (not persisted) is fine: it only
 * needs to survive for the lifetime of one app session. */
const FOREGROUND_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
let lastForegroundSyncAttemptAt = 0;

/** Entry point for "whenever I open the app / bring it to the foreground
 * with an internet connection" — the once-a-day gate on the scheduled
 * background task and the reconnect catch-up (see task.ts, network.ts) is
 * right for a full nightly refresh, but it would leave a same-day reopen
 * hours later showing stale data with no other trigger to refresh it. This
 * runs unconditionally on that cooldown instead, swallowing failures the same
 * way the reconnect catch-up does — nothing here should crash the caller's
 * own flow, and the next open/resume/reconnect gets another chance. */
export function runForegroundSyncIfDue(liveClient: QueryClient): void {
  const now = Date.now();
  if (now - lastForegroundSyncAttemptAt < FOREGROUND_SYNC_COOLDOWN_MS) return;
  lastForegroundSyncAttemptAt = now;
  // Sweep anything that's rolled outside the current window before pulling in
  // fresh data — see lib/background-sync/prune.ts for why this is safe (it
  // never touches a date a pending offline mutation might still need).
  pruneExpiredTaskCache(liveClient);
  runFullBackgroundSync(liveClient).catch(() => {
    // Failure is already recorded by runFullBackgroundSync itself.
  });
}
