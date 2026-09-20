import { eq } from 'drizzle-orm';
import type { QueryClient } from '@tanstack/react-query';

import { pushSyncChanges } from '@/api/sync';
import type {
  SyncCategory,
  SyncChange,
  SyncChangeResult,
  SyncSubTask,
  SyncSubTaskCompletion,
  SyncTask,
  SyncTaskCompletion,
} from '@/api/sync-types';
import { addTaskToMyTasks } from '@/api/tasks';
import type { TaskStatus } from '@/api/types';
import { SYNC_RETRY } from '@/lib/background-sync/retry';
import { beginSyncActivity, endSyncActivity } from '@/lib/background-sync/sync-status';
import { getCategoryByUuid, listActiveCategories, upsertCategoryFromSync } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { subTaskCompletions, taskCompletions } from '@/lib/db/schema';
import {
  deleteSubTaskCompletionLocal,
  deleteTaskCompletionLocal,
  upsertSubTaskCompletionFromSync,
  upsertTaskCompletionFromSync,
} from '@/lib/db/completions-repo';
import { listUnsyncedSubTasksForParent, upsertSubTaskFromSync } from '@/lib/db/sub-tasks-repo';
import {
  categoryDeleteChange,
  categoryUpsertChange,
  subTaskCompletionIncrementChange,
  subTaskCompletionUpsertChange,
  subTaskDeleteChange,
  subTaskUpsertChange,
  taskCompletionIncrementChange,
  taskCompletionUpsertChange,
  taskDeleteChange,
  taskUpsertChange,
} from '@/lib/db/sync-push-builders';
import { getTaskByUuid, listAllOwnedTasksFlat, upsertTaskFromSync } from '@/lib/db/tasks-repo';
import { mutationKeys } from '@/lib/mutation-keys';
import { cancelTaskReminders } from '@/lib/notifications';
import { tokenStore } from '@/lib/secure-store';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
  queryClient.invalidateQueries({ queryKey: ['myTasks'] });
}

function invalidateCategoryDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['categories'] });
  invalidateTaskLists(queryClient);
}

/** Applies every push result's authoritative server_row back into the local
 * store (see each *-repo.ts's upsertXFromSync) - whether the push was
 * "accepted" (server_row is just an echo of what was already sent) or
 * "superseded" (server_row is what actually won, per Decision 2/the
 * conflict-check work in Phase 4), this is what clears syncedAt: null and,
 * for a superseded change, corrects the local row to match the server. A
 * "rejected" result is logged and otherwise left alone - there's no UI for
 * this yet, same v1 scope boundary Phase 4 drew for sync_conflicts (see
 * lib/db/conflicts-repo.ts). */
