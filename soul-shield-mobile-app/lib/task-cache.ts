import type { QueryClient } from '@tanstack/react-query';

import type { Task } from '@/api/types';
import { queryKeys } from '@/lib/query-keys';

type TaskUpdater = (task: Task) => Task;

/** Snapshot of queryKeys.tasks(date) before an optimistic patch, so onError
 * can put back exactly what was there. */
export function snapshotTaskCaches(queryClient: QueryClient, date: string): Task[] | undefined {
  return queryClient.getQueryData<Task[]>(queryKeys.tasks(date));
}

export function restoreTaskCaches(queryClient: QueryClient, date: string, snapshot: Task[] | undefined) {
  queryClient.setQueryData(queryKeys.tasks(date), snapshot);
}

/** Cancels an in-flight fetch for queryKeys.tasks(date), so a fetch that
 * resolves right after an optimistic write doesn't clobber it with
 * pre-mutation data. */
export async function cancelTaskCacheFetches(queryClient: QueryClient, date: string) {
  await queryClient.cancelQueries({ queryKey: queryKeys.tasks(date) });
}

/** Applies `updater` to the task identified by `taskId` in the cached
 * queryKeys.tasks(date) list — the single shared source every screen that
 * shows this task (dashboard, category detail, the dedicated counter page,
 * sub-task list) reads from, so this is what makes a completion/increment
 * show up immediately everywhere at once, online or offline. */
export function patchTaskInCaches(queryClient: QueryClient, date: string, taskId: number, updater: TaskUpdater) {
  queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
    old?.map((t) => (t.task_id === taskId ? updater(t) : t))
  );
}
