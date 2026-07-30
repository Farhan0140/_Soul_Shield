import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

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
