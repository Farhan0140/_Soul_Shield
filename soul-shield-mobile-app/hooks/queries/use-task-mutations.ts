import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Category, SubTask, Task, TaskStatus } from '@/api/types';
import {
  completeSubTaskMutationFn,
  completeTaskMutationFn,
  createTaskMutationFn,
  deleteTaskMutationFn,
  incrementSubTaskMutationFn,
  incrementTaskMutationFn,
  updateTaskMutationFn,
} from '@/lib/mutation-defaults';
import { mutationKeys } from '@/lib/mutation-keys';
import { queryKeys } from '@/lib/query-keys';
import { todayISODate, weekdayIndex } from '@/lib/date';
import { cancelTaskReminders } from '@/lib/notifications';
import {
  cancelTaskCacheFetches,
  patchTaskInCaches,
  restoreTaskCaches,
  snapshotTaskCaches,
} from '@/lib/task-cache';
import { refreshTaskCacheAfterStructuralChange } from '@/lib/task-cache-refresh';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

/** Client-side mirror of the backend's parent-status aggregation
 * (repo/subtask_status.go `computeParentStatus`) — used to keep a sub-tasked
 * parent's status right in optimistic updates instead of showing stale data
 * until a refetch (which, while offline, may not happen for a while). Always
 * resolves to 'pending' rather than 'missed' on zero completions because
 * sub-task actions are only ever enabled for *today* (see TaskCard's
 * isReadOnly gating), so a missed-in-the-past case never reaches here. */
function deriveParentStatus(subTasks: SubTask[]): TaskStatus {
  if (subTasks.length === 0) return 'pending';
  const completed = subTasks.filter((s) => s.status === 'completed').length;
  if (completed === subTasks.length) return 'completed';
  if (completed > 0) return 'partially_completed';
  return 'pending';
}

/** Defaults to today since that's what's on screen when the "+" create flow
 * is used in practice — the placeholder just needs to appear on whichever
 * list is currently visible while the create mutation is in flight/paused
 * offline; it's reconciled with the real task by the onSettled refetch. */
export function useCreateTask(date: string = todayISODate()) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.create,
    mutationFn: createTaskMutationFn,
    onMutate: async (input) => {
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);

      const scheduledToday =
        input.recurrence_type === 'daily' || input.recurrence_days.includes(weekdayIndex(date));
      if (!scheduledToday) return { previous };

      const categories = queryClient.getQueryData<Category[]>(queryKeys.categories);
      const category =
        input.category_id != null ? categories?.find((c) => c.id === input.category_id) : undefined;

      const placeholder: Task = {
        task_id: -Date.now(),
        title: input.title,
        description: input.description ?? null,
        is_global: input.is_global,
        recurrence_type: input.recurrence_type,
        recurrence_days: input.recurrence_days,
        date,
        status: 'pending',
        category_id: input.category_id ?? null,
        category_name: category?.name ?? null,
        category_color: category?.color_hex ?? null,
        reward_text: input.reward_text ?? null,
        task_type: input.task_type,
        target_count: input.target_count ?? null,
        duration_seconds: input.duration_seconds ?? null,
        progress_count: 0,
        is_active: true,
        reminder_time: input.reminder_time ?? null,
        sub_tasks: input.sub_tasks?.map((s, i) => ({
          sub_task_id: -Date.now() - i - 1,
          title: s.title,
          task_type: s.task_type,
          target_count: s.target_count ?? null,
          duration_seconds: s.duration_seconds ?? null,
          progress_count: 0,
          status: 'pending' as const,
        })),
      };

      queryClient.setQueryData<Task[]>(key, (old) => [...(old ?? []), placeholder]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks(date), context.previous);
    },
    // Structural change: the cached today+N-day task window may now be stale
    // (a new recurring task can affect future days), so clear and re-fetch it
    // fresh once the create is actually confirmed. Mirrored in
    // mutation-defaults.ts's durable default for the case where this create
    // paused offline and only resolves after an app restart, with no live
    // hook mounted to run this callback.
    onSuccess: () => refreshTaskCacheAfterStructuralChange(queryClient),
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** `date` targets which cached `tasks(date)` list to optimistically patch —
 * task edits themselves aren't date-scoped, only the currently viewed list is. */
export function useUpdateTask(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.update,
    mutationFn: updateTaskMutationFn,
    onMutate: async ({ id, input }) => {
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      // sub_tasks is intentionally left out of the spread: TaskUpdateInput's
      // sub_tasks is a draft (SubTaskInput[], no id/status/progress yet) while
      // Task's is server-shaped (SubTask[]) — the mismatch would otherwise
      // corrupt the cached shape until onSettled's refetch fixes it anyway.
      const { sub_tasks: _draftSubTasks, ...optimisticPatch } = input;
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) => (t.task_id === id ? { ...t, ...optimisticPatch } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks(date), context.previous);
    },
    // See useCreateTask above — same structural-change reasoning, mirrored in
    // mutation-defaults.ts's durable default for the offline-then-restart path.
    onSuccess: () => refreshTaskCacheAfterStructuralChange(queryClient),
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

