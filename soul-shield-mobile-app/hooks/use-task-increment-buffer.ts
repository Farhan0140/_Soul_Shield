import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Task, TaskStatus } from '@/api/types';
import { useIncrementTask } from '@/hooks/queries/use-task-mutations';
import { queryKeys } from '@/lib/query-keys';

const DEBOUNCE_MS = 4000;

interface UseTaskIncrementBufferOptions {
  taskId: number;
  date: string;
  serverProgressCount: number;
  targetCount: number;
}

export function useTaskIncrementBuffer({
  taskId,
  date,
  serverProgressCount,
  targetCount,
}: UseTaskIncrementBufferOptions) {
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {});
  const queryClient = useQueryClient();
  const incrementMutation = useIncrementTask();

  const displayProgress = serverProgressCount + pending;
  const displayStatus: TaskStatus =
    targetCount > 0 && displayProgress >= targetCount ? 'completed' : 'pending';

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const amount = pendingRef.current;
    if (amount <= 0) return;
    pendingRef.current = 0;
    setPending(0);

    incrementMutation.mutate(
      { taskId, amount, date },
      {
        onSuccess: (data) => {
          // The backend's increment response (CompletionResponse) doesn't include the
          // updated progress_count, only status — so the new count is computed from the
          // amount we just sent rather than read off the response.
          queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
            old?.map((t) =>
              t.task_id === taskId
                ? { ...t, progress_count: (t.progress_count ?? 0) + amount, status: data.status }
                : t
            )
          );
          if (data.status === 'completed') {
            // ...and it doesn't include reward_text either; refetch in the background to
            // pick it up without disrupting the already-patched UI.
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks(date) });
          }
        },
        onError: () => {
          // Re-buffer rather than silently drop the taps, and retry on the next flush window.
          pendingRef.current += amount;
          setPending(pendingRef.current);
          scheduleFlush();
        },
      }
    );
  }, [taskId, date, incrementMutation, queryClient, scheduleFlush]);

  flushRef.current = flush;

  const addAmount = useCallback(
    (amount: number) => {
      pendingRef.current += amount;
      setPending(pendingRef.current);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushRef.current();
    });
    return () => {
      subscription.remove();
      flushRef.current();
    };
  }, [taskId, date]);

  return { displayProgress, displayStatus, addAmount, isFlushing: incrementMutation.isPending };
}
