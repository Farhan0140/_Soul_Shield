import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import type { TaskStatus } from '@/api/types';
import { useIncrementTask } from '@/hooks/queries/use-task-mutations';
import { getLocalDb } from '@/lib/db/client';
import { getTaskCompletionForDate, incrementTaskCompletionLocal } from '@/lib/db/completions-repo';
import { persistOptions } from '@/lib/persister';
import { patchTaskInCaches } from '@/lib/task-cache';

const DEBOUNCE_MS = 4000;

function pendingStorageKey(taskId: string, date: string) {
  return `soulshield_pending_increment_${taskId}_${date}`;
}

// Buffer bookkeeping for a single taskId+date, shared by every mounted
// useTaskIncrementBuffer instance for that task (e.g. the inline card on the
// task list AND the dedicated counter page — React Navigation keeps the
// list screen mounted underneath the pushed counter page, so both are alive
// at once). This used to live in per-instance refs while every instance
// persisted to the *same* AsyncStorage backstop key — so one instance's
// still-live, not-yet-flushed amount looked to another instance's mount-time
// "recover a killed session's leftovers" check like an orphaned leftover. It
// got recovered a second time and flushed independently by both instances,
// so the server received more than what was actually tapped (e.g. tapping
// +5 on the card then +5 on the counter page sent +5 and +10 instead of +5
// and +5). Sharing this bookkeeping — and only ever recovering a key once
// per app session — makes every mounted instance for the same task
// contribute to one buffer with one flush, matching how the display cache
// (patchTaskInCaches) is already shared across instances.
interface SharedIncrementBuffer {
  // Amount tapped but not yet confirmed *pushed* to the server - every tap's
  // amount is already durably applied to local SQLite the moment it happens
  // (see addAmount below), so this only tracks what flush() still owes the
  // network, not what still needs applying locally.
  pending: number;
  // Portion of `pending` that's currently dispatched (mutate() has been
  // called) AND confirmed durably persisted to disk, but hasn't settled
  // (succeeded/failed) yet — excluded from the backstop because react-query's
  // own persisted-mutation replay now owns delivering it. Reconciled back to
  // 0 for that amount as soon as the dispatch settles either way.
  excluded: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  isFlushing: boolean;
  // Whether the AsyncStorage backstop for this key has already been checked
  // this app session — guards the recovery effect so it runs once per
  // taskId+date no matter how many components mount a buffer for it, rather
  // than once per mount.
  recovered: boolean;
  refCount: number;
  flush: () => void;
}

const sharedBuffers = new Map<string, SharedIncrementBuffer>();

function getSharedBuffer(key: string): SharedIncrementBuffer {
  let buffer = sharedBuffers.get(key);
  if (!buffer) {
    buffer = {
      pending: 0,
      excluded: 0,
      timer: undefined,
      isFlushing: false,
      recovered: false,
      refCount: 0,
      flush: () => {},
    };
    sharedBuffers.set(key, buffer);
  }
  return buffer;
}

interface UseTaskIncrementBufferOptions {
  taskId: string;
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
  const bufferKey = pendingStorageKey(taskId, date);
  const shared = useMemo(() => getSharedBuffer(bufferKey), [bufferKey]);
  const queryClient = useQueryClient();
  const incrementMutation = useIncrementTask();
  const isRestoring = useIsRestoring();

  // Cache-first display: progress lives entirely in the shared
  // queryKeys.tasks(date) cache (patched synchronously below, straight from
  // local SQLite via incrementTaskCompletionLocal - see addAmount), not in
  // hook-local state — so every mounted consumer of that cache (the inline
  // task list AND the dedicated counter page, however many are mounted at
  // once) reflects a tap immediately, with no network round trip. And since
  // the same tap already landed in SQLite by the time this patch happens,
  // any *other* refetch of this query (opening a separate page, a
  // background sync, another mutation elsewhere invalidating ['tasks']) sees
  // the same up-to-date number instead of momentarily reverting it.
  const displayProgress = serverProgressCount;
  const displayStatus: TaskStatus =
    targetCount > 0 && displayProgress >= targetCount ? 'completed' : 'pending';

  const persistPending = useCallback(() => {
    const amount = Math.max(shared.pending - shared.excluded, 0);
    if (amount > 0) {
      AsyncStorage.setItem(bufferKey, String(amount)).catch(() => {});
    } else {
      AsyncStorage.removeItem(bufferKey).catch(() => {});
    }
  }, [bufferKey, shared]);

  const scheduleFlush = useCallback(() => {
    if (shared.timer) clearTimeout(shared.timer);
    shared.timer = setTimeout(() => shared.flush(), DEBOUNCE_MS);
  }, [shared]);

