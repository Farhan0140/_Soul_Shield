import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { fmtDate } from './useTasks';

// Each counter task gets its own hook instance.
// Taps accumulate locally; we flush to the server after inactivity or on unmount.
export function useCounter(taskId, initialProgress, targetCount, date, onUpdate) {
  const [localProgress, setLocalProgress] = useState(initialProgress || 0);
  const pendingRef = useRef(0);
  const timerRef = useRef(null);
  const syncingRef = useRef(false);

  // Reset when task/date changes
  useEffect(() => {
    setLocalProgress(initialProgress || 0);
    pendingRef.current = 0;
  }, [taskId, initialProgress]);

  const flush = useCallback(async () => {
    if (pendingRef.current <= 0 || syncingRef.current) return;
    const amount = pendingRef.current;
    pendingRef.current = 0;
    syncingRef.current = true;

    try {
      const res = await api.post(`/tasks/${taskId}/increment`, {
        amount,
        date: fmtDate(date),
      });
      // Server returns updated progress + status
      onUpdate?.({
        progress_count: res.progress_count ?? (localProgress + amount),
        status: res.status,
        reward_text: res.reward_text,
      });
      setLocalProgress(res.progress_count ?? (localProgress + amount));
    } catch (err) {
      // Rollback on failure
      setLocalProgress(p => Math.max(0, p - amount));
      pendingRef.current += amount; // re-queue for retry
      console.warn('Counter sync failed, will retry:', err.message);
    } finally {
      syncingRef.current = false;
    }
  }, [taskId, date, localProgress, onUpdate]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 3000); // 3s of inactivity
  }, [flush]);

  const increment = useCallback((amount) => {
    setLocalProgress(p => {
      const next = Math.min(p + amount, targetCount);
      return next;
    });
    pendingRef.current += amount;
    scheduleFlush();
  }, [targetCount, scheduleFlush]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current > 0) flush();
    };
  }, [flush]);

  // Flush when tab becomes hidden
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flush]);

  return { localProgress, increment, flush };
}