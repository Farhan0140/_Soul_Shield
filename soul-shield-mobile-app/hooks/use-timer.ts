import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  cancelTimerCompletionNotification,
  clearTimerRunningNotification,
  ensureTimerNotificationChannel,
  scheduleTimerCompletionNotification,
  showTimerRunningNotification,
} from '@/lib/timer/notifications';
import {
  DEFAULT_TIMER_STATE,
  getTimerState,
  setTimerState,
  type TimerSelection,
  type TimerState,
} from '@/lib/timer/store';
import { vibrateComplete, vibrateStart } from '@/lib/timer/vibration';

const TICK_MS = 250;
const RUNNING_NOTIFICATION_REFRESH_MS = 60_000;

function selectionToMs(selection: TimerSelection): number {
  return (selection.hours * 3600 + selection.minutes * 60 + selection.seconds) * 1000;
}

/** Wall-clock derived remaining time — never trusts an interval tick count,
 * so backgrounding/killing the app or dropping animation frames can't desync
 * it (same philosophy as lib/background-sync/time.ts). */
function computeRemainingMs(state: TimerState, now: number): number {
  const elapsed = state.accumulatedMs + (state.status === 'running' && state.startedAt ? now - state.startedAt : 0);
  return Math.max(0, state.durationMs - elapsed);
}

/** Single source of truth for the Timer screen: an offline-only countdown
 * whose remaining time is always recomputed from persisted absolute
 * timestamps (see lib/timer/store.ts), plus best-effort OS notifications
 * (lib/timer/notifications.ts) so completion still vibrates reliably even
 * when the app is backgrounded or killed. */
export function useTimer() {
  const [state, setState] = useState<TimerState>(DEFAULT_TIMER_STATE);
  // Mirrors `state` so interval/AppState callbacks (created once, or on a
  // cadence unrelated to render) always read the latest value rather than a
  // stale closure — same idiom as hooks/use-task-increment-buffer.ts.
  const stateRef = useRef(state);
  stateRef.current = state;

  const [now, setNow] = useState(() => Date.now());

  const applyState = useCallback((next: TimerState) => {
    stateRef.current = next;
    setState(next);
    setTimerState(next).catch(() => {});
  }, []);

  const finalizeCompletion = useCallback(
    (vibrateNow: boolean) => {
      const current = stateRef.current;
      if (current.status !== 'running') return;
      applyState({ ...current, status: 'idle', startedAt: null, accumulatedMs: 0 });
      cancelTimerCompletionNotification().catch(() => {});
      clearTimerRunningNotification().catch(() => {});
      if (vibrateNow) vibrateComplete(current.vibrationEnabled);
    },
    [applyState]
  );

  // Load persisted state once on mount, then resolve whatever happened while
  // this screen wasn't mounted (or the app wasn't running): if a run
  // completed in the background, the scheduled notification already
  // delivered the vibration, so this finalizes silently rather than
  // double-vibrating.
  useEffect(() => {
    ensureTimerNotificationChannel().catch(() => {});
    getTimerState().then((loaded) => {
      stateRef.current = loaded;
      setState(loaded);
      setNow(Date.now());
      if (loaded.status === 'running' && computeRemainingMs(loaded, Date.now()) <= 0) {
        finalizeCompletion(false);
      } else if (loaded.status === 'running') {
        showTimerRunningNotification(computeRemainingMs(loaded, Date.now())).catch(() => {});
      }
    });
  }, [finalizeCompletion]);

  // Re-derive on every foreground resume — covers "reached zero while
  // backgrounded" and refreshes the running notification's text.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') return;
      const current = stateRef.current;
      setNow(Date.now());
      if (current.status !== 'running') return;
      if (computeRemainingMs(current, Date.now()) <= 0) {
        finalizeCompletion(false);
      } else {
        showTimerRunningNotification(computeRemainingMs(current, Date.now())).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [finalizeCompletion]);

  // UI-refresh tick — purely decorative re-render + live completion
  // detection while the app is actually in the foreground; the countdown's
  // source of truth is always the timestamp math above, never this counter.
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      const current = stateRef.current;
      const remaining = computeRemainingMs(current, Date.now());
      if (remaining <= 0) {
        finalizeCompletion(true);
      } else {
        setNow(Date.now());
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.status, finalizeCompletion]);

  // Best-effort running-notification refresh while foregrounded (see
  // lib/timer/notifications.ts's doc comment on the accuracy trade-off).
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      showTimerRunningNotification(computeRemainingMs(stateRef.current, Date.now())).catch(() => {});
    }, RUNNING_NOTIFICATION_REFRESH_MS);
    return () => clearInterval(id);
  }, [state.status]);

  const setSelection = useCallback(
    (selection: TimerSelection) => {
      const current = stateRef.current;
      if (current.status !== 'idle') return;
      applyState({ ...current, selection, durationMs: selectionToMs(selection) });
    },
    [applyState]
  );

  const start = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'idle') return;
    const durationMs = selectionToMs(current.selection);
    if (durationMs <= 0) return;
    const startedAt = Date.now();
    applyState({ ...current, status: 'running', durationMs, startedAt, accumulatedMs: 0 });
    setNow(startedAt);
    vibrateStart(current.vibrationEnabled);
    scheduleTimerCompletionNotification(new Date(startedAt + durationMs)).catch(() => {});
    showTimerRunningNotification(durationMs).catch(() => {});
  }, [applyState]);

  const pause = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'running' || current.startedAt == null) return;
    const accumulatedMs = current.accumulatedMs + (Date.now() - current.startedAt);
    applyState({ ...current, status: 'paused', startedAt: null, accumulatedMs });
    cancelTimerCompletionNotification().catch(() => {});
    clearTimerRunningNotification().catch(() => {});
  }, [applyState]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused') return;
    const startedAt = Date.now();
    const remaining = computeRemainingMs(current, startedAt);
    applyState({ ...current, status: 'running', startedAt });
    setNow(startedAt);
    vibrateStart(current.vibrationEnabled);
    scheduleTimerCompletionNotification(new Date(startedAt + remaining)).catch(() => {});
    showTimerRunningNotification(remaining).catch(() => {});
  }, [applyState]);

  const reset = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'idle') return;
    applyState({
      ...current,
      status: 'idle',
      startedAt: null,
      accumulatedMs: 0,
      durationMs: selectionToMs(current.selection),
    });
    setNow(Date.now());
    cancelTimerCompletionNotification().catch(() => {});
    clearTimerRunningNotification().catch(() => {});
  }, [applyState]);

  const toggleVibration = useCallback(() => {
    const current = stateRef.current;
    applyState({ ...current, vibrationEnabled: !current.vibrationEnabled });
  }, [applyState]);

  const remainingMs = computeRemainingMs(state, now);
  const progress = state.durationMs > 0 ? 1 - remainingMs / state.durationMs : 0;

  return {
    status: state.status,
    selection: state.selection,
    setSelection,
    remainingMs,
    durationMs: state.durationMs,
    progress: Math.min(1, Math.max(0, progress)),
    vibrationEnabled: state.vibrationEnabled,
    toggleVibration,
    start,
    pause,
    resume,
    reset,
  };
}
