import NetInfo from '@react-native-community/netinfo';
import { QueryClient, dehydrate } from '@tanstack/react-query';

import { fetchMe } from '@/api/auth';
import { getSurahList, getVerse, type Verse } from '@/api/quran-content';
import { recordSyncOutcome } from '@/lib/background-sync/state';
import { assertUser } from '@/lib/background-sync/validate';
import { pickDailyVerseRef } from '@/lib/daily-verse';
import { addDays, dateRange, todayISODate } from '@/lib/date';
import { listAllActiveTasksForReminders } from '@/lib/db/tasks-repo';
import { pullLocalDatabase } from '@/lib/background-sync/pull';
import { syncAllTaskReminders } from '@/lib/notifications';
import { PERSIST_BUSTER, persister } from '@/lib/persister';
import { queryKeys } from '@/lib/query-keys';
import { cachedUserStore, tokenStore } from '@/lib/secure-store';
import { setSyncPhase } from '@/lib/background-sync/sync-status';

/** How many days beyond today to keep the "verse of the day" pre-fetched
 * (see components/dashboard/daily-verse-card.tsx) - unrelated to task/
 * category data now that those are local-first (see pullLocalDatabase
 * below); this is the one piece of plain server content this sync still
 * needs to fetch a date range for. */
const VERSE_PREFETCH_DAYS = 3;

/** Hard ceiling per request so a stalled/slow connection fails fast instead
 * of leaving the background task (and the OS's wake-lock budget for it)
 * hanging indefinitely. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Fetches the forward-window's worth of "verse of the day" entries in one
 * pass (see components/dashboard/daily-verse-card.tsx) — a single surah-list
 * fetch shared across every date, then one verse fetch per date. Callers
 * treat a failure here as non-fatal (see runFullBackgroundSyncInner): the
 * third-party quranapi.pages.dev API being slow or unreachable must never
 * block or abort the sync pull that the offline guarantee actually depends
 * on. */
async function prefetchDailyVerses(
  dates: string[],
  timeoutMs: number
): Promise<{ date: string; verse: Verse }[]> {
  const surahs = await getSurahList(timeoutMs);
  return Promise.all(
    dates.map(async (date) => {
      const { surahNo, ayahNo } = pickDailyVerseRef(surahs, date);
      const verse = await getVerse(surahNo, ayahNo, timeoutMs);
      return { date, verse };
    })
  );
}

/** Full refresh: delta-pulls every task/category/sub-task/completion change
 * into the on-device SQLite store (see lib/background-sync/pull.ts) — the
 * source every read hook now derives from (see hooks/queries/use-tasks.ts) —
 * then re-derives reminders from that same fresh local state so
 * notifications self-heal too. Called from four places: the scheduled
 * background task (task.ts) runs headlessly with no live app open;
 * the reconnect-triggered catch-up (network.ts), the app-open/foreground
 * trigger (runForegroundSyncIfDue below, wired from app/_layout.tsx), and
 * the dev-only manual trigger (profile.tsx) all run with the app in the
 * foreground, so they pass the app's actual mounted QueryClient so every
 * already-rendered screen picks up the refresh immediately (invalidated
 * below, re-reading instantly from SQLite).
 *
 * Deliberately does NOT touch the mutation queue: any mutation still paused
 * (an offline edit not yet sent to the server) is real, not-yet-synced user
 * data, not a stale read-cache entry — wiping it here would be data loss, not
 * a "refresh".
 *
 * Throws on any failure in the local-first pull (network, timeout, HTTP,
 * malformed payload) after recording the outcome — callers decide how to
 * surface/log that, but none of them should let a failure here crash their
 * own flow (see call sites). `me` and the daily-verse prefetch stay
 * independent/best-effort (see their own .catch(() => null) below) — a slow
 * or unreachable third-party verse API must never abort the sync pull the
 * offline guarantee actually depends on. pullLocalDatabase itself resolves
 * (doesn't throw) when the local DB genuinely isn't open yet on this device
 * (pre-native-rebuild) or the user is signed out — those are "not our turn
 * yet", not failures.
 */
