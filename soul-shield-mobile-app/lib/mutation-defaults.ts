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
import { getCategoryByUuid, listActiveCategories, upsertCategoryFromSync } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { subTaskCompletions, taskCompletions } from '@/lib/db/schema';
import {
  incrementSubTaskCompletionLocal,
  incrementTaskCompletionLocal,
  upsertSubTaskCompletionFromSync,
  upsertTaskCompletionFromSync,
} from '@/lib/db/completions-repo';
import { getSubTaskByUuid, listUnsyncedSubTasksForParent, upsertSubTaskFromSync } from '@/lib/db/sub-tasks-repo';
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

async function pushChanges(changes: SyncChange[]): Promise<SyncChangeResult[]> {
  if (changes.length === 0) return [];
  const token = await tokenStore.getToken();
  const results = await pushSyncChanges(changes, token);
  reconcilePushResults(results);
  return results;
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
  const task = getTaskByUuid(uuid);
  if (!task) return [];
  return pushChanges([taskUpsertChange(task), ...unsyncedSubTaskChanges(uuid)]);
};

export const updateTaskMutationFn = async ({ uuid }: { uuid: string }) => {
  const task = getTaskByUuid(uuid);
  if (!task) return [];
  return pushChanges([taskUpsertChange(task), ...unsyncedSubTaskChanges(uuid)]);
};

export const deleteTaskMutationFn = async ({ uuid }: { uuid: string }) => {
  const task = getTaskByUuid(uuid);
  const updatedAt = task?.updatedAt ?? new Date().toISOString();
  const { deletedUuids } = listUnsyncedSubTasksForParent(uuid);
  return pushChanges([
    taskDeleteChange(uuid, updatedAt),
    ...deletedUuids.map((subUuid) => subTaskDeleteChange(subUuid, updatedAt)),
  ]);
};

export const completeTaskMutationFn = async ({ completionUuid }: { completionUuid: string }) => {
  const db = getLocalDb();
  if (!db) return [];
  const row = db.select().from(taskCompletions).where(eq(taskCompletions.uuid, completionUuid)).get();
  if (!row) return [];
  return pushChanges([taskCompletionUpsertChange(row)]);
};

/** Unlike every other mutationFn, this one does its own local write (via
 * incrementTaskCompletionLocal) rather than reading a row onMutate already
 * wrote - useIncrementTask has no onMutate (see hooks/queries/
 * use-task-mutations.ts), since hooks/use-task-increment-buffer.ts already
 * applies its own cache-level optimistic display before ever calling
 * .mutate(). Reuses the completion row's real uuid (not a fresh one per
 * call) so the push updates the same row instead of creating a duplicate,
 * and returns {status, reward_text} - the shape the increment buffer's
 * onSuccess expects, mirroring what the old CompletionResponse used to
 * provide - derived from the push result's authoritative server_row when
 * available (the server may have summed in another device's concurrent
 * taps), falling back to the just-computed local result otherwise (e.g.
 * while the push is still paused offline). */
export const incrementTaskMutationFn = async ({
  uuid,
  amount,
  date,
}: {
  uuid: string;
  amount: number;
  date: string;
}): Promise<{ status: TaskStatus; reward_text?: string }> => {
  const task = getTaskByUuid(uuid);
  const target = task?.targetCount ?? 0;
  const local = incrementTaskCompletionLocal(uuid, date, amount, target);
  const results = await pushChanges([taskCompletionIncrementChange(local.completionUuid, uuid, date, amount)]);
  const serverRow = results[0]?.server_row as SyncTaskCompletion | undefined;
  const status = (serverRow?.status as TaskStatus | undefined) ?? local.status;
  return { status, reward_text: status === 'completed' ? (task?.rewardText ?? undefined) : undefined };
};

export const completeSubTaskMutationFn = async ({ completionUuid }: { completionUuid: string }) => {
  const db = getLocalDb();
  if (!db) return [];
  const row = db.select().from(subTaskCompletions).where(eq(subTaskCompletions.uuid, completionUuid)).get();
  if (!row) return [];
  return pushChanges([subTaskCompletionUpsertChange(row)]);
};

/** Same reasoning as incrementTaskMutationFn above (own local write, reused
 * completion uuid), for a sub-task's counter. */
export const incrementSubTaskMutationFn = async ({
  subTaskUuid,
  parentTaskUuid,
  amount,
  date,
}: {
  subTaskUuid: string;
  parentTaskUuid: string;
  amount: number;
  date: string;
}): Promise<{ status: TaskStatus; progressCount: number }> => {
  const subTask = getSubTaskByUuid(subTaskUuid);
  const target = subTask?.targetCount ?? 0;
  const local = incrementSubTaskCompletionLocal(subTaskUuid, parentTaskUuid, date, amount, target);
  const results = await pushChanges([
    subTaskCompletionIncrementChange(local.completionUuid, subTaskUuid, parentTaskUuid, date, amount),
  ]);
  const serverRow = results[0]?.server_row as SyncSubTaskCompletion | undefined;
  return {
    status: (serverRow?.status as TaskStatus | undefined) ?? local.status,
    progressCount: serverRow?.progress_count ?? local.progressCount,
  };
};

export const addTaskToMyTasksMutationFn = async (sourceTaskUuid: string) =>
  addTaskToMyTasks(sourceTaskUuid, await tokenStore.getToken());

export const reorderTasksMutationFn = async ({ orderedUuids }: { categoryUuid: string | null; orderedUuids: string[] }) => {
  const rows = listAllOwnedTasksFlat().filter((t) => orderedUuids.includes(t.uuid) && t.syncedAt === null);
  return pushChanges(rows.map(taskUpsertChange));
};

export const createCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  const category = getCategoryByUuid(uuid);
  if (!category) return [];
  return pushChanges([categoryUpsertChange(category)]);
};

export const updateCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  const category = getCategoryByUuid(uuid);
  if (!category) return [];
  return pushChanges([categoryUpsertChange(category)]);
};

export const deleteCategoryMutationFn = async ({ uuid }: { uuid: string }) => {
  const category = getCategoryByUuid(uuid);
  const updatedAt = category?.updatedAt ?? new Date().toISOString();
  return pushChanges([categoryDeleteChange(uuid, updatedAt)]);
};

export const reorderCategoriesMutationFn = async (orderedUuids: string[]) => {
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
