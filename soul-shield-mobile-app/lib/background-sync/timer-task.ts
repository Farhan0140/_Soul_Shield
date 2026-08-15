import { completeSubTask, completeTask } from '@/api/tasks';
import { computeTaskTimerRemainingMs } from '@/hooks/use-task-timer';
import { cancelTimerTaskCompletionNotification, clearTimerTaskRunningNotification } from '@/lib/timer-task/notifications';
import {
  clearTaskTimerState,
  getActiveTaskTimerKeys,
  getTaskTimerState,
  setTaskTimerState,
} from '@/lib/timer-task/store';
import { tokenStore } from '@/lib/secure-store';

/** Opportunistic, best-effort completion of any Timer Task that reached its
 * duration while the app was closed/backgrounded — called on every
 * background-sync wake-up (task.ts), not just within the once-nightly sync
 * window, since a running timer can finish at any time of day. Runs headlessly
 * with no component tree mounted, so unlike hooks/use-task-timer.ts's
 * dispatchCompletion it can't call a React Query mutation hook — it calls the
 * plain API functions directly (the same ones the mutation hooks ultimately
 * wrap), exactly the way lib/background-sync/sync.ts avoids depending on a
 * live QueryClient for its own headless path. The task-list cache catches up
 * afterward via the app's normal foreground/reconnect resync, or via
 * useTaskTimer's own mount-time reconciliation reading `completionDispatched`
 * once the app is reopened. */
export async function checkAndCompleteFinishedTaskTimers(): Promise<void> {
  const keys = await getActiveTaskTimerKeys();
  if (keys.length === 0) return;

  const token = await tokenStore.getToken();
  if (!token) return; // signed out — nothing to do, mirrors runFullBackgroundSyncInner's own early-return

  for (const key of keys) {
    try {
      const state = await getTaskTimerState(key);
      if (!state || state.status !== 'running' || state.completionDispatched) continue;

      const remaining = computeTaskTimerRemainingMs(state, Date.now());
      if (remaining > 0) continue;

      // Marked dispatched BEFORE the network call — same ordering rationale
      // as hooks/use-task-timer.ts's in-hook dispatch, so a process kill
      // mid-call can't cause a duplicate completion call on the next
      // wake-up; a transient network failure below is safely retried next
      // time since the server's Complete()/CompleteSubTask() upsert on
      // (task_id, user_id, task_date) makes a repeat call idempotent.
      await setTaskTimerState(key, { ...state, status: 'completed', completionDispatched: true });

      if (state.subTaskId != null) {
        await completeSubTask(state.taskId, state.subTaskId, state.date, token);
      } else {
        await completeTask(state.taskId, state.date, token);
      }

      await cancelTimerTaskCompletionNotification(state.taskId, state.subTaskId, state.date);
      await clearTimerTaskRunningNotification(state.taskId, state.subTaskId, state.date);
      await clearTaskTimerState(key);
    } catch {
      // Leave this key's state as-is (completionDispatched already true if
      // we got that far) — the next wake-up, or the app reopening, will
      // pick it back up.
    }
  }
}
