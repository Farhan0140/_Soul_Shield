import type { TimerSelection } from '@/lib/timer/store';

/** h/m/s <-> seconds conversion for Timer Tasks (seconds, matching the
 * backend's duration_seconds field). */
export function selectionToSeconds(selection: TimerSelection): number {
  return selection.hours * 3600 + selection.minutes * 60 + selection.seconds;
}

export function secondsToSelection(totalSeconds: number): TimerSelection {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}
