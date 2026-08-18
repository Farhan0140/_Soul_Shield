import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';

const TICK_MS = 250;

function storageKey(taskId, subTaskId, date) {
  return `soulshield_web_timer_task_${taskId}_${subTaskId ?? 'main'}_${date}`;
}

function loadState(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode / quota) — the timer still runs
    // for this page session, it just won't survive a reload.
  }
}

function clearState(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function idleState(durationMs) {
  return { status: 'idle', durationMs, startedAt: null, accumulatedMs: 0, completionDispatched: false };
}

/** Wall-clock derived remaining time — never trusts a per-tick decrement, so
 * a throttled background tab (browsers slow down setInterval when hidden)
 * can't desync it; see the visibilitychange handler below for the case where
 * the tab was hidden long enough to have already finished. */
function computeRemainingMs(state, now) {
  const elapsed = state.accumulatedMs + (state.status === 'running' && state.startedAt ? now - state.startedAt : 0);
  return Math.max(0, state.durationMs - elapsed);
}

/** Foreground-only Timer Task countdown for the web client (the web app has
 * no service worker / background execution / offline mutation queue, so this
 * only runs while the tab is open — see the scoped decision on this
 * feature). Timestamp-based like the mobile app's useTaskTimer, persisted to
 * localStorage per task+subTask+date so a reload/reopen within the same
 * browser doesn't lose progress, and dispatches the existing
 * completeTask/completeSubTask API exactly once when the duration is
 * reached — reusing the app's real completion/reward flow, no parallel
 * system. A completion call that fails (offline, request error) is retried
 * on the next mount and whenever the browser regains connectivity, guarded
 * by a persisted `completionDispatched` flag so it can never double-fire;
 * the backend's upsert-on-(task,user,date) makes a repeat call safe either way. */
export function useTimerTask({ taskId, subTaskId = null, date, durationSeconds, isSubTask, onRewardEarned }) {
  const { completeTask, completeSubTask } = useApi();
  const key = storageKey(taskId, subTaskId, date);

  const [state, setState] = useState(() => loadState(key) ?? idleState((durationSeconds || 0) * 1000));
  // Kept in sync with `state` by every call site that sets it (applyState
  // below) rather than via a render-time assignment, so effects/callbacks
  // always read the latest value without a stale closure.
  const stateRef = useRef(state);
  const [now, setNow] = useState(() => Date.now());
  // In-session guard against double-dispatch (e.g. a fast re-render racing
  // the interval tick) — separate from the persisted flag, which guards
  // across reloads/retries instead.
  const dispatchedRef = useRef(false);

  const applyState = useCallback(
    (next) => {
      stateRef.current = next;
      setState(next);
      saveState(key, next);
    },
    [key]
  );

  const syncCompletion = useCallback(() => {
    const call = isSubTask
      ? completeSubTask(taskId, subTaskId, date).then((data) => {
          if (data.parent_status === 'completed' && data.parent_reward_text) {
            onRewardEarned?.(data.parent_reward_text);
          }
          clearState(key);
        })
      : completeTask(taskId, date).then((data) => {
          if (data.status === 'completed' && data.reward_text) onRewardEarned?.(data.reward_text);
          clearState(key);
        });
    return call;
  }, [taskId, subTaskId, date, isSubTask, completeTask, completeSubTask, onRewardEarned, key]);

  const dispatchCompletion = useCallback(() => {
    const current = stateRef.current;
    if (dispatchedRef.current || current.completionDispatched) return;
    dispatchedRef.current = true;
    applyState({ ...current, status: 'completed', completionDispatched: true });
    syncCompletion().catch(() => {});
  }, [applyState, syncCompletion]);

  // Finalizes immediately on mount if the persisted run already reached zero
  // while this page wasn't open. Note: this hook does NOT react to `key`
  // changing after mount — the caller (TaskTimer.jsx) renders its content
  // with `key={runId}` so navigating to a different task/sub-task/date's
  // timer remounts this hook fresh (re-running the lazy useState initializer
  // above) rather than needing an effect to reload state into a live
  // instance, which is both simpler and avoids an unconditional setState
  // call directly in an effect body.
  useEffect(() => {
    const current = stateRef.current;
    if (current.status === 'running' && computeRemainingMs(current, Date.now()) <= 0) {
      dispatchCompletion();
    }
    // Intentionally run only once per mount (see the doc comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retries a completion that was dispatched but never confirmed (offline,
  // request failure, or the page was closed before the response landed) —
  // once on mount and again whenever the browser regains connectivity.
  useEffect(() => {
    const retry = () => {
      if (stateRef.current.status === 'completed') {
        syncCompletion().catch(() => {});
      }
    };
    retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [syncCompletion]);

  // Recompute immediately when the tab regains visibility — covers a
  // throttled/backgrounded tab whose interval ticks were delayed enough that
  // the duration was already reached before this fires.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      const current = stateRef.current;
      if (current.status !== 'running') return;
      if (computeRemainingMs(current, Date.now()) <= 0) dispatchCompletion();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [dispatchCompletion]);

  // UI-refresh tick while running — decorative + live completion detection;
  // the countdown's source of truth is always the timestamp math above.
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      const current = stateRef.current;
      const remaining = computeRemainingMs(current, Date.now());
      if (remaining <= 0) dispatchCompletion();
      else setNow(Date.now());
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.status, dispatchCompletion]);

  const start = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'idle') return;
    const durationMs = current.durationMs > 0 ? current.durationMs : (durationSeconds || 0) * 1000;
    if (durationMs <= 0) return;
    const startedAt = Date.now();
    applyState({ ...current, status: 'running', durationMs, startedAt, accumulatedMs: 0 });
    setNow(startedAt);
  }, [applyState, durationSeconds]);

  const pause = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'running' || current.startedAt == null) return;
    const accumulatedMs = current.accumulatedMs + (Date.now() - current.startedAt);
    applyState({ ...current, status: 'paused', startedAt: null, accumulatedMs });
    setNow(Date.now());
  }, [applyState]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused') return;
    const startedAt = Date.now();
    applyState({ ...current, status: 'running', startedAt });
    setNow(startedAt);
  }, [applyState]);

  const remainingMs = computeRemainingMs(state, now);
  const progress = state.durationMs > 0 ? 1 - remainingMs / state.durationMs : 0;

  return {
    status: state.status,
    remainingMs,
    durationMs: state.durationMs,
    progress: Math.min(1, Math.max(0, progress)),
    start,
    pause,
    resume,
  };
}
