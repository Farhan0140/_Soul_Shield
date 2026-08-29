import { useQuery } from '@tanstack/react-query';

import { getMyTasks, getTaskHistory, getTasks } from '@/api/tasks';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

export function useTasksQuery(date: string, enabled = true) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.tasks(date),
    queryFn: () => getTasks(date, token),
    enabled: !!token && enabled,
  });
}

export function useTaskHistoryQuery(from: string, to: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskHistory(from, to),
    queryFn: () => getTaskHistory(from, to, token),
    enabled: !!token,
  });
}

/** Every personal task, unfiltered by date — see app/reorder/*. */
export function useMyTasksQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.myTasks,
    queryFn: () => getMyTasks(token),
    enabled: !!token,
  });
}
