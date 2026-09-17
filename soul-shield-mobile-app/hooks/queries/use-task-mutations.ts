import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { AddToMyTasksResponse, Category, ManageableSubTask, ManageableTask, Task, TaskInput, TaskUpdateInput } from '@/api/types';
import {
  toggleSubTaskCompletionLocal,
  toggleTaskCompletionLocal,
} from '@/lib/db/completions-repo';
import { replaceSubTasksForParentLocal } from '@/lib/db/sub-tasks-repo';
import { createTaskLocal, deriveTasksForDate, reorderTasksLocal, softDeleteTaskLocal, updateTaskLocal } from '@/lib/db/tasks-repo';
import { newUuid } from '@/lib/db/uuid';
import { todayISODate } from '@/lib/date';
import {
  addTaskToMyTasksMutationFn,
  completeSubTaskMutationFn,
  completeTaskMutationFn,
  createTaskMutationFn,
  deleteTaskMutationFn,
  incrementSubTaskMutationFn,
  incrementTaskMutationFn,
  reorderTasksMutationFn,
  updateTaskMutationFn,
} from '@/lib/mutation-defaults';
import { mutationKeys } from '@/lib/mutation-keys';
import { cancelTaskReminders } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
  queryClient.invalidateQueries({ queryKey: ['myTasks'] });
}

function findDerivedTask(date: string, taskId: string): Task | undefined {
  return deriveTasksForDate(date).find((t) => t.task_id === taskId);
}

/** Defaults to today since that's what's on screen when the "+" create flow
 * is used in practice. Returns the uuid synchronously (the local SQLite
 * write happens before this even returns - see lib/db/tasks-repo.ts's
 * createTaskLocal) so a caller like app/task/new.tsx can use it right away
 * (e.g. to schedule reminders) instead of waiting for the push to confirm,
 * which may not happen for a while if offline. */