  const flush = useCallback(() => {
    if (shared.timer) {
      clearTimeout(shared.timer);
      shared.timer = undefined;
    }
    // A prior flush's mutation is still in flight (or paused offline by
    // onlineManager) — leave its buffered amount displayed as pending rather
    // than double-submitting; onSettled below will re-flush any newly
    // buffered taps once it resolves.
    if (shared.isFlushing) return;
    const amount = shared.pending;
    if (amount <= 0) return;
    // The row always exists by now - addAmount (or a previous session's
    // addAmount, recovered below) already created it via
    // incrementTaskCompletionLocal before shared.pending could ever be > 0.
    const completion = getTaskCompletionForDate(taskId, date);
    if (!completion) return;
    shared.isFlushing = true;
    // Settlement (success or error) is the ground truth for whether `amount`
    // is still outstanding; it always fires eventually once online and takes
    // priority over — and must not be clobbered by — the persistence
    // confirmation below, which only resolves the "definitely queued for
    // replay while still paused offline" case.
    let settled = false;

    incrementMutation.mutate(
      { completionUuid: completion.uuid, taskUuid: taskId, amount },
      {
        onSuccess: (data) => {
          // Only now — once the server has actually confirmed the amount —
          // do we remove it from the unconfirmed buffer.
          shared.pending -= amount;
          // The backend's increment response (CompletionResponse) doesn't include the
          // updated progress_count, only status — progress_count itself was already
          // applied locally the moment each tap happened (see addAmount), so only
          // status/reward_text need the server's authoritative confirmation here.
          patchTaskInCaches(queryClient, date, taskId, (t) => ({
            ...t,
            status: data.status,
            reward_text: data.status === 'completed' ? data.reward_text : t.reward_text,
          }));
          if (data.status === 'completed' && data.reward_text) {
            onRewardEarned?.(data.reward_text);
          }
        },
        onSettled: () => {
          settled = true;
          shared.isFlushing = false;
          shared.excluded = Math.max(shared.excluded - amount, 0);
          persistPending();
          // Taps buffered while this mutation was in flight/paused still need to go out.
          if (shared.pending > 0) {
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
        shared.excluded += amount;
        persistPending();
      });
  }, [shared, taskId, date, incrementMutation, queryClient, scheduleFlush, onRewardEarned, persistPending]);

  // Reassigned on every render of every mounted instance for this key — the
  // shared timer (scheduleFlush) and AppState listener always call whichever
  // instance rendered most recently, but since they operate on `shared`'s
  // pending/isFlushing bookkeeping rather than instance-local state, exactly
  // one flush dispatches the full combined amount no matter which instance's
  // closure runs it.
  shared.flush = flush;

  const addAmount = useCallback(
    (amount: number) => {
      // incrementTaskCompletionLocal silently returns a zeroed {progressCount:
      // 0, status: 'pending'} when the local database isn't open yet
      // (pre-native-rebuild device - see lib/db/client.ts's getLocalDb) -
      // applying that here would reset the display instead of incrementing
      // it, which is worse than doing nothing. Fail loudly instead, same as
      // every other mutation once local SQLite is a hard requirement (see
      // lib/mutation-defaults.ts's assertLocalDbAvailable).
      if (!getLocalDb()) {
        throw new Error('Offline database is not ready on this device yet - please update the app to sync changes.');
      }
      // Applied to local SQLite immediately — not just the display cache —
      // so this task's row is always the up-to-date source of truth for any
      // read that happens next, from any screen, regardless of whether
      // flush() has actually pushed it to the server yet (see the module
      // comment on `pending` above for why that distinction matters).
      const local = incrementTaskCompletionLocal(taskId, date, amount, targetCount);
      patchTaskInCaches(queryClient, date, taskId, (t) => ({
        ...t,
        progress_count: local.progressCount,
        status: local.status,
      }));
      shared.pending += amount;
      persistPending();
      scheduleFlush();
    },
    [queryClient, date, taskId, targetCount, scheduleFlush, persistPending, shared]
  );

  // Recover a buffer left behind by a previous *app* session that got killed
  // before its debounce timer fired (or before the AppState background flush
  // ran) — every tap in that session was already committed to local SQLite
  // the moment it happened (see addAmount above), so there's nothing left to
  // (re-)apply to the display here, only the *push* to resume: restore
  // shared.pending from the backstop and let scheduleFlush send it once
  // connectivity allows. Guarded by shared.recovered so this only ever runs
  // once per taskId+date per app session: since the AsyncStorage key is
  // shared across every instance for this task, re-running it on a later
  // mount (e.g. opening the dedicated counter page while the task-list card
  // is still alive and holding an unflushed tap) would recover an amount
  // another live instance already owns and is about to flush itself,
  // double-counting it.
  useEffect(() => {
    if (isRestoring || shared.recovered) return;
    shared.recovered = true;
    let cancelled = false;
    AsyncStorage.getItem(bufferKey)
      .then((stored) => {
        if (cancelled || !stored) return;
        const amount = Number(stored);
        if (Number.isFinite(amount) && amount > 0) {
          shared.pending += amount;
          scheduleFlush();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bufferKey, scheduleFlush, isRestoring, shared]);

  // Flushes once the *last* mounted instance for this taskId+date goes away,
  // rather than on every instance's unmount — while a sibling instance (e.g.
  // the other of {task-list card, dedicated counter page}) is still mounted,
  // it still owns the shared buffer and will flush it in due course.
  useEffect(() => {
    shared.refCount += 1;
    return () => {
      shared.refCount -= 1;
      if (shared.refCount === 0) shared.flush();
    };
  }, [shared]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') shared.flush();
    });
    return () => subscription.remove();
  }, [shared]);

  return { displayProgress, displayStatus, addAmount, isFlushing: incrementMutation.isPending };
}
