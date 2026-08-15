/** Shared mm:ss / hh:mm:ss countdown formatter — used by the Profile Timer's
 * notifications, Timer Task's dedicated page, and Timer Task's notifications. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Compact "25 min" / "1h 30m" label for a fixed duration — used where a
 * task's configured duration_seconds is shown outside a live countdown
 * (e.g. task-details-inline.tsx). */
export function formatDurationLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes} min`;
}
