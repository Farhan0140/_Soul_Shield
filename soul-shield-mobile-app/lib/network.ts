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

// Once queued mutations have gone out after a reconnect, every cached query
// is invalidated. Only the ones on screen re-read right away; the rest are
// marked invalidated and re-read the moment their screen opens again (an
// invalidated query always refetches on mount, whatever its staleTime), so
// nothing ever shows pre-sync data. This used to force EVERY cached query to
// re-read at once (refetchType 'all') - each one a synchronous SQLite read on
// the JS thread, for every date and history window visited this session -
// which froze the app for a moment on every connectivity blip.
onlineManager.subscribe((isOnline) => {
  if (!isOnline) return;
  queryClient.resumePausedMutations().then(() => {
    queryClient.invalidateQueries();
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