export function useCreateTask(date: string = todayISODate()) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.create,
    mutationFn: createTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    (input: TaskInput, options?: { onError?: (error: unknown) => void }) => {
      const uuid = newUuid();
      createTaskLocal(uuid, {
        title: input.title,
        description: input.description ?? null,
        recurrenceType: input.recurrence_type,
        recurrenceDays: input.recurrence_days,
        categoryUuid: input.category_id ?? null,
        rewardText: input.reward_text ?? null,
        taskType: input.task_type,
        targetCount: input.target_count ?? null,
        durationSeconds: input.duration_seconds ?? null,
        reminderTime: input.reminder_time ?? null,
      });
      if (input.sub_tasks && input.sub_tasks.length > 0) {
        replaceSubTasksForParentLocal(uuid, input.sub_tasks);
      }
      invalidateTaskLists(queryClient);
      mutation.mutate({ uuid }, { onError: options?.onError });
      return uuid;
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

export function useUpdateTask(date: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.update,
    mutationFn: updateTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    ({ id, input }: { id: string; input: TaskUpdateInput }, options?: { onError?: (error: unknown) => void }) => {
      updateTaskLocal(id, {
        title: input.title,
        description: input.description ?? undefined,
        recurrenceType: input.recurrence_type,
        recurrenceDays: input.recurrence_days,
        isActive: input.is_active,
        categoryUuid: input.category_id === undefined ? undefined : (input.category_id ?? null),
        rewardText: input.reward_text ?? undefined,
        targetCount: input.target_count,
        durationSeconds: input.duration_seconds,
        reminderTime: input.reminder_time,
      });
      if (input.sub_tasks) {
        replaceSubTasksForParentLocal(id, input.sub_tasks);
      }
      invalidateTaskLists(queryClient);
      mutation.mutate({ uuid: id }, { onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

export function useDeleteTask(date: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.delete,
    mutationFn: deleteTaskMutationFn,
    onSuccess: (_data, { uuid }: { uuid: string }) => cancelTaskReminders(uuid),
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    (id: string, options?: { onError?: (error: unknown) => void }) => {
      softDeleteTaskLocal(id);
      invalidateTaskLists(queryClient);
      mutation.mutate({ uuid: id }, { onError: options?.onError });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Toggles a normal task's completion for one date - see
 * lib/db/completions-repo.ts's toggleTaskCompletionLocal for why this is a
 * genuine toggle now (tapping an already-completed task un-completes it),
 * not just an optimistic local patch a real "complete" request used to
 * silently overwrite back. */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.complete,
    mutationFn: completeTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    (
      { taskId, date }: { taskId: string; date: string },
      options?: {
        onSuccess?: (data: { status: Task['status']; reward_text?: string }) => void;
        onError?: (error: unknown) => void;
      }
    ) => {
      const { status, completionUuid } = toggleTaskCompletionLocal(taskId, date);
      invalidateTaskLists(queryClient);
      mutation.mutate(
        { completionUuid },
        { onSuccess: () => options?.onSuccess?.({ status }), onError: options?.onError }
      );
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Clones a fixed (is_global) task into the current user's own tasks - see
 * api/tasks.ts's addTaskToMyTasks for why this stays a direct online-only
 * network call rather than going through the local-first sync push. */
export function useAddTaskToMyTasks(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.addToMyTasks,
    mutationFn: addTaskToMyTasksMutationFn,
    // The new task/category only exist locally once the next sync pull
    // brings them in (see lib/background-sync/pull.ts) - onSettled below
    // invalidates so that pull's result shows up as soon as it lands;
    // there's nothing to do here with the AddToMyTasksResponse itself.
    onSuccess: (_data: AddToMyTasksResponse) => {},
    onSettled: () => {
      invalidateTaskLists(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

/** Reorders the caller's personal tasks within one category (`categoryId`
 * null = "Uncategorized") for the given date's cached list. */
export function useReorderTasks(date: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.reorder,
    mutationFn: reorderTasksMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    ({ categoryId, orderedIds }: { categoryId: string | null; orderedIds: string[] }) => {
      reorderTasksLocal(orderedIds);
      invalidateTaskLists(queryClient);
      mutation.mutate({ categoryUuid: categoryId, orderedUuids: orderedIds });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Same reorder, against the unfiltered `myTasks` list (app/reorder/*). */
export function useReorderMyTasks() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.reorder,
    mutationFn: reorderTasksMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    ({ categoryId, orderedIds }: { categoryId: string | null; orderedIds: string[] }) => {
      reorderTasksLocal(orderedIds);
      invalidateTaskLists(queryClient);
      mutation.mutate({ categoryUuid: categoryId, orderedUuids: orderedIds });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Reorders one task's sub-tasks (app/reorder/subtasks.tsx) via the same
 * update-task path as useUpdateTask (position is one of the fields
 * replaceSubTasksForParentLocal sets from array order). */
export function useReorderMySubTasks() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.update,
    mutationFn: updateTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    ({ id, input }: { id: string; input: TaskUpdateInput }) => {
      if (input.sub_tasks) replaceSubTasksForParentLocal(id, input.sub_tasks);
      invalidateTaskLists(queryClient);
      mutation.mutate({ uuid: id });
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Bare, unbuffered increment mutation - see hooks/use-task-increment-buffer.ts,
 * which calls this from its debounced flush() with the *accumulated* amount
 * (not per-tap), after already applying the tap to the display via
 * patchTaskInCaches itself. Writing to SQLite and pushing both happen inside
 * incrementTaskMutationFn (lib/mutation-defaults.ts) - there's no separate
 * onMutate here for the same reason the original didn't have one. */
export function useIncrementTask() {
  return useMutation({
    mutationKey: mutationKeys.tasks.increment,
    mutationFn: incrementTaskMutationFn,
  });
}

/** Completing a sub-task optimistically flips just that sub-task and
 * recomputes the parent's derived status locally so it shows immediately. */
export function useCompleteSubTask() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.completeSubTask,
    mutationFn: completeSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    (
      { taskId, subTaskId, date }: { taskId: string; subTaskId: string; date?: string },
      options?: { onSuccess?: (data: { parent_status: Task['status']; parent_reward_text?: string }) => void }
    ) => {
      const effectiveDate = date ?? todayISODate();
      const { completionUuid } = toggleSubTaskCompletionLocal(subTaskId, taskId, effectiveDate);
      invalidateTaskLists(queryClient);
      mutation.mutate(
        { completionUuid },
        {
          onSuccess: () => {
            const task = findDerivedTask(effectiveDate, taskId);
            options?.onSuccess?.({ parent_status: task?.status ?? 'pending', parent_reward_text: task?.reward_text ?? undefined });
          },
        }
      );
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

/** Same shape as useCompleteSubTask, but bumps progress_count. */
export function useIncrementSubTask() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: mutationKeys.tasks.incrementSubTask,
    mutationFn: incrementSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });

  const mutate = useCallback(
    (
      { taskId, subTaskId, amount, date }: { taskId: string; subTaskId: string; amount: number; date?: string },
      options?: { onSuccess?: (data: { parent_status: Task['status']; parent_reward_text?: string }) => void }
    ) => {
      const effectiveDate = date ?? todayISODate();
      invalidateTaskLists(queryClient);
      mutation.mutate(
        { subTaskUuid: subTaskId, parentTaskUuid: taskId, amount, date: effectiveDate },
        {
          onSuccess: () => {
            const task = findDerivedTask(effectiveDate, taskId);
            options?.onSuccess?.({ parent_status: task?.status ?? 'pending', parent_reward_text: task?.reward_text ?? undefined });
          },
        }
      );
    },
    [mutation, queryClient]
  );

  return { ...mutation, mutate };
}

export type { Category, ManageableSubTask, ManageableTask };
