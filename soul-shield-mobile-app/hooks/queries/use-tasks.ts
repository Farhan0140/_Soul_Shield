import { useQuery } from '@tanstack/react-query';

import { getMyTasks, getTaskHistory, getTasks } from '@/api/tasks';
import { useAuth } from '@/context/auth-context';
import { getLocalDb } from '@/lib/db/client';
import { deriveManageableTasks, deriveTasksForDate, deriveTasksForRange } from '@/lib/db/tasks-repo';
import { queryKeys } from '@/lib/query-keys';

/** Reads local-first (see lib/db/tasks-repo.ts's deriveTasksForDate — a
 * synchronous SQLite read, works for any date, online or offline) and only
 * falls back to the network when the local database genuinely isn't
 * available yet - i.e. `expo-sqlite` was just added to this app version but
 * this device hasn't installed a rebuilt client that includes it (see
 * lib/db/client.ts's getLocalDb doc comment). Once that rebuild has
 * happened everywhere, this fallback is dead code and the network
 * functions in api/tasks.ts exist purely as that transitional safety net. */
export function useTasksQuery(date: string, enabled = true) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.tasks(date),
    queryFn: () => (getLocalDb() ? deriveTasksForDate(date) : getTasks(date, token)),
    enabled: !!token && enabled,
  });
}

export function useTaskHistoryQuery(from: string, to: string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskHistory(from, to),
    queryFn: () => (getLocalDb() ? deriveTasksForRange(from, to) : getTaskHistory(from, to, token)),
    enabled: !!token,
  });
}

/** Every personal task, unfiltered by date — see app/reorder/*. */
export function useMyTasksQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.myTasks,
    queryFn: () => (getLocalDb() ? deriveManageableTasks() : getMyTasks(token)),
    enabled: !!token,
  });
}
