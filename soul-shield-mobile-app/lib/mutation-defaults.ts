import type { QueryClient } from '@tanstack/react-query';

import { createCategory, deleteCategory, updateCategory } from '@/api/categories';
import {
  completeSubTask,
  completeTask,
  createTask,
  deleteTask,
  incrementSubTask,
  incrementTask,
  updateTask,
} from '@/api/tasks';
import type { TaskInput, TaskUpdateInput } from '@/api/types';
import { mutationKeys } from '@/lib/mutation-keys';
import { cancelTaskReminders } from '@/lib/notifications';
import { tokenStore } from '@/lib/secure-store';
import { refreshTaskCacheAfterStructuralChange } from '@/lib/task-cache-refresh';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

function invalidateCategoryDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['categories'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

// Stable, module-level mutation functions. Each resolves its own token from
// SecureStore rather than from React context, so they work identically
// whether invoked live from a mounted hook or replayed headlessly after an
// app restart (before any component, including AuthProvider, has mounted).

export const createTaskMutationFn = async (input: TaskInput) =>
  createTask(input, await tokenStore.getToken());

export const updateTaskMutationFn = async ({ id, input }: { id: number; input: TaskUpdateInput }) =>
  updateTask(id, input, await tokenStore.getToken());

export const deleteTaskMutationFn = async (id: number) =>
  deleteTask(id, await tokenStore.getToken());

export const completeTaskMutationFn = async ({ taskId, date }: { taskId: number; date: string }) =>
  completeTask(taskId, date, await tokenStore.getToken());

export const incrementTaskMutationFn = async ({
  taskId,
  amount,
  date,
}: {
  taskId: number;
  amount: number;
  date?: string;
}) => incrementTask(taskId, amount, date, await tokenStore.getToken());

export const completeSubTaskMutationFn = async ({
  taskId,
  subTaskId,
  date,
}: {
  taskId: number;
  subTaskId: number;
  date?: string;
}) => completeSubTask(taskId, subTaskId, date, await tokenStore.getToken());

export const incrementSubTaskMutationFn = async ({
  taskId,
  subTaskId,
  amount,
  date,
}: {
  taskId: number;
  subTaskId: number;
  amount: number;
  date?: string;
}) => incrementSubTask(taskId, subTaskId, amount, date, await tokenStore.getToken());

export const createCategoryMutationFn = async (input: { name: string; color_hex?: string }) =>
  createCategory(input, await tokenStore.getToken());

export const updateCategoryMutationFn = async ({
  id,
  input,
}: {
  id: number;
  input: { name?: string; color_hex?: string };
}) => updateCategory(id, input, await tokenStore.getToken());

export const deleteCategoryMutationFn = async (id: number) =>
  deleteCategory(id, await tokenStore.getToken());

/** Registers the fallback options used when a mutation resumes after an app
 * restart with no live `useMutation` hook mounted for its key (e.g. a task
 * completion that was queued offline, then replayed on the next cold start).
 * Live hooks override `mutationFn`/`onMutate`/`onError`/`onSettled` per call,
 * but always pass the same stable functions above, so behavior is identical
 * whether or not this registration has run first. Must be called once,
 * synchronously, right after the QueryClient singleton is constructed —
 * before `PersistQueryClientProvider` hydrates and calls
 * `resumePausedMutations()`. */
export function registerMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(mutationKeys.tasks.create, {
    mutationFn: createTaskMutationFn,
    // Structural change: once the backend has actually confirmed it (which,
    // for a create queued offline and replayed headlessly after an app
    // restart, only happens here — see the doc comment on this function),
    // the cached today+N-day task window may now be stale (a new recurring
    // task can affect future days) and must be cleared and re-fetched fresh.
    onSuccess: () => refreshTaskCacheAfterStructuralChange(queryClient),
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.update, {
    mutationFn: updateTaskMutationFn,
    onSuccess: () => refreshTaskCacheAfterStructuralChange(queryClient),
    onSettled: () => invalidateTaskLists(queryClient),
  });
  queryClient.setMutationDefaults(mutationKeys.tasks.delete, {
    mutationFn: deleteTaskMutationFn,
    // Cancels the deleted task's scheduled reminders when this delete resumes
    // headlessly (offline delete replayed after an app restart, with no live
    // useDeleteTask hook mounted to run its own onSuccess) — otherwise the
    // stale notification IDs in AsyncStorage are never cleared and fire later
    // for a task that no longer exists. Runs alongside the same structural
    // cache refresh as create/update above.
    onSuccess: (_data, id) =>
      Promise.all([cancelTaskReminders(id), refreshTaskCacheAfterStructuralChange(queryClient)]),
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
}
