import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useCompleteSubTask, useCompleteTask } from '@/hooks/queries/use-task-mutations';
import {
  cancelTimerTaskCompletionNotification,
  clearTimerTaskRunningNotification,
  scheduleTimerTaskCompletionNotification,
  showTimerTaskRunningNotification,
} from '@/lib/timer-task/notifications';
import {
  clearTaskTimerState,
  getTaskTimerState,
  setTaskTimerState,
  taskTimerKey,
  type TaskTimerState,
} from '@/lib/timer-task/store';

const TICK_MS = 250;
const RUNNING_NOTIFICATION_REFRESH_MS = 60_000;

/** Wall-clock derived remaining time — never trusts an interval tick count,
 * so backgrounding/killing the app or dropping animation frames can't desync
 * it (same philosophy as hooks/use-timer.ts and lib/background-sync/time.ts).
 * Exported for reuse by the background-sync opportunistic-completion check. */
export function computeTaskTimerRemainingMs(state: TaskTimerState, now: number): number {
  const elapsed = state.accumulatedMs + (state.status === 'running' && state.startedAt ? now - state.startedAt : 0);
  return Math.max(0, state.durationMs - elapsed);
}

function idleState(
  taskId: number,
  subTaskId: number | null,
  date: string,
  durationMs: number,
  taskTitle: string
): TaskTimerState {
  return {
    status: 'idle',
    durationMs,
    startedAt: null,
    accumulatedMs: 0,
    taskId,
    subTaskId,
    date,
    taskTitle,
    completionDispatched: false,
  };
}

// Bookkeeping shared by every mounted useTaskTimer instance for the same
// taskId+date+subTaskId — mirrors hooks/use-task-increment-buffer.ts's
// sharedBuffers Map, guarding against the completion mutation firing twice
// if more than one component ever mounts a timer for the same run within one
// app session (e.g. a fast back-then-forward navigation to the dedicated
// page keeping a previous instance briefly alive).
interface SharedTaskTimer {
  dispatched: boolean;
}
const sharedTimers = new Map<string, SharedTaskTimer>();
function getSharedTimer(key: string): SharedTaskTimer {
  let shared = sharedTimers.get(key);
  if (!shared) {
    shared = { dispatched: false };
    sharedTimers.set(key, shared);
  }
  return shared;
}

interface UseTaskTimerOptions {
  taskId: number;
  subTaskId?: number | null;
  date: string;
  /** The task's configured duration — only used to seed a fresh/idle run;
   * once a run has started, its durationMs is fixed from whatever was
   * current at that moment (see store.ts's TaskTimerState doc comment). */
  durationSeconds: number;
  taskTitle: string;
  isSubTask: boolean;
  onRewardEarned?: (text: string) => void;
}

/** Single source of truth for a Timer Task's countdown: timestamp-based (see
 * computeTaskTimerRemainingMs), persisted per taskId+date+subTaskId (lib/
 * timer-task/store.ts), and — the piece with no Profile Timer analog —
 * dispatches the app's existing task-completion mutation
 * (useCompleteTask/useCompleteSubTask) exactly once when the duration is
 * reached, guarded both in-memory (this session) and via a persisted flag
 * (across app restarts / background-sync wake-ups) so it can never fire
 * twice. Completion, and therefore rewards and offline queuing, all reuse
 * the app's existing task completion mutations — no parallel system. */
