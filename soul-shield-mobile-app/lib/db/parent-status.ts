import type { TaskStatus } from '@/api/types';

/** completed == every sub-task done, partially_completed == some done,
 * else the same missed-vs-pending-by-date default as everything else -
 * ported straight from soul-shield/rest/handlers/task/subtask_merge.go's
 * computeParentStatus. A sub-tasked parent's own status is *always*
 * derived this way, never read from its own completion row (which
 * shouldn't exist for one - the app never lets a sub-tasked parent be
 * completed directly).
 *
 * Shared with the optimistic cache patcher (lib/task-cache.ts) so a
 * tap-driven parent-status recompute EXACTLY matches the derived read on
 * refetch.
 *
 * Keep this file free of runtime imports (type-only imports are fine): it is
 * unit-tested directly under Node (tests/parent-status.test.mjs) against
 * shared-test-fixtures/parent-status.json - the SAME cases the Go version is
 * tested with, so the two implementations can't silently drift apart. */
export function computeParentStatus(
  subs: readonly { status: TaskStatus }[],
  date: string,
  today: string
): TaskStatus {
  const completed = subs.filter((s) => s.status === 'completed').length;
  if (completed === subs.length) return 'completed';
  if (completed > 0) return 'partially_completed';
  return date < today ? 'missed' : 'pending';
}
