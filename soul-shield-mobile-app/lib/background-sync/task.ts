import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { getBackgroundSyncState } from '@/lib/background-sync/state';
import { runFullBackgroundSync } from '@/lib/background-sync/sync';
import { currentDhakaDateString, isWithinDhakaSyncWindow } from '@/lib/background-sync/time';

export const BACKGROUND_SYNC_TASK = 'soulshield-daily-data-sync';

// Must run at module scope, before any component mounts — this is what lets
// Android's headless JS launch (the app isn't running when WorkManager wakes
// it up) find and execute the task at all. Imported for its side effect at
// the top of app/_layout.tsx, same pattern as lib/network.ts and
// lib/notifications.ts.
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    // WorkManager only guarantees a *minimum interval* between wake-ups, not
    // a wall-clock time (see registerBackgroundSync below) — most wake-ups
    // land outside the 1-6AM Dhaka window and should cost nothing beyond this
    // clock check: no network touched, no wake lock held longer than a
    // microtask.
    if (!isWithinDhakaSyncWindow()) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const state = await getBackgroundSyncState();
    if (state?.lastSuccessDhakaDate === currentDhakaDateString()) {
      // Already synced today's window — nothing to do until tomorrow.
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    await runFullBackgroundSync();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    // runFullBackgroundSync already recorded the specific failure reason
    // (lib/background-sync/state.ts) — returning Failed here just tells
    // WorkManager to apply its own exponential-backoff retry policy on top of
    // our own within-window re-checks, rather than treating this run as done.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the daily sync with the OS scheduler — idempotent, call once at
 * app startup (see app/_layout.tsx). Android backs this with WorkManager
 * (persists across reboots and app updates automatically, no boot-receiver
 * code needed); iOS backs it with BGTaskScheduler, which is opportunistic by
 * design and may not fire daily if the app is rarely opened — an OS-level
 * limitation no app can code around. */
export async function registerBackgroundSync(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    // 15 minutes is Android's WorkManager-enforced floor for periodic work —
    // requesting anything shorter is silently clamped to this anyway. This
    // isn't "polling every 15 minutes": the OS still batches actual
    // executions around its own Doze/App Standby maintenance windows, and
    // every wake-up outside the 1-6AM Dhaka window is a same-tick no-op (see
    // the task body above) — so there's no meaningful extra battery cost from
    // requesting the shortest available interval. It just gives the 1AM
    // window the best chance of being caught promptly instead of waiting out
    // a longer one.
    minimumInterval: 15,
  });
}
