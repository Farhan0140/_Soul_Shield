const DHAKA_TIME_ZONE = 'Asia/Dhaka';

/** Sync is considered "due" any time in this window, provided it hasn't
 * already succeeded today — not just at the 01:00 instant. WorkManager only
 * guarantees a minimum interval between wake-ups (see task.ts), so the actual
 * wake-up time drifts around the target; a multi-hour window is what turns
 * that drift into free retries instead of a missed day. */
const SYNC_WINDOW_START_HOUR = 1;
const SYNC_WINDOW_END_HOUR = 6;

const dhakaPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DHAKA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

interface DhakaParts {
  /** YYYY-MM-DD */
  date: string;
  /** 0-23. `hour12: false` reports midnight as "24" on some ICU versions rather
   * than "00" — normalize so callers can compare with plain hour arithmetic. */
  hour: number;
}

function getDhakaParts(date: Date): DhakaParts {
  const parts = dhakaPartsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour')) % 24;
  return { date: `${year}-${month}-${day}`, hour };
}

/** Current date in Asia/Dhaka, as YYYY-MM-DD — independent of the device's
 * own timezone, since the spec ties the schedule to Bangladesh time
 * specifically regardless of where the phone currently thinks it is. */
export function currentDhakaDateString(date: Date = new Date()): string {
  return getDhakaParts(date).date;
}

/** Whether `date` falls inside the daily sync window (01:00-06:00 Asia/Dhaka). */
export function isWithinDhakaSyncWindow(date: Date = new Date()): boolean {
  const { hour } = getDhakaParts(date);
  return hour >= SYNC_WINDOW_START_HOUR && hour < SYNC_WINDOW_END_HOUR;
}