function reconcilePushResults(results: SyncChangeResult[]): void {
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[sync push] rejected ${result.resource}/${result.uuid}: ${result.error}`);
      continue;
    }
    if (!result.server_row) continue; // e.g. an accepted delete - nothing to reconcile
    switch (result.resource) {
      case 'tasks':
        upsertTaskFromSync(result.server_row as SyncTask);
        break;
      case 'categories':
        upsertCategoryFromSync(result.server_row as SyncCategory);
        break;
      case 'sub_tasks':
        upsertSubTaskFromSync(result.server_row as SyncSubTask);
        break;
      case 'task_completions':
        upsertTaskCompletionFromSync(result.server_row as SyncTaskCompletion);
        break;
      case 'sub_task_completions':
        upsertSubTaskCompletionFromSync(result.server_row as SyncSubTaskCompletion);
        break;
    }
  }
}

/** The single choke point every mutation's push (create/update/delete/
 * complete/increment/reorder, tasks and categories alike) runs through -
 * wrapping the actual network call here means beginSyncActivity/
 * endSyncActivity (sync-status.ts) fires for every one of them without
 * threading it through each individual mutationFn. Mutations are paused
 * (not even invoked) while offline by react-query's default networkMode
 * ('online' - see lib/network.ts's resumePausedMutations on reconnect), so
 * this - and the "Syncing…" it reports - only ever runs while actually
 * online, same as the periodic /sync pull (lib/background-sync/sync.ts). */
/** There is at most one completion per (task, user, date) on the server. If
 * the website (or another device) already completed a task for a day before
 * this device ever pulled it, the server merges this device's push into that
 * existing row and answers with ITS uuid - leaving this device holding two
 * local rows for the same task+day: the pushed one (old uuid, never marked
 * synced) and the server's just-reconciled one. Drop the stale one so the
 * day has exactly one row locally too. results[i] always corresponds to
 * changes[i] (the server appends exactly one result per change). */
function dropMergedLocalCompletions(changes: SyncChange[], results: SyncChangeResult[]): void {
  results.forEach((result, i) => {
    const change = changes[i];
    if (!change || result.status === 'rejected' || result.uuid === change.uuid) return;
    if (change.resource === 'task_completions') deleteTaskCompletionLocal(change.uuid);
    else if (change.resource === 'sub_task_completions') deleteSubTaskCompletionLocal(change.uuid);
  });
}

async function pushChanges(changes: SyncChange[]): Promise<SyncChangeResult[]> {
  if (changes.length === 0) return [];
  beginSyncActivity();
  try {
    const token = await tokenStore.getToken();
    // Retries through SYNC_RETRY (lib/background-sync/retry.ts) rather than
    // failing this mutation on the first timeout - see pull.ts's identical
    // reasoning: the backend runs on Render's free tier, where a sleeping
    // instance's first request routinely times out rather than getting
    // refused outright while it cold-starts (commonly 30-50s, sometimes
    // more). Without this, tapping something right after the backend has
    // gone to sleep would show a spurious sync failure instead of just
    // taking longer than usual.
    const results = await pushSyncChanges(changes, token, SYNC_RETRY);
    reconcilePushResults(results);
    dropMergedLocalCompletions(changes, results);
    endSyncActivity(true);
    return results;
  } catch (error) {
    endSyncActivity(false);
    throw error;
  }
}

/** Every mutationFn below reads the row it needs to push from local SQLite -
 * there's no fallback to the old per-action REST write endpoints (Phase 5
 * deleted them). If the local DB genuinely isn't open yet (pre-native-rebuild
 * device - see lib/db/client.ts's getLocalDb doc comment), the live hook's
 * onMutate already silently no-op'd (every *Local() write function returns
 * early when getLocalDb() is null), so there is nothing to read and nothing
 * would ever get pushed - without this check, that mutation would resolve as
 * a *success* with an empty change list, silently discarding the user's
 * edit. Throwing here instead turns that into a visible mutation error (every
 * call site already wires an onError - see e.g. app/task/new.tsx) rather than
 * quiet data loss. */
function assertLocalDbAvailable(): void {
  if (!getLocalDb()) {
    throw new Error('Offline database is not ready on this device yet - please update the app to sync changes.');
  }
}

/** Every currently-unsynced sub-task under `parentUuid` (see
 * lib/db/sub-tasks-repo.ts's listUnsyncedSubTasksForParent for why this is
 * queried fresh rather than threaded through mutation variables) as push
 * changes - shared by create/update task, since both can touch sub-tasks. */
function unsyncedSubTaskChanges(parentUuid: string): SyncChange[] {
  const { upserts, deletedUuids } = listUnsyncedSubTasksForParent(parentUuid);
  const now = new Date().toISOString();
  return [...upserts.map(subTaskUpsertChange), ...deletedUuids.map((uuid) => subTaskDeleteChange(uuid, now))];
}

// Stable, module-level mutation functions. Each resolves its own token from
// SecureStore rather than from React context, so they work identically
// whether invoked live from a mounted hook or replayed headlessly after an
// app restart. Every one of them reads the CURRENT local SQLite row(s) for
// the uuid(s) in `variables` and pushes whatever's there, rather than
// re-deriving the payload from the original mutation input — the local
// write already happened (in the live-hook's onMutate, durably, before this
// can ever run) and is the single source of truth for what actually needs
// pushing, which is also what makes a headless replay correct for free: it
// just re-pushes whatever is *still* unsynced at replay time.

export const createTaskMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const task = getTaskByUuid(uuid);
  if (!task) return [];
  return pushChanges([taskUpsertChange(task), ...unsyncedSubTaskChanges(uuid)]);
};

export const updateTaskMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const task = getTaskByUuid(uuid);
  if (!task) return [];
  return pushChanges([taskUpsertChange(task), ...unsyncedSubTaskChanges(uuid)]);
};

export const deleteTaskMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const task = getTaskByUuid(uuid);
  const updatedAt = task?.updatedAt ?? new Date().toISOString();
  const { deletedUuids } = listUnsyncedSubTasksForParent(uuid);
  return pushChanges([
    taskDeleteChange(uuid, updatedAt),
    ...deletedUuids.map((subUuid) => subTaskDeleteChange(subUuid, updatedAt)),
  ]);
};

export const completeTaskMutationFn = async ({ completionUuid }: { completionUuid: string }) => {
  assertLocalDbAvailable();
  const db = getLocalDb();
  if (!db) return [];
  const row = db.select().from(taskCompletions).where(eq(taskCompletions.uuid, completionUuid)).get();
  if (!row) return [];
  return pushChanges([taskCompletionUpsertChange(row)]);
};

/** Unlike every other mutationFn, this one is dispatched with the amount
 * already applied to local SQLite (see hooks/use-task-increment-buffer.ts's
 * addAmount, which calls incrementTaskCompletionLocal synchronously per tap,
 * not here) - by the time flush() calls this, `completionUuid` names a row
 * that already reflects every tap since the last successful push, so this
 * only needs to push the delta accumulated since then. Pushing here as well
 * would double-apply what addAmount already committed. Returns {status,
 * reward_text} - the shape the increment buffer's onSuccess expects,
 * mirroring what the old CompletionResponse used to provide - derived from
 * the push result's authoritative server_row when available (the server may
 * have summed in another device's concurrent taps), falling back to the
 * already-local row otherwise (e.g. while the push is still paused offline). */
export const incrementTaskMutationFn = async ({
  completionUuid,
  taskUuid,
  amount,
}: {
  completionUuid: string;
  taskUuid: string;
  amount: number;
}): Promise<{ status: TaskStatus; reward_text?: string }> => {
  assertLocalDbAvailable();
  const db = getLocalDb();
  if (!db) return { status: 'pending' };
  const row = db.select().from(taskCompletions).where(eq(taskCompletions.uuid, completionUuid)).get();
  if (!row) return { status: 'pending' };
  const task = getTaskByUuid(taskUuid);
  const results = await pushChanges([taskCompletionIncrementChange(completionUuid, taskUuid, row.taskDate, amount)]);
  const serverRow = results[0]?.server_row as SyncTaskCompletion | undefined;
  const status = (serverRow?.status as TaskStatus | undefined) ?? (row.status as TaskStatus);
  return { status, reward_text: status === 'completed' ? (task?.rewardText ?? undefined) : undefined };
};

export const completeSubTaskMutationFn = async ({ completionUuid }: { completionUuid: string }) => {
  assertLocalDbAvailable();
  const db = getLocalDb();
  if (!db) return [];
  const row = db.select().from(subTaskCompletions).where(eq(subTaskCompletions.uuid, completionUuid)).get();
  if (!row) return [];
  return pushChanges([subTaskCompletionUpsertChange(row)]);
};

/** Same reasoning as incrementTaskMutationFn above - dispatched with the
 * amount already applied to local SQLite (see hooks/queries/
 * use-task-mutations.ts's useIncrementSubTask, which calls
 * incrementSubTaskCompletionLocal synchronously before this ever runs), so
 * this only reads the row by uuid and pushes - applying the increment again
 * here would double-count it. */
export const incrementSubTaskMutationFn = async ({
  completionUuid,
  amount,
}: {
  completionUuid: string;
  amount: number;
}): Promise<{ status: TaskStatus; progressCount: number }> => {
  assertLocalDbAvailable();
  const db = getLocalDb();
  if (!db) return { status: 'pending', progressCount: 0 };
  const row = db.select().from(subTaskCompletions).where(eq(subTaskCompletions.uuid, completionUuid)).get();
  if (!row) return { status: 'pending', progressCount: 0 };
  const results = await pushChanges([
    subTaskCompletionIncrementChange(completionUuid, row.subTaskUuid ?? '', row.parentTaskUuid, row.taskDate, amount),
  ]);
  const serverRow = results[0]?.server_row as SyncSubTaskCompletion | undefined;
  return {
    status: (serverRow?.status as TaskStatus | undefined) ?? (row.status as TaskStatus),
    progressCount: serverRow?.progress_count ?? row.progressCount,
  };
};

export const addTaskToMyTasksMutationFn = async (sourceTaskUuid: string) => {
  // Not routed through pushChanges (see api/tasks.ts's addTaskToMyTasks doc
  // comment - this is the one deliberately online-only, direct-REST
  // mutation), so it tracks sync activity itself instead of getting it for
  // free from that shared choke point.
  beginSyncActivity();
  try {
    const result = await addTaskToMyTasks(sourceTaskUuid, await tokenStore.getToken(), SYNC_RETRY);
    endSyncActivity(true);
    return result;
  } catch (error) {
    endSyncActivity(false);
    throw error;
  }
};

export const reorderTasksMutationFn = async ({ orderedUuids }: { categoryUuid: string | null; orderedUuids: string[] }) => {
  assertLocalDbAvailable();
  const rows = listAllOwnedTasksFlat().filter((t) => orderedUuids.includes(t.uuid) && t.syncedAt === null);
  return pushChanges(rows.map(taskUpsertChange));
};

export const createCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const category = getCategoryByUuid(uuid);
  if (!category) return [];
  return pushChanges([categoryUpsertChange(category)]);
};

export const updateCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const category = getCategoryByUuid(uuid);
  if (!category) return [];
  return pushChanges([categoryUpsertChange(category)]);
};

export const deleteCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  assertLocalDbAvailable();
  const category = getCategoryByUuid(uuid);
  const updatedAt = category?.updatedAt ?? new Date().toISOString();
  return pushChanges([categoryDeleteChange(uuid, updatedAt)]);
};

export const reorderCategoriesMutationFn = async (orderedUuids: string[]) => {
  assertLocalDbAvailable();
  const rows = listActiveCategories().filter((c) => orderedUuids.includes(c.uuid) && c.syncedAt === null);
  return pushChanges(rows.map(categoryUpsertChange));
};

/** Registers the fallback options used when a mutation resumes after an app
 * restart with no live `useMutation` hook mounted for its key (e.g. a task
 * completion that was queued offline, then replayed on the next cold start).
 * Live hooks override `mutationFn`/`onMutate`/`onError`/`onSettled` per call,
 * but always pass the same stable functions above, so behavior is identical
 * whether or not this registration has run first. Must be called once,
 * synchronously, right after the QueryClient singleton is constructed —
 * before `PersistQueryClientProvider` hydrates and calls
 * `resumePausedMutations()`.
 *
 * Unlike before Phase 5, `onSuccess` no longer needs to trigger a full
 * network resync (see the now-removed lib/task-cache-refresh.ts) — the
 * local SQLite write already happened in onMutate, is already the
 * authoritative source deriveTasksForDate reads from, and
 * reconcilePushResults above already folds the server's confirmation back
 * in. `onSettled` just needs to invalidate so already-mounted screens
 * re-read (instantly, from SQLite) with the confirmed state. */
export function registerMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(mutationKeys.tasks.create, {
    mutationFn: createTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.update, {
    mutationFn: updateTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.delete, {
    // Cancels the deleted task's scheduled reminders when this delete resumes
    // headlessly (offline delete replayed after an app restart, with no live
    // useDeleteTask hook mounted to run its own onSuccess) — otherwise the
    // stale notification IDs in AsyncStorage are never cleared and fire later
    // for a task that no longer exists.
    mutationFn: deleteTaskMutationFn,
    onSuccess: (_data, { uuid }: { uuid: string }) => cancelTaskReminders(uuid),
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.complete, {
    mutationFn: completeTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.increment, {
    mutationFn: incrementTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.completeSubTask, {
    mutationFn: completeSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.incrementSubTask, {
    mutationFn: incrementSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.addToMyTasks, {
    mutationFn: addTaskToMyTasksMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.reorder, {
    mutationFn: reorderTasksMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.categories.create, {
    mutationFn: createCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.categories.update, {
    mutationFn: updateCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.categories.delete, {
    mutationFn: deleteCategoryMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.categories.reorder, {
    mutationFn: reorderCategoriesMutationFn,
    onSettled: () => invalidateCategoryDependents(queryClient),
  });
}
