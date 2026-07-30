import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import '@/lib/network';

/** Reads the connectivity state that `lib/network.ts` wires `onlineManager` to
 * (via NetInfo) — does not open its own NetInfo subscription. */
export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline()
  );

  return { isOnline };
}
