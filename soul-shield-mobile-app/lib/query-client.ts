import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/errors';
import { registerMutationDefaults } from '@/lib/mutation-defaults';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function handleError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    unauthorizedHandler?.();
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      // Without an explicit gcTime, unobserved queries default to a 5-minute
      // retention — long enough that a day prefetched by the background sync
      // but not yet opened by the user (e.g. tomorrow) gets garbage-collected
      // from the live cache, and the persister's own throttled save (see
      // lib/persister.ts) then immediately writes that eviction to disk,
      // silently deleting the offline prefetch before it could ever be used
      // offline. Match the persister's own 7-day maxAge so a query survives
      // in memory for at least as long as its persisted snapshot is trusted.
      // lib/background-sync/prune.ts is what now bounds long-term growth
      // instead of relying on this timing out old data.
      gcTime: 1000 * 60 * 60 * 24 * 7,
    },
  },
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
});

registerMutationDefaults(queryClient);
