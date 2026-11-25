import { useEffect, useRef, useState } from 'react';

import { useTaskHistoryQuery } from '@/hooks/queries/use-tasks';
import { addDays, todayISODate } from '@/lib/date';
import { syncAllTaskReminders } from '@/lib/notifications';

/** Self-healing reminder sync: fetches a rolling 7-day window (reusing the
 * existing history endpoint — a 7-day range is guaranteed to surface every
 * active recurring task at least once, since recurrence_days is a subset of
 * the week) and re-schedules reminders from it. Mount once, e.g. on the home
 * screen, to fix up scheduling after a fresh install, after an offline-queued
 * edit finally syncs, or after any change made outside this device. */
export function useTaskRemindersSync() {
  const from = todayISODate();
  const to = addDays(from, 6);
  // Reminders are synced once per mount, so the window is only read until
  // then. Left enabled, this query stayed live on Home and re-derived a
  // whole week from SQLite after every tap that refreshed task lists, for a
  // result nothing used any more.
  const [synced, setSynced] = useState(false);
  const query = useTaskHistoryQuery(from, to, !synced);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current || !query.data) return;
    syncedRef.current = true;
    syncAllTaskReminders(query.data);
    setSynced(true);
  }, [query.data]);
}
