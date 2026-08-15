import type { QueryClient } from '@tanstack/react-query';

import { currentDhakaDateString } from '@/lib/background-sync/time';
import { todayISODate } from '@/lib/date';
import { mutationKeys } from '@/lib/mutation-keys';

const STRUCTURAL_MUTATION_KEYS = [
  mutationKeys.tasks.create,
  mutationKeys.tasks.update,
  mutationKeys.tasks.delete,
];

const DATED_MUTATION_KEYS = [
  mutationKeys.tasks.complete,
  mutationKeys.tasks.increment,
  mutationKeys.tasks.completeSubTask,
  mutationKeys.tasks.incrementSubTask,
];

/** Drops cached tasks(date)/taskHistory(from,to) entries that have rolled
 * outside the app's offline guarantee, so the persisted cache doesn't grow
 * unbounded with every day of use — lib/query-client.ts deliberately sets a
 * long gcTime (so the rolling window survives being unobserved long enough
 * to be useful offline), which means the old 5-minute default gcTime is no
 * longer around to clean this up on its own.
 *
 * Never removes a date a pending (not-yet-confirmed) mutation might still
 * need: create/update/delete variables don't carry a `date` (an update can
 * touch any day a recurring task spans), so if any of those is outstanding
 * this skips pruning entirely for the pass rather than guessing; the dated
 * actions (complete/increment/sub-task variants) protect their own exact
 * date. This mirrors the rule that a queued offline change must survive
 * until the backend actually confirms it, regardless of what cache-cleanup
 * logic happens to run in the meantime.
 *
 * Deliberately synchronous and side-effect-only (no network) so it can run
 * as a cheap first step before every foreground/reconnect sync, with no
 * `await` between reading pending mutations and acting on them — so there's
 * no window for a mutation to resolve mid-pass and invalidate the check. */
export function pruneExpiredTaskCache(queryClient: QueryClient): void {
  const mutationCache = queryClient.getMutationCache();

  const hasPendingStructuralMutation = STRUCTURAL_MUTATION_KEYS.some(
    (mutationKey) => mutationCache.findAll({ mutationKey, status: 'pending' }).length > 0
  );
  if (hasPendingStructuralMutation) return;

  const protectedDates = new Set<string>();
  for (const mutationKey of DATED_MUTATION_KEYS) {
    for (const mutation of mutationCache.findAll({ mutationKey, status: 'pending' })) {
      const variables = mutation.state.variables as { date?: string } | undefined;
      protectedDates.add(variables?.date ?? todayISODate());
    }
  }

  const today = todayISODate();
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['tasks'] })) {
    const date = query.queryKey[1] as string | undefined;
    if (date && date < today && !protectedDates.has(date)) {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  }

  // Every successful sync mints a brand-new taskHistory(from, dhakaToday) key
  // (dhakaToday changes daily, see lib/background-sync/time.ts) rather than
  // overwriting yesterday's — any entry not matching today's Dhaka date is
  // superseded and safe to drop unconditionally; nothing ever mutates
  // taskHistory directly, so there's no pending-change concern for it.
  const dhakaToday = currentDhakaDateString();
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['taskHistory'] })) {
    const to = query.queryKey[2] as string | undefined;
    if (to && to !== dhakaToday) {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  }
}
