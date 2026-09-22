import type { SyncChange } from '@/api/sync-types';
import { listUnsyncedCategories } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { listUnsyncedSubTaskCompletions, listUnsyncedTaskCompletions } from '@/lib/db/completions-repo';
import { listUnsyncedSubTasks } from '@/lib/db/sub-tasks-repo';
import {
  categoryDeleteChange,
  categoryUpsertChange,
  subTaskCompletionUpsertChange,
  subTaskDeleteChange,
  subTaskUpsertChange,
  taskCompletionUpsertChange,
  taskDeleteChange,
  taskUpsertChange,
} from '@/lib/db/sync-push-builders';
import { listUnsyncedTasks } from '@/lib/db/tasks-repo';
import { pushChanges } from '@/lib/mutation-defaults';

/** Re-pushes every local row the server hasn't confirmed (syncedAt null).
 *
 * Every write here is pushed by its own queued mutation, and nothing ever
 * retried a row whose mutation was lost or failed (app killed before it
 * replayed, a failed push, a change the server rejected) - it sat local-only
 * forever while the sync status happily said "Synced". That is exactly how a
 * task created on the phone ended up in the local database but never on the
 * server. This is the safety net: run at the start of every sync (before the
 * pull, so a pulled older server row can't overwrite an unsynced local edit),
 * it brings the server up to date with whatever the phone still owes it.
 *
 * Parents go before children (categories -> tasks -> sub-tasks -> completions)
 * because the server resolves each reference by uuid as it processes the
 * batch in order. Pushing a row that's already up to date is harmless: the
 * server just updates it with identical data.
 *
 * Returns how many changes the server took vs. rejected, so the caller can
 * report a real failure instead of "Synced" when something is still stuck. */
export async function pushPendingLocalChanges(): Promise<{ pushed: number; rejected: number }> {
  if (!getLocalDb()) return { pushed: 0, rejected: 0 };

  const changes: SyncChange[] = [
    ...listUnsyncedCategories().map((c) => (c.deletedAt ? categoryDeleteChange(c.uuid, c.updatedAt) : categoryUpsertChange(c))),
    ...listUnsyncedTasks().map((t) => (t.deletedAt ? taskDeleteChange(t.uuid, t.updatedAt) : taskUpsertChange(t))),
    ...listUnsyncedSubTasks().map((s) => (s.deletedAt ? subTaskDeleteChange(s.uuid, s.updatedAt) : subTaskUpsertChange(s))),
    ...listUnsyncedTaskCompletions().map(taskCompletionUpsertChange),
    ...listUnsyncedSubTaskCompletions().map(subTaskCompletionUpsertChange),
  ];
  if (changes.length === 0) return { pushed: 0, rejected: 0 };

  const results = await pushChanges(changes);
  const rejected = results.filter((r) => r.status === 'rejected').length;
  return { pushed: results.length - rejected, rejected };
}
