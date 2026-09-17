import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { getBackgroundSyncState } from '@/lib/background-sync/state';
import { currentDhakaDateString } from '@/lib/background-sync/time';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { queryClient } from '@/lib/query-client';

// Module-level side effect: must run exactly once, before any query/mutation
// touches network-aware pause logic. Imported for its side effect at the top
// of app/_layout.tsx.
//
// `isInternetReachable` is `null` on some platforms even while connected, so
// only `false` counts as offline — treating `null` as offline would flag
// legitimate connections as offline on devices with flaky reachability checks.
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && state.isInternetReachable !== false);
  });
});

// QueryClient itself already resumes paused mutations on reconnect (it
// subscribes to onlineManager in its own `mount()`), but it only refetches
// queries for whichever screen is *currently mounted* afterwards
// (`refetchType` defaults to 'active'). Any other cached list — e.g. a date
// the user isn't looking at right now — is only marked stale and won't
// actually re-fetch until they happen to navigate there, so it keeps
// showing pre-sync data (a task that was deleted offline still "there")
// until then. Force every cached query to refetch once queued mutations
// have gone out, so the whole persisted offline cache reconciles with the
// server immediately, not just the visible screen.
onlineManager.subscribe((isOnline) => {
  if (!isOnline) return;
  queryClient.resumePausedMutations().then(() => {
    queryClient.invalidateQueries({ refetchType: 'all' });
  });
  runCatchUpSyncIfDue();
});

// If the scheduled 1AM Dhaka background sync (lib/background-sync/task.ts)
// never got to run — device was offline all night, Doze deferred it, app was
// force-stopped, whatever — this is what makes "as soon as internet becomes
// available, automatically continue synchronization" actually true rather
// than waiting for the next 15-minute WorkManager wake-up: the moment the app
// itself sees connectivity return, it catches up right away. Gated on
// today's Dhaka date so a normal reconnect (wifi to cellular, airplane mode
// toggle) doesn't re-run the full fetch-everything sync every time — only
// when today's sync genuinely hasn't succeeded yet.
async function runCatchUpSyncIfDue() {
  const state = await getBackgroundSyncState();
  if (state?.lastSuccessDhakaDate === currentDhakaDateString()) return;
  runFullBackgroundSync(queryClient).catch(() => {
    // Failure is already recorded by runFullBackgroundSync itself
    // (lib/background-sync/state.ts) — nothing else to do here; the next
    // reconnect or the next background-task window will try again.
  });
}
