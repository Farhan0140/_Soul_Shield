import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Task } from '@/api/types';
import {
  completeSubTaskMutationFn,
  completeTaskMutationFn,
  createTaskMutationFn,
  deleteTaskMutationFn,
  incrementSubTaskMutationFn,
  incrementTaskMutationFn,
  mutationKeys,
  updateTaskMutationFn,
} from '@/lib/mutation-defaults';
import { queryKeys } from '@/lib/query-keys';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.create,
    mutationFn: createTaskMutationFn,
    onSuccess: () => invalidateTaskLists(queryClient),
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
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) =>
          t.task_id === taskId
            ? { ...t, status: t.status === 'completed' ? ('pending' as const) : ('completed' as const) }
            : t
        )
      );
      return { previous, date };
    },
    onSuccess: (data, { taskId, date }) => {
      // Apply the server-confirmed status + reward_text directly, rather than
      // waiting on the onSettled invalidate/refetch below — reward_text only
      // ever arrives via this response (or the refetch it lags behind), so
      // patching it here is what lets the reward modal fire promptly.
      queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
        old?.map((t) =>
          t.task_id === taskId
            ? { ...t, status: data.status, reward_text: data.status === 'completed' ? data.reward_text : undefined }
            : t
        )
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks(context.date), context.previous);
      }
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

/** Completing/incrementing a sub-task changes the *parent's* aggregate status,
 * which is computed server-side across potentially many siblings — rather
 * than hand-rolling optimistic patches for that nested aggregation, these
 * just invalidate the task lists on settle so the parent card refetches with
 * the server-confirmed status (same trade-off already made for create/update/
 * delete above). */
export function useCompleteSubTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.completeSubTask,
    mutationFn: completeSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

export function useIncrementSubTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.tasks.incrementSubTask,
    mutationFn: incrementSubTaskMutationFn,
    onSettled: () => invalidateTaskLists(queryClient),
  });
}
