import { useQuery } from '@tanstack/react-query';

import { getMyTasks, getTaskHistory, getTasks } from '@/api/tasks';
import { useAuth } from '@/context/auth-context';
import { getLocalDb } from '@/lib/db/client';
import { deriveManageableTasks, deriveTasksForDate, deriveTasksForRange } from '@/lib/db/tasks-repo';
import { queryKeys } from '@/lib/query-keys';

/** Local reads need no account (guest mode); only the pre-rebuild network
 * fallback (no local database on this device) needs a token. */
function canRead(token: string | null): boolean {
  return !!getLocalDb() || !!token;
}

/** Reads local-first (see lib/db/tasks-repo.ts's deriveTasksForDate — a
 * synchronous SQLite read, works for any date, online or offline) and only
 * falls back to the network when the local database genuinely isn't
 * available yet - i.e. `expo-sqlite` was just added to this app version but
 * this device hasn't installed a rebuilt client that includes it (see
 * lib/db/client.ts's getLocalDb doc comment). Once that rebuild has
 * happened everywhere, this fallback is dead code and the network
 * functions in api/tasks.ts exist purely as that transitional safety net. */
// react-query's default networkMode ('online') pauses a query's queryFn
// entirely while onlineManager reports offline (see lib/network.ts, wired to
// real device connectivity) - correct for the REST fallback below, but wrong
// for the local-first read, which needs no network at all and must run every
// time regardless of connectivity. getLocalDb() is stable for the process
// lifetime (cached after the first open attempt - see lib/db/client.ts), so
// this is decided once, not per-render.
const networkMode = getLocalDb() ? 'always' : 'online';

/** Local reads never go stale on a timer. Every change to the local store
 * already invalidates them (local writes, sync pulls, reconnects, a new day
 * on resume - see lib/task-cache.ts), so a time-based staleTime only caused
 * extra synchronous SQLite re-reads while a screen was opening (e.g. opening
 * a category page more than 30 s after Home last read the same day). The
 * network fallback keeps the app-wide default. */
export const localStaleTime = getLocalDb() ? Infinity : undefined;

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
    enabled: canRead(token) && enabled,
    networkMode,
    staleTime: localStaleTime,
  });
}

export function useTaskHistoryQuery(from: string, to: string, enabled = true) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskHistory(from, to),
    queryFn: () => (getLocalDb() ? deriveTasksForRange(from, to) : getTaskHistory(from, to, token)),
    enabled: canRead(token) && enabled,
    networkMode,
    staleTime: localStaleTime,
  });
}

/** Every personal task, unfiltered by date — see app/reorder/*. */
export function useMyTasksQuery(enabled = true) {
  const { token } = useAuth();
  return useQuery({
    queryKey: queryKeys.myTasks,
    queryFn: () => (getLocalDb() ? deriveManageableTasks() : getMyTasks(token)),
    enabled: canRead(token) && enabled,
    networkMode,
    staleTime: localStaleTime,
  });
}
