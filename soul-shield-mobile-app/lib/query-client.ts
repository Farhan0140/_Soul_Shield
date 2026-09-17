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
      // retention. tasks/categories/taskHistory/myTasks are SQLite-backed and
      // excluded from persistence entirely (see lib/persister.ts's
      // shouldDehydrateQuery) so this mainly matters for dailyVerse, the one
      // query still persisted through this generic mechanism — match the
      // persister's own 7-day maxAge so it survives in memory at least as
      // long as its persisted snapshot is trusted.
      gcTime: 1000 * 60 * 60 * 24 * 7,
    },
  },
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
});

registerMutationDefaults(queryClient);
