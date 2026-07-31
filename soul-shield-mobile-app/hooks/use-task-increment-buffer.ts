import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Task, TaskStatus } from '@/api/types';
import { useIncrementTask } from '@/hooks/queries/use-task-mutations';
import { persistOptions } from '@/lib/persister';
import { queryKeys } from '@/lib/query-keys';

const DEBOUNCE_MS = 4000;

function pendingStorageKey(taskId: number, date: string) {
  return `soulshield_pending_increment_${taskId}_${date}`;
}

interface UseTaskIncrementBufferOptions {
  taskId: number;
  date: string;
  serverProgressCount: number;
  targetCount: number;
  onRewardEarned?: (text: string) => void;
}

export function useTaskIncrementBuffer({
  taskId,
  date,
  serverProgressCount,
  targetCount,
  onRewardEarned,
}: UseTaskIncrementBufferOptions) {
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  // Portion of pendingRef.current that's currently dispatched (mutate() has
  // been called) AND confirmed durably persisted to disk, but hasn't settled
  // (succeeded/failed) yet — excluded from the backstop because react-query's
  // own persisted-mutation replay now owns delivering it. Reconciled back to
  // 0 for that amount as soon as the dispatch settles either way.
  const excludedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {});
  const isFlushingRef = useRef(false);
  const queryClient = useQueryClient();
  const incrementMutation = useIncrementTask();

  const displayProgress = serverProgressCount + pending;
  const displayStatus: TaskStatus =
    targetCount > 0 && displayProgress >= targetCount ? 'completed' : 'pending';

  // Backstops the pre-dispatch window: taps sit in pendingRef (JS-only) for
  // up to DEBOUNCE_MS before flush() ever calls mutate(). Once mutate() runs,
  // the amount becomes a real react-query mutation, which the AsyncStorage
  // persister dehydrates (including paused-offline mutations, see
  // lib/persister.ts) and replays via resumePausedMutations() — but that
  // write is async/throttled, not immediate. flush() is also what runs right
  // as the app backgrounds (see the AppState effect below), so mutate() and
  // the app being killed can happen back-to-back with barely any lead time
  // for that throttled write to land. We therefore keep this backstop set
  // until we've explicitly awaited a persistQueryClientSave() after mutate()
  // confirms the mutation is actually on disk — clearing it any earlier left
  // a window where a kill lost the amount from both places at once.
  const persistPending = useCallback(
    (amount: number) => {
      const key = pendingStorageKey(taskId, date);
      if (amount > 0) {
        AsyncStorage.setItem(key, String(amount)).catch(() => {});
      } else {
        AsyncStorage.removeItem(key).catch(() => {});
      }
    },
    [taskId, date]
  );

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // A prior flush's mutation is still in flight (or paused offline by
    // onlineManager) — leave its buffered amount displayed as pending rather
    // than double-submitting; onSettled below will re-flush any newly
    // buffered taps once it resolves.
    if (isFlushingRef.current) return;
    const amount = pendingRef.current;
    if (amount <= 0) return;
    isFlushingRef.current = true;
    // Settlement (success or error) is the ground truth for whether `amount`
    // is still outstanding; it always fires eventually once online and takes
    // priority over — and must not be clobbered by — the persistence
    // confirmation below, which only resolves the "definitely queued for
    // replay while still paused offline" case.
    let settled = false;

    incrementMutation.mutate(
      { taskId, amount, date },
      {
        onSuccess: (data) => {
          // Only now — once the server has actually confirmed the amount —
          // do we remove it from the unconfirmed buffer. Clearing it earlier
          // (e.g. immediately on dispatch) makes the counter visibly revert
          // to the stale server value while offline, since a paused mutation
          // doesn't call onSuccess/onError until connectivity returns.
          pendingRef.current -= amount;
          setPending(pendingRef.current);
          // The backend's increment response (CompletionResponse) doesn't include the
          // updated progress_count, only status — so the new count is computed from the
          // amount we just sent rather than read off the response. reward_text, on the
          // other hand, comes straight from the response once status is 'completed'.
          queryClient.setQueryData<Task[]>(queryKeys.tasks(date), (old) =>
            old?.map((t) =>
              t.task_id === taskId
                ? {
                    ...t,
                    progress_count: (t.progress_count ?? 0) + amount,
                    status: data.status,
                    reward_text: data.status === 'completed' ? data.reward_text : t.reward_text,
                  }
                : t
            )
          );
          if (data.status === 'completed' && data.reward_text) {
            onRewardEarned?.(data.reward_text);
          }
        },
        onSettled: () => {
          settled = true;
          isFlushingRef.current = false;
          excludedRef.current = Math.max(excludedRef.current - amount, 0);
          persistPending(Math.max(pendingRef.current - excludedRef.current, 0));
          // Taps buffered while this mutation was in flight/paused still need to go out.
          if (pendingRef.current > 0) {
            scheduleFlush();
          }
        },
      }
    );

    // mutate() only adds the mutation to the in-memory cache synchronously;
    // writing it (paused or not) to AsyncStorage is async/throttled (see
    // lib/persister.ts), and flush() can run right as the app backgrounds —
    // so mutate() and an app kill can happen back-to-back with barely any
    // lead time for that write to land on its own. Explicitly await our own
    // save here so we only stop treating `amount` as needing our backstop
    // once it's actually confirmed on disk (and thus owned by react-query's
    // paused-mutation replay from here on).
    persistQueryClientSave({ queryClient, ...persistOptions })
      .catch(() => {})
      .then(() => {
        if (settled) return; // onSettled already persisted the final, correct value
        excludedRef.current += amount;
        persistPending(Math.max(pendingRef.current - excludedRef.current, 0));
      });
  }, [taskId, date, incrementMutation, queryClient, scheduleFlush, onRewardEarned, persistPending]);

  flushRef.current = flush;

  const addAmount = useCallback(
    (amount: number) => {
      pendingRef.current += amount;
      setPending(pendingRef.current);
      persistPending(Math.max(pendingRef.current - excludedRef.current, 0));
      scheduleFlush();
    },
    [scheduleFlush, persistPending]
  );

  // Recover a buffer left behind by a previous session that got killed before
  // its debounce timer fired (or before the AppState background flush ran) —
  // without this, those taps would just be gone on relaunch.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(pendingStorageKey(taskId, date))
      .then((stored) => {
        if (cancelled || !stored) return;
        const amount = Number(stored);
        if (Number.isFinite(amount) && amount > 0) {
          pendingRef.current += amount;
          setPending(pendingRef.current);
          scheduleFlush();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskId, date, scheduleFlush]);

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
