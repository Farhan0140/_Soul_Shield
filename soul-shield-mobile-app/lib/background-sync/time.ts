/** Sync is considered "due" any time in this window, provided it hasn't
 * already succeeded today — not just at the 01:00 instant. WorkManager only
 * guarantees a minimum interval between wake-ups (see task.ts), so the actual
 * wake-up time drifts around the target; a multi-hour window is what turns
 * that drift into free retries instead of a missed day.
 *
 * Hours are in the DEVICE's timezone (C8): the window used to be pinned to
 * Asia/Dhaka, which put the "overnight" sync in the middle of the day for
 * anyone outside Bangladesh. Local time is what "while you sleep" means. */
const SYNC_WINDOW_START_HOUR = 1;
const SYNC_WINDOW_END_HOUR = 6;

const pad = (n: number) => String(n).padStart(2, '0');

/** Current date in the device's timezone, as YYYY-MM-DD. */
export function currentLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whether `date` falls inside the daily sync window (01:00-06:00 device time). */
export function isWithinSyncWindow(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= SYNC_WINDOW_START_HOUR && hour < SYNC_WINDOW_END_HOUR;
}
