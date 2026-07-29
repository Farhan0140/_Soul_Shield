import { useQuery } from '@tanstack/react-query';

import { getTaskHistory, getTasks } from '@/api/tasks';
import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';

export function useTasksQuery(date: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.tasks(date),
    queryFn: () => getTasks(date, token),
    enabled: !!token,
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
