import { useState, useRef, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import { fmtDate } from './useTasks';

// Each counter task gets its own hook instance.
// Taps accumulate locally; we flush to the server after inactivity or on unmount.
export function useCounter(taskId, initialProgress, targetCount, date, onUpdate, onRewardEarned) {
  const [localProgress, setLocalProgress] = useState(initialProgress || 0);
  const pendingRef = useRef(0);
  const timerRef = useRef(null);
  const syncingRef = useRef(false);
  const { incrementCounter } = useApi();

  // Reset when task/date changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resync local progress when the task/date changes
    setLocalProgress(initialProgress || 0);
    pendingRef.current = 0;
  }, [taskId, initialProgress]);

  // keepalive: used when the tab is being hidden or closed, so the browser
  // still delivers the taps after the page is gone (B15). A normal fetch
  // started during unload is usually cancelled, losing up to 3 s of taps.
  const flush = useCallback(async ({ keepalive = false } = {}) => {
    if (pendingRef.current <= 0 || syncingRef.current) return;
    const amount = pendingRef.current;
    pendingRef.current = 0;
    syncingRef.current = true;

    try {
      const res = await incrementCounter(taskId, fmtDate(date), amount, { keepalive });
      // Server returns updated progress + status
      onUpdate?.({
        progress_count: res.progress_count ?? (localProgress + amount),
        status: res.status,
        reward_text: res.reward_text,
      });
      setLocalProgress(res.progress_count ?? (localProgress + amount));
      if (res.status === 'completed' && res.reward_text) {
        onRewardEarned?.(res.reward_text);
      }
    } catch (err) {
      // Rollback on failure
      setLocalProgress(p => Math.max(0, p - amount));
      pendingRef.current += amount; // re-queue for retry
      console.warn('Counter sync failed, will retry:', err.message);
    } finally {
      syncingRef.current = false;
    }
  }, [taskId, date, localProgress, onUpdate, onRewardEarned, incrementCounter]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), 3000); // 3s of inactivity
  }, [flush]);

  const increment = useCallback((amount) => {
    setLocalProgress(p => {
      const next = Math.min(p + amount, targetCount);
      return next;
    });
    pendingRef.current += amount;
    scheduleFlush();
  }, [targetCount, scheduleFlush]);

  // Flush on unmount (navigating away inside the app; the page stays alive).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current > 0) flush();
    };
  }, [flush]);

  // Flush when the tab is hidden or the page is closing. pagehide also fires
  // on mobile Safari, where visibilitychange may not before the page is
  // discarded.
  useEffect(() => {
    const flushNow = () => {
      if (pendingRef.current <= 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      flush({ keepalive: true });
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushNow);
    };
  }, [flush]);

  return { localProgress, increment, flush };
}