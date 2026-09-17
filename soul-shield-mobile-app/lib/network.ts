import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

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
  // Every reconnect - not just once a day - triggers an immediate sync pull,
  // so "the app is online again" and "the offline window/status indicator is
  // up to date" happen together instead of waiting for the next scheduled
  // background-task window. runFullBackgroundSync coalesces concurrent
  // callers on its own (see sync.ts's syncInFlight), so a quick succession
  // of connectivity blips (wifi handoff, airplane mode toggled twice) is
  // still just one in-flight sync, not a pile-up. Failure is already
  // recorded by runFullBackgroundSync itself (lib/background-sync/state.ts)
  // — nothing else to do here; the next reconnect or the next scheduled
  // background-task window will try again.
  runFullBackgroundSync(queryClient).catch(() => {});
});
