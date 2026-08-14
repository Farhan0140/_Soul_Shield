import type { QueryClient } from '@tanstack/react-query';

import type { PaginatedTasks, Task } from '@/api/types';
import { queryKeys } from '@/lib/query-keys';

type TaskUpdater = (task: Task) => Task;

/** A task is rendered from two independent query cache entries at once:
 * queryKeys.tasks(date) (the dashboard's day list, and every screen that
 * reads it directly — the counter page, sub-task list) and any cached
 * queryKeys.categoryTasks(categoryId, date, page) page for that same date
 * (a category detail screen, opened from the dashboard's category sections).
 * Both ultimately describe the same server-side task, but react-query has no
 * way to know that — they're unrelated cache keys. */
function matchingCategoryTasksQueries(queryClient: QueryClient, date: string) {
  return queryClient.getQueryCache().findAll({
    queryKey: ['categoryTasks'],
    predicate: (query) => query.queryKey[2] === date,
  });
}

export interface TaskCacheSnapshot {
  tasks: Task[] | undefined;
  categoryTasks: { queryKey: readonly unknown[]; data: PaginatedTasks | undefined }[];
}

/** Captures every cached list containing `date`'s tasks before an optimistic
 * patch, so onError can put back exactly what was there — mirrors the
 * previous-snapshot-then-restore pattern each mutation already used for
 * tasks(date) alone, extended to categoryTasks pages. */
export function snapshotTaskCaches(queryClient: QueryClient, date: string): TaskCacheSnapshot {
  return {
    tasks: queryClient.getQueryData<Task[]>(queryKeys.tasks(date)),
    categoryTasks: matchingCategoryTasksQueries(queryClient, date).map((query) => ({
      queryKey: query.queryKey,
      data: query.state.data as PaginatedTasks | undefined,
    })),
  };
}

export function restoreTaskCaches(queryClient: QueryClient, date: string, snapshot: TaskCacheSnapshot) {
  queryClient.setQueryData(queryKeys.tasks(date), snapshot.tasks);
  for (const { queryKey, data } of snapshot.categoryTasks) {
    queryClient.setQueryData(queryKey, data);
  }
}

/** Cancels in-flight fetches for every cache patchTaskInCaches is about to
 * touch, so a fetch that resolves right after the optimistic write doesn't
 * clobber it with pre-mutation data (mirrors the cancelQueries each mutation
 * already did for tasks(date) alone). */
export async function cancelTaskCacheFetches(queryClient: QueryClient, date: string) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.tasks(date) }),
    queryClient.cancelQueries({ queryKey: ['categoryTasks'], predicate: (query) => query.queryKey[2] === date }),
  ]);
}

/** Applies `updater` to the task identified by `taskId` in every cache that
 * currently holds it for `date` — both queryKeys.tasks(date) and any cached
 * categoryTasks page. This is what makes a completion/increment show up
 * immediately regardless of which screen (dashboard vs. category detail) the
 * user is looking at: online, the gap this closes is invisible because
 * onSettled's invalidate+refetch lands within a network round trip, but
 * offline that refetch pauses along with everything else (queries default to
 * the same networkMode: 'online' pause behavior mutations do), so without
 * this the category screen would sit on stale data until reconnect. */
export function patchTaskInCaches(queryClient: QueryClient, date: string, taskId: number, updater: TaskUpdater) {
  queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
    old?.map((t) => (t.task_id === taskId ? updater(t) : t))
  );
  queryClient.setQueriesData<PaginatedTasks>(
    { queryKey: ['categoryTasks'], predicate: (query) => query.queryKey[2] === date },
    (old) => (old ? { ...old, tasks: old.tasks.map((t) => (t.task_id === taskId ? updater(t) : t)) } : old)
  );
}
