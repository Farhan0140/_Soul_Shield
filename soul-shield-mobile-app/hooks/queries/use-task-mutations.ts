import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Task } from '@/api/types';
import {
  completeTaskMutationFn,
  createTaskMutationFn,
  deleteTaskMutationFn,
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
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) => (t.task_id === id ? { ...t, ...input } : t))
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
        old?.map((t) => (t.task_id === taskId ? { ...t, status: 'completed' as const } : t))
      );
      return { previous, date };
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
