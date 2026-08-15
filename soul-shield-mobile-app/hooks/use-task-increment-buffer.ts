import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import type { TaskStatus } from '@/api/types';
import { useIncrementTask } from '@/hooks/queries/use-task-mutations';
import { persistOptions } from '@/lib/persister';
import { patchTaskInCaches } from '@/lib/task-cache';

const DEBOUNCE_MS = 4000;

function pendingStorageKey(taskId: number, date: string) {
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
  pending: number;
  // Portion of `pending` that's currently dispatched (mutate() has been
  // called) AND confirmed durably persisted to disk, but hasn't settled
  // (succeeded/failed) yet — excluded from the backstop because react-query's
  // own persisted-mutation replay now owns delivering it. Reconciled back to
  // 0 for that amount as soon as the dispatch settles either way.
  excluded: number;
  // Portion of `pending` recovered from a *previous* app session's
  // AsyncStorage backstop (see the recovery effect below) rather than
  // applied to the cache in *this* session by addAmount() — the cache may or
  // may not already reflect it (depends on whether the throttled persister
  // saved before the kill), so it's only (re-)applied once the resumed
  // flush actually confirms it with the server, never assumed.
  recoveredUnapplied: number;
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
      recoveredUnapplied: 0,
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
  const bufferKey = pendingStorageKey(taskId, date);
  const shared = useMemo(() => getSharedBuffer(bufferKey), [bufferKey]);
  const queryClient = useQueryClient();
  const incrementMutation = useIncrementTask();
  const isRestoring = useIsRestoring();

  // Cache-first display: progress lives entirely in the shared
  // queryKeys.tasks(date) cache (patched synchronously below by
  // applyOptimisticProgress), not in hook-local state — so every mounted
  // consumer of that cache (the inline task list AND the dedicated counter
  // page, however many are mounted at once) reflects a tap immediately, with
  // no network round trip and no per-instance buffer to fall out of sync.
  const displayProgress = serverProgressCount;
  const displayStatus: TaskStatus =
    targetCount > 0 && displayProgress >= targetCount ? 'completed' : 'pending';

  const applyOptimisticProgress = useCallback(
    (amount: number) => {
      patchTaskInCaches(queryClient, date, taskId, (t) => {
        const nextProgress = (t.progress_count ?? 0) + amount;
        const reachedTarget = targetCount > 0 && nextProgress >= targetCount;
        return { ...t, progress_count: nextProgress, status: reachedTarget ? ('completed' as const) : t.status };
      });
    },
    [queryClient, date, taskId, targetCount]
  );

  // Backstops the pre-dispatch window: taps sit in shared.pending (JS-only)
  // for up to DEBOUNCE_MS before flush() ever calls mutate(). Once mutate()
  // runs, the amount becomes a real react-query mutation, which the
  // AsyncStorage persister dehydrates (including paused-offline mutations,
  // see lib/persister.ts) and replays via resumePausedMutations() — but that
  // write is async/throttled, not immediate. flush() is also what runs right
  // as the app backgrounds (see the AppState effect below), so mutate() and
  // the app being killed can happen back-to-back with barely any lead time
  // for that throttled write to land. We therefore keep this backstop set
  // until we've explicitly awaited a persistQueryClientSave() after mutate()
  // confirms the mutation is actually on disk — clearing it any earlier left
  // a window where a kill lost the amount from both places at once.
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
    shared.isFlushing = true;
    // Captured now, before this dispatch can mutate it further — see
    // recoveredUnapplied's own comment for what this covers.
    const unappliedAtDispatch = shared.recoveredUnapplied;
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
          // (e.g. immediately on dispatch) would desync it from the amount
          // react-query still considers in flight.
          shared.pending -= amount;
          if (unappliedAtDispatch > 0) {
            // This portion was recovered from a previous session and was
            // never confirmed applied to the cache (see the recovery effect
            // below) — apply it now that the server has confirmed it.
            // Everything else in `amount` was already applied to the cache
            // the moment it was tapped (see addAmount), so it must not be
            // added again here.
            applyOptimisticProgress(unappliedAtDispatch);
            shared.recoveredUnapplied = Math.max(shared.recoveredUnapplied - unappliedAtDispatch, 0);
          }
          // The backend's increment response (CompletionResponse) doesn't include the
          // updated progress_count, only status — progress_count itself was already
          // applied optimistically (see applyOptimisticProgress), so only status/
          // reward_text need the server's authoritative confirmation here.
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
  }, [
    shared,
    taskId,
    date,
    incrementMutation,
    queryClient,
    scheduleFlush,
    onRewardEarned,
    persistPending,
    applyOptimisticProgress,
  ]);

  // Reassigned on every render of every mounted instance for this key — the
  // shared timer (scheduleFlush) and AppState listener always call whichever
  // instance rendered most recently, but since they operate on `shared`'s
  // pending/isFlushing bookkeeping rather than instance-local state, exactly
  // one flush dispatches the full combined amount no matter which instance's
  // closure runs it.
  shared.flush = flush;

  const addAmount = useCallback(
    (amount: number) => {
      // Applied to the shared cache immediately — this is what makes the
      // increment visible right away, offline or online, in every mounted
      // consumer of queryKeys.tasks(date) (the task list, the dedicated
      // counter page, any other view of this same task), not just this
      // component instance.
      applyOptimisticProgress(amount);
      shared.pending += amount;
      persistPending();
      scheduleFlush();
    },
    [applyOptimisticProgress, scheduleFlush, persistPending, shared]
  );

  // Recover a buffer left behind by a previous *app* session that got killed
  // before its debounce timer fired (or before the AppState background flush
  // ran) — without this, those taps would just be gone on relaunch. Guarded
  // by shared.recovered so this only ever runs once per taskId+date per app
  // session: since the AsyncStorage key is shared across every instance for
  // this task, re-running it on a later mount (e.g. opening the dedicated
  // counter page while the task-list card is still alive and holding an
  // unflushed tap) would recover an amount another live instance already
  // owns and is about to flush itself, double-counting it. Only restores the
  // send-to-server bookkeeping (shared.pending) here, not the cache display —
  // see recoveredUnapplied's comment for why that's deferred to flush()'s
  // onSuccess instead of applied here.
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
          shared.recoveredUnapplied += amount;
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
