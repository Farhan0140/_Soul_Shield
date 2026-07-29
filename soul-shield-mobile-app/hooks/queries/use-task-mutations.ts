import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { completeTask, createTask, deleteTask, incrementTask, updateTask } from '@/api/tasks';
import type { Task, TaskInput, TaskUpdateInput } from '@/api/types';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

function invalidateTaskLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['taskHistory'] });
}

export function useCreateTask() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => createTask(input, token),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
}

export function useUpdateTask() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TaskUpdateInput }) =>
      updateTask(id, input, token),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
}

export function useDeleteTask() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTask(id, token),
    onSuccess: () => invalidateTaskLists(queryClient),
  });
}

export function useCompleteTask(date: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => completeTask(taskId, date, token),
    onMutate: async (taskId: number) => {
      const key = queryKeys.tasks(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) => (t.task_id === taskId ? { ...t, status: 'completed' as const } : t))
      );
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.tasks(date), context.previous);
      }
    },
    onSettled: () => invalidateTaskLists(queryClient),
  });
}

/** Bare, unbuffered increment mutation. Used directly as a stub in Phase 2; Phase 3
 * wraps this in a debounced buffer hook instead of calling it per-tap. */
export function useIncrementTask() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: ({ taskId, amount, date }: { taskId: number; amount: number; date?: string }) =>
      incrementTask(taskId, amount, date, token),
  });
}
