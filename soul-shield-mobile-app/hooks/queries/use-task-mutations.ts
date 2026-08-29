import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type {
  AddToMyTasksResponse,
  Category,
  ManageableSubTask,
  ManageableTask,
  SubTask,
  Task,
  TaskStatus,
  TaskUpdateInput,
} from '@/api/types';
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
        // New tasks land at the bottom (see repo.TaskRepo.Create) — the exact
        // value doesn't matter for this placeholder since the confirmed
        // refetch (onSettled) replaces it with the server's real position.
        position: Number.MAX_SAFE_INTEGER,
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

/** Clones a fixed (is_global) task into the current user's own tasks (see
 * POST /tasks/:id/add-to-my-tasks) — a structural change like useCreateTask,
 * and may also create a new category server-side, hence the extra
 * `categories` invalidation on top of the usual task-list ones. `date`
 * targets which cached `tasks(date)` list to flip `already_added` on for the
 * source fixed task (mirrors useDeleteTask/useUpdateTask's `date` param) —
 * the mutation itself (and its durable replay default in
 * lib/mutation-defaults.ts) only takes the task id, so variables stay
 * identical whether this resolves live or replays headlessly. */
export function useAddTaskToMyTasks(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.addToMyTasks,
    mutationFn: addTaskToMyTasksMutationFn,
    onSuccess: (_data: AddToMyTasksResponse, taskId: number) => {
      patchTaskInCaches(queryClient, date, taskId, (t) => ({ ...t, already_added: true }));
      return refreshTaskCacheAfterStructuralChange(queryClient);
    },
    onSettled: () => {
      invalidateTaskLists(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

/** Reorders the caller's personal tasks within one category (`categoryId`
 * null = "Uncategorized") for the given date's cached list. `orderedIds`
 * must be the complete set of that group's current task ids — the backend
 * rejects (409) anything else (see repo.TaskRepo.Reorder). The optimistic
 * patch walks the existing array in its original order and, each time a
 * slot belongs to the affected group, splices in the next id from the new
 * order instead — this leaves every other group's tasks at their original
 * array position, untouched. */
export function useReorderTasks(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.reorder,
    mutationFn: reorderTasksMutationFn,
    onMutate: async ({ categoryId, orderedIds }: { categoryId: number | null; orderedIds: number[] }) => {
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      if (previous) {
        const byId = new Map(previous.map((t) => [t.task_id, t]));
        let cursor = 0;
        const reordered = previous.map((t) =>
          t.category_id === categoryId ? (byId.get(orderedIds[cursor++]) ?? t) : t
        );
        queryClient.setQueryData<Task[]>(key, reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks(date), context.previous);
    },
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** Same splice-by-group technique as useReorderTasks above, but against the
 * unfiltered `myTasks` list the dedicated Reorder page (app/reorder/tasks.tsx)
 * reads from, instead of one date's list. Without this optimistic patch, the
 * new order only lived in that screen's local state - offline, with the
 * actual mutation paused waiting for a connection, navigating away and back
 * (or an app restart) would resync from the still-unreordered cached data and
 * make a queued reorder look like it silently reverted, even though it was
 * safely queued and would still eventually apply. */
export function useReorderMyTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.reorder,
    mutationFn: reorderTasksMutationFn,
    onMutate: async ({ categoryId, orderedIds }: { categoryId: number | null; orderedIds: number[] }) => {
      const key = queryKeys.myTasks;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ManageableTask[]>(key);
      if (previous) {
        const byId = new Map(previous.map((t) => [t.id, t]));
        let cursor = 0;
        const reordered = previous.map((t) =>
          (t.category_id ?? null) === categoryId ? (byId.get(orderedIds[cursor++]) ?? t) : t
        );
        queryClient.setQueryData<ManageableTask[]>(key, reordered);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.myTasks, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myTasks });
      invalidateTaskLists(queryClient);
    },
  });
}

/** Same reasoning as useReorderMyTasks above, but for one task's sub-tasks
 * (app/reorder/subtasks.tsx) - PATCHes the whole task like useUpdateTask,
 * just optimistically reordering `queryKeys.myTasks` instead of a date-scoped
 * list, so a reorder queued offline stays visible there too. */
export function useReorderMySubTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.update,
    mutationFn: updateTaskMutationFn,
    onMutate: async ({ id, input }: { id: number; input: TaskUpdateInput }) => {
      const key = queryKeys.myTasks;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ManageableTask[]>(key);
      const orderedIds = input.sub_tasks
        ?.map((s) => s.id)
        .filter((subId): subId is number => subId != null);
      if (previous && orderedIds) {
        queryClient.setQueryData<ManageableTask[]>(key, (old) =>
          old?.map((t) => {
            if (t.id !== id || !t.sub_tasks) return t;
            const byId = new Map(t.sub_tasks.map((s) => [s.sub_task_id, s]));
            const reordered = orderedIds
              .map((subId) => byId.get(subId))
              .filter((s): s is ManageableSubTask => !!s);
            return reordered.length === t.sub_tasks.length ? { ...t, sub_tasks: reordered } : t;
          })
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.myTasks, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myTasks });
      invalidateTaskLists(queryClient);
    },
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
