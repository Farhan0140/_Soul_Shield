import type { QueryClient } from '@tanstack/react-query';

import type { SubTask, Task, TaskStatus } from '@/api/types';
import { computeParentStatus } from '@/lib/db/tasks-repo';
import { queryKeys } from '@/lib/query-keys';
import { todayISODate } from '@/lib/date';

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
export function patchTaskInCaches(queryClient: QueryClient, date: string, taskId: string, updater: TaskUpdater) {
  cancelListFetchesContaining(queryClient, date);
  queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
    old?.map((t) => (t.task_id === taskId ? updater(t) : t))
  );
}

/** Cancels any in-flight (pre-local-write) fetch for the day list and every
 * cached history window that contains `date`, so a fetch that resolves after
 * an optimistic patch cannot clobber it with pre-increment data. Fires the
 * cancels without awaiting — TanStack marks those fetches cancelled
 * immediately and they stop writing to the cache. */
function cancelListFetchesContaining(queryClient: QueryClient, date: string) {
  void queryClient.cancelQueries({
    predicate: (query) => {
      const [head, from, to] = query.queryKey as unknown[];
      if (head === 'tasks') return from === date;
      if (head === 'taskHistory') {
        return typeof from === 'string' && typeof to === 'string' && from <= date && date <= to;
      }
      return false;
    },
  });
}

/** Optimistic sub-task patch (#counter performance): applies `updater` to one
 * sub-task inside the cached task (day list + every cached history window
 * that contains `date`), then recomputes the PARENT'S status locally via the
 * shared computeParentStatus (lib/db/tasks-repo.ts) — identical to the next
 * derived refetch, so the instant paint is also the final paint (no revert
 * when the refetch lands; local SQLite was already written synchronously by
 * the caller BEFORE this patch, so any fresh refetch agrees with it). */
export function patchSubTaskInCaches(
  queryClient: QueryClient,
  {
    date,
    taskId,
    subTaskId,
    updateSub,
  }: {
    date: string;
    taskId: string;
    subTaskId: string;
    updateSub: (sub: SubTask) => SubTask;
  }
) {
  const today = todayISODate();

  const applyToTask = (task: Task): Task => {
    if (task.task_id !== taskId || !task.sub_tasks?.length) return task;
    const subTasks = task.sub_tasks.map((s) => (s.sub_task_id === subTaskId ? updateSub(s) : s));
    // The parent's status is ALWAYS derived from its sub-tasks (computeParentStatus
    // in lib/db/tasks-repo.ts) — recompute identically here.
    const status = computeParentStatus(subTasks, task.date, today);
    return { ...task, sub_tasks: subTasks, status };
  };

  patchTaskInCaches(queryClient, date, taskId, applyToTask);
  for (const query of queryClient.getQueryCache().getAll()) {
    const [head, from, to] = query.queryKey as unknown[];
    if (head !== 'taskHistory' || typeof from !== 'string' || typeof to !== 'string') continue;
    if (!(from <= date && date <= to)) continue;
    const old = query.state.data as Task[] | undefined;
    if (old?.length) {
      query.setData(old.map(applyToTask));
    }
  }
}

/** Optimistic sub-task increment: +amount on the progress count — completion
 * never un-completes (monotonic within a day), target-reached flips pending →
 * completed. */export function patchSubTaskIncrementInCaches(
  queryClient: QueryClient,
  params: { date: string; taskId: string; subTaskId: string; amount: number; targetCount: number }
) {
  patchSubTaskInCaches(queryClient, {
    ...params,
    updateSub: (s) => {
      const nextCount = (s.progress_count ?? 0) + params.amount;
      const nextStatus: TaskStatus =
        s.status === 'completed' || (params.targetCount > 0 && nextCount >= params.targetCount)
          ? 'completed'
          : 'pending';
      return {
        ...s,
        progress_count: nextCount,
        status: nextStatus,
        // completed_at not rendered per-sub-task in lists — derived data fills
        // it in on the next refetch; skipping it here keeps state minimal.
      };
    },
  });
}

/** Optimistic whole-task completion toggle (normal + timer tasks' checkbox
 * path — see useCompleteTask) and the sub-task completion toggle (see
 * useCompleteSubTask, which patches through the sub-task variant below). */
export function patchTaskStatusInCaches(queryClient: QueryClient, date: string, taskId: string, status: TaskStatus) {
  patchTaskInCaches(queryClient, date, taskId, (t) => ({
    ...t,
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  }));
}

export function patchSubTaskToggleInCaches(
  queryClient: QueryClient,
  params: { date: string; taskId: string; subTaskId: string; status: TaskStatus }
) {
  patchSubTaskInCaches(queryClient, {
    ...params,
    updateSub: (s) => ({ ...s, status: params.status }),
  });
}
