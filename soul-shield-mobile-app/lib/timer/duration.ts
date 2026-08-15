import type { TimerSelection } from '@/lib/timer/store';

/** Shared h/m/s <-> seconds conversion, used by both the Profile Timer
 * (in ms, via selectionToMs below) and Timer Tasks (in seconds, matching the
 * backend's duration_seconds field) — one source of truth for the arithmetic. */
export function selectionToSeconds(selection: TimerSelection): number {
  return selection.hours * 3600 + selection.minutes * 60 + selection.seconds;
}

export function selectionToMs(selection: TimerSelection): number {
  return selectionToSeconds(selection) * 1000;
}

export function secondsToSelection(totalSeconds: number): TimerSelection {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}