export function useDeleteTask(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.delete,
    mutationFn: deleteTaskMutationFn,
    onMutate: async (id: number) => {
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) => old?.filter((t) => t.task_id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks(date), context.previous);
    },
    // Cancels the deleted task's scheduled reminders and refreshes the
    // today+N-day cache (see useCreateTask above) on confirmed success — must
    // live here (not just as a per-call `.mutate()` option) since a per-call
    // callback is dropped when the mutation pauses offline and later replays
    // headlessly after an app restart. See mutation-defaults.ts's durable
    // default for that replay path.
    onSuccess: (_data, id) =>
      Promise.all([cancelTaskReminders(id), refreshTaskCacheAfterStructuralChange(queryClient)]),
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** POST /tasks/:id/complete toggles: calling it again on an already-completed
 * task un-completes it (the endpoint returns the resulting TaskStatus, not a
 * fixed 'completed' literal — see CompletionResponse). The checkbox in
 * TaskCard is intentionally left tappable on completed tasks for this. */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.complete,
    mutationFn: completeTaskMutationFn,
    onMutate: async ({ taskId, date }: { taskId: number; date: string }) => {
      await cancelTaskCacheFetches(queryClient, date);
      const snapshot = snapshotTaskCaches(queryClient, date);
      patchTaskInCaches(queryClient, date, taskId, (t) => ({
        ...t,
        status: t.status === 'completed' ? ('pending' as const) : ('completed' as const),
      }));
      return { snapshot, date };
    },
    onSuccess: (data, { taskId, date }) => {
      // Apply the server-confirmed status + reward_text directly, rather than
      // waiting on the onSettled invalidate/refetch below — reward_text only
      // ever arrives via this response (or the refetch it lags behind), so
      // patching it here is what lets the reward modal fire promptly.
      patchTaskInCaches(queryClient, date, taskId, (t) => ({
        ...t,
        status: data.status,
        reward_text: data.status === 'completed' ? data.reward_text : undefined,
      }));
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.date, context.snapshot);
    },
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** Bare, unbuffered increment mutation. Called through
 * hooks/use-task-increment-buffer.ts, which does its own manual optimistic
 * cache patching (it computes the new count from the buffered amount rather
 * than trusting a generic snapshot/diff), so this hook doesn't need its own
 * onMutate. A network failure here pauses the mutation via onlineManager
 * rather than reaching the buffer's onError, so the two don't conflict. */
export function useIncrementTask() {
  return useMutation({
    mutationKey: mutationKeys.tasks.increment,
    mutationFn: incrementTaskMutationFn,
  });
}

/** Completing a sub-task optimistically flips just that sub-task and
 * recomputes the parent's derived status locally (deriveParentStatus) so it
 * shows immediately instead of waiting on a refetch — which, while offline,
 * only happens once the paused mutation finally resumes. The call site
 * (SubTaskList) still gets the server-confirmed parent_status/reward_text via
 * its own `onSuccess` passed to `.mutate()`, which runs after this hook's. */
export function useCompleteSubTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.completeSubTask,
    mutationFn: completeSubTaskMutationFn,
    onMutate: async ({ taskId, subTaskId, date }) => {
      const effectiveDate = date ?? todayISODate();
      await cancelTaskCacheFetches(queryClient, effectiveDate);
      const snapshot = snapshotTaskCaches(queryClient, effectiveDate);

      patchTaskInCaches(queryClient, effectiveDate, taskId, (t) => {
        if (!t.sub_tasks) return t;
        const subTasks = t.sub_tasks.map((s) =>
          s.sub_task_id === subTaskId ? { ...s, status: 'completed' as const } : s
        );
        return { ...t, sub_tasks: subTasks, status: deriveParentStatus(subTasks) };
      });

      return { snapshot, date: effectiveDate };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.date, context.snapshot);
    },
    onSuccess: (data, { taskId, date }) => {
      patchTaskInCaches(queryClient, date ?? todayISODate(), taskId, (t) => ({
        ...t,
        status: data.parent_status,
        reward_text: data.parent_status === 'completed' ? data.parent_reward_text : t.reward_text,
      }));
    },
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** Same optimistic-then-reconcile shape as useCompleteSubTask, but bumps
 * progress_count and flips that one sub-task to completed once it reaches
 * its target — mirroring the server's own increment-then-auto-complete
 * logic (repo/subtask.go Increment) closely enough to display correctly
 * before the real response arrives. */
export function useIncrementSubTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.incrementSubTask,
    mutationFn: incrementSubTaskMutationFn,
    onMutate: async ({ taskId, subTaskId, amount, date }) => {
      const effectiveDate = date ?? todayISODate();
      await cancelTaskCacheFetches(queryClient, effectiveDate);
      const snapshot = snapshotTaskCaches(queryClient, effectiveDate);

      patchTaskInCaches(queryClient, effectiveDate, taskId, (t) => {
        if (!t.sub_tasks) return t;
        const subTasks = t.sub_tasks.map((s) => {
          if (s.sub_task_id !== subTaskId) return s;
          const nextProgress = (s.progress_count ?? 0) + amount;
          const reachedTarget = s.target_count != null && nextProgress >= s.target_count;
          return {
            ...s,
            progress_count: nextProgress,
            status: reachedTarget ? ('completed' as const) : s.status,
          };
        });
        return { ...t, sub_tasks: subTasks, status: deriveParentStatus(subTasks) };
      });

      return { snapshot, date: effectiveDate };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.date, context.snapshot);
    },
    onSuccess: (data, { taskId, date }) => {
      patchTaskInCaches(queryClient, date ?? todayISODate(), taskId, (t) => ({
        ...t,
        status: data.parent_status,
        reward_text: data.parent_status === 'completed' ? data.parent_reward_text : t.reward_text,
      }));
    },
    onSettled: () => invalidateTaskLists(queryClient),
  });
}