export function useTaskTimer({
  taskId,
  subTaskId = null,
  date,
  durationSeconds,
  taskTitle,
  isSubTask,
  onRewardEarned,
}: UseTaskTimerOptions) {
  const key = taskTimerKey(taskId, date, subTaskId);
  const shared = useMemo(() => getSharedTimer(key), [key]);

  const [state, setState] = useState<TaskTimerState>(() =>
    idleState(taskId, subTaskId, date, durationSeconds * 1000, taskTitle)
  );
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Mirrors `state` so interval/AppState callbacks always read the latest
  // value rather than a stale closure — same idiom as hooks/use-timer.ts and
  // hooks/use-task-increment-buffer.ts.
  const stateRef = useRef(state);
  stateRef.current = state;

  const completeTask = useCompleteTask();
  const completeSubTask = useCompleteSubTask();
  // Decouples dispatchCompletion's identity from the mutation hooks'
  // per-render object identity (and from a caller-supplied inline
  // onRewardEarned) so the effects below don't needlessly re-subscribe.
  const callbacksRef = useRef({ completeTask, completeSubTask, onRewardEarned });
  callbacksRef.current = { completeTask, completeSubTask, onRewardEarned };

  const applyState = useCallback(
    (next: TaskTimerState) => {
      stateRef.current = next;
      setState(next);
      setTaskTimerState(key, next).catch(() => {});
    },
    [key]
  );

  const dispatchCompletion = useCallback(() => {
    const current = stateRef.current;
    if (shared.dispatched || current.completionDispatched) return;
    shared.dispatched = true;

    // Persisted BEFORE the mutation call, same ordering rationale as
    // lib/background-sync/timer-task.ts's headless path: a kill between
    // these two lines still recovers as "already dispatched" on relaunch
    // rather than re-firing the completion call.
    applyState({ ...current, status: 'completed', completionDispatched: true });
    cancelTimerTaskCompletionNotification(taskId, subTaskId, date).catch(() => {});
    clearTimerTaskRunningNotification(taskId, subTaskId, date).catch(() => {});

    if (isSubTask && subTaskId != null) {
      callbacksRef.current.completeSubTask.mutate(
        { taskId, subTaskId, date },
        {
          onSuccess: (data) => {
            if (data.parent_status === 'completed' && data.parent_reward_text) {
              callbacksRef.current.onRewardEarned?.(data.parent_reward_text);
            }
            clearTaskTimerState(key).catch(() => {});
          },
        }
      );
    } else {
      callbacksRef.current.completeTask.mutate(
        { taskId, date },
        {
          onSuccess: (data) => {
            if (data.status === 'completed' && data.reward_text) {
              callbacksRef.current.onRewardEarned?.(data.reward_text);
            }
            clearTaskTimerState(key).catch(() => {});
          },
        }
      );
    }
  }, [shared, applyState, taskId, subTaskId, date, isSubTask, key]);

  // Load persisted state once per run key, then resolve whatever happened
  // while this screen wasn't mounted: if the run already reached zero
  // (backgrounded long enough, or completed via the background-sync
  // opportunistic check), finalize now; otherwise refresh the running
  // notification's text. While idle, the task's current configured duration
  // always wins over whatever was last persisted (e.g. the task was edited).
  useEffect(() => {
    let cancelled = false;
    getTaskTimerState(key).then((persisted) => {
      if (cancelled) return;
      const resolved =
        persisted == null
          ? idleState(taskId, subTaskId, date, durationSeconds * 1000, taskTitle)
          : persisted.status === 'idle'
            ? { ...persisted, durationMs: durationSeconds * 1000 }
            : persisted;
      stateRef.current = resolved;
      setState(resolved);
      setNow(Date.now());
      setLoaded(true);
      if (resolved.status === 'running') {
        const remaining = computeTaskTimerRemainingMs(resolved, Date.now());
        if (remaining <= 0) {
          dispatchCompletion();
        } else {
          showTimerTaskRunningNotification(taskId, subTaskId, date, taskTitle, remaining).catch(() => {});
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, taskId, subTaskId, date, durationSeconds, taskTitle, dispatchCompletion]);

  // Re-derive on every foreground resume — covers "reached zero while
  // backgrounded" and refreshes the running notification's text.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') return;
      const current = stateRef.current;
      setNow(Date.now());
      if (current.status !== 'running') return;
      const remaining = computeTaskTimerRemainingMs(current, Date.now());
      if (remaining <= 0) {
        dispatchCompletion();
      } else {
        showTimerTaskRunningNotification(taskId, subTaskId, date, taskTitle, remaining).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [dispatchCompletion, taskId, subTaskId, date, taskTitle]);

  // UI-refresh tick — purely decorative re-render + live completion
  // detection while the app is actually in the foreground; the countdown's
  // source of truth is always the timestamp math above, never this counter.
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      const current = stateRef.current;
      const remaining = computeTaskTimerRemainingMs(current, Date.now());
      if (remaining <= 0) {
        dispatchCompletion();
      } else {
        setNow(Date.now());
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.status, dispatchCompletion]);

  // Best-effort running-notification refresh while foregrounded (see
  // lib/timer-task/notifications.ts's doc comment on the accuracy trade-off).
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      const remaining = computeTaskTimerRemainingMs(stateRef.current, Date.now());
      showTimerTaskRunningNotification(taskId, subTaskId, date, taskTitle, remaining).catch(() => {});
    }, RUNNING_NOTIFICATION_REFRESH_MS);
    return () => clearInterval(id);
  }, [state.status, taskId, subTaskId, date, taskTitle]);

  const start = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'idle') return;
    const durationMs = current.durationMs > 0 ? current.durationMs : durationSeconds * 1000;
    if (durationMs <= 0) return;
    const startedAt = Date.now();
    applyState({ ...current, status: 'running', durationMs, startedAt, accumulatedMs: 0 });
    setNow(startedAt);
    scheduleTimerTaskCompletionNotification(taskId, subTaskId, date, taskTitle, new Date(startedAt + durationMs)).catch(
      () => {}
    );
    showTimerTaskRunningNotification(taskId, subTaskId, date, taskTitle, durationMs).catch(() => {});
  }, [applyState, taskId, subTaskId, date, taskTitle, durationSeconds]);

  const pause = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'running' || current.startedAt == null) return;
    const accumulatedMs = current.accumulatedMs + (Date.now() - current.startedAt);
    applyState({ ...current, status: 'paused', startedAt: null, accumulatedMs });
    setNow(Date.now());
    cancelTimerTaskCompletionNotification(taskId, subTaskId, date).catch(() => {});
    clearTimerTaskRunningNotification(taskId, subTaskId, date).catch(() => {});
  }, [applyState, taskId, subTaskId, date]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused') return;
    const startedAt = Date.now();
    const remaining = computeTaskTimerRemainingMs(current, startedAt);
    applyState({ ...current, status: 'running', startedAt });
    setNow(startedAt);
    scheduleTimerTaskCompletionNotification(taskId, subTaskId, date, taskTitle, new Date(startedAt + remaining)).catch(
      () => {}
    );
    showTimerTaskRunningNotification(taskId, subTaskId, date, taskTitle, remaining).catch(() => {});
  }, [applyState, taskId, subTaskId, date, taskTitle]);

  const remainingMs = computeTaskTimerRemainingMs(state, now);
  const progress = state.durationMs > 0 ? 1 - remainingMs / state.durationMs : 0;

  return {
    loaded,
    status: state.status,
    remainingMs,
    durationMs: state.durationMs,
    progress: Math.min(1, Math.max(0, progress)),
    start,
    pause,
    resume,
  };
}