async function runFullBackgroundSyncInner(liveClient?: QueryClient): Promise<void> {
  const netState = await NetInfo.fetch();
  const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;
  if (!isOnline) {
    // Not a failure — just not our turn yet. Whatever triggered this call
    // (the periodic background task, or the app coming back online) will
    // naturally get another chance: the background task re-checks on its own
    // next OS-scheduled wake-up within today's sync window, and the reconnect
    // listener only fires once connectivity actually returns. Back to
    // 'idle' rather than 'synced'/'failed' - nothing was actually attempted.
    setSyncPhase('idle');
    await recordSyncOutcome('skipped-offline');
    return;
  }

  const token = await tokenStore.getToken();
  if (!token) {
    // Signed out — nothing to sync, and nothing to retry until a login
    // happens (which fetches everything fresh on its own anyway).
    setSyncPhase('idle');
    await recordSyncOutcome('skipped-signed-out');
    return;
  }

  try {
    // Forward window is keyed on the device-local calendar date
    // (todayISODate), matching what the daily-verse card actually reads
    // (hooks/queries/use-daily-verse.ts, lib/query-keys.ts).
    const verseDates = dateRange(todayISODate(), addDays(todayISODate(), VERSE_PREFETCH_DAYS));

    const localDbPullPromise = pullLocalDatabase();
    const mePromise = fetchMe(token, REQUEST_TIMEOUT_MS).catch(() => null);
    const versesPromise = prefetchDailyVerses(verseDates, REQUEST_TIMEOUT_MS).catch(() => null);

    await localDbPullPromise;
    const meRaw = await mePromise;
    const me = meRaw ? assertUser(meRaw) : null;
    const verses = await versesPromise;

    if (liveClient) {
      // App is mounted and online right now — invalidate so every
      // already-mounted screen re-reads (instantly, from SQLite) with the
      // just-pulled state. Categories/tasks/history/myTasks are SQLite-backed
      // now (see lib/persister.ts), so there's nothing to setQueryData here.
      liveClient.invalidateQueries({ queryKey: ['tasks'] });
      liveClient.invalidateQueries({ queryKey: ['taskHistory'] });
      liveClient.invalidateQueries({ queryKey: ['myTasks'] });
      liveClient.invalidateQueries({ queryKey: queryKeys.categories });
      if (verses) {
        for (const { date, verse } of verses) {
          liveClient.setQueryData(queryKeys.dailyVerse(date), verse);
        }
      }
    } else if (verses) {
      // No live client — dailyVerse is the one query this sync still persists
      // directly (categories/tasks/history/myTasks are SQLite-backed, not
      // AsyncStorage-persisted - see lib/persister.ts's shouldDehydrateQuery),
      // so merge just that into the on-disk cache rather than replacing it
      // wholesale, preserving whatever else (paused mutations, `me`) is
      // already there.
      const freshClient = new QueryClient();
      for (const { date, verse } of verses) {
        freshClient.setQueryData(queryKeys.dailyVerse(date), verse);
      }
      const fresh = dehydrate(freshClient);

      const previous = await persister.restoreClient();
      await persister.persistClient({
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: {
          queries: [
            ...(previous?.clientState.queries.filter((q) => q.queryKey[0] !== 'dailyVerse') ?? []),
            ...fresh.queries,
          ],
          mutations: previous?.clientState.mutations ?? [],
        },
      });
    }

    // `me` is cached via SecureStore, not the react-query persister (see
    // lib/persister.ts) — updated separately for the same reason. Skipped
    // when the independent fetchMe above failed (see mePromise): leaving
    // last-known-good in place is strictly better than blocking or
    // corrupting this sync over an unrelated, non-critical endpoint.
    if (me) await cachedUserStore.set(me);

    // Self-heals notification scheduling the same way the foreground
    // hook (use-task-reminders-sync.ts) does, so a task edited on another
    // device gets its reminder corrected here too, not just on next app open.
    // Reads straight from the local store just pulled above rather than a
    // REST history array — reminders only depend on task config, not
    // date-scoped status (see tasks-repo.ts's listAllActiveTasksForReminders).
    await syncAllTaskReminders(listAllActiveTasksForReminders());

    await recordSyncOutcome('success');
    setSyncPhase('synced');
  } catch (error) {
    setSyncPhase('failed');
    await recordSyncOutcome('failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Coalesces concurrent callers onto a single in-flight run — e.g. several
// task edits that were queued offline can all resolve within the same tick
// once connectivity returns, each independently wanting a full refresh; without
// this they'd fire N redundant parallel sync pulls instead of one. Protects
// every call site (foreground open, reconnect catch-up, the headless daily
// task, the dev manual trigger).
let syncInFlight: Promise<void> | null = null;

export function runFullBackgroundSync(liveClient?: QueryClient): Promise<void> {
  if (syncInFlight) return syncInFlight;
  // Set here (not inside runFullBackgroundSyncInner) so every caller sharing
  // this in-flight promise sees one idle→syncing transition, not one per
  // caller — runFullBackgroundSyncInner itself owns every other transition
  // (synced/failed/back to idle on a skip), see sync-status.ts, read by
  // DateNavHeader's "Syncing…"/"Synced" label and thin progress indicator.
  setSyncPhase('syncing');
  syncInFlight = runFullBackgroundSyncInner(liveClient).finally(() => {
    syncInFlight = null;
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
  runFullBackgroundSync(liveClient).catch(() => {
    // Failure is already recorded by runFullBackgroundSync itself.
  });
}
