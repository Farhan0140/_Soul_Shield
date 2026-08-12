import AsyncStorage from '@react-native-async-storage/async-storage';

const STATE_KEY = 'soulshield_timer_state';

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerSelection {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Everything needed to recompute the countdown from a fresh app launch —
 * remaining time is always derived from `startedAt`/`accumulatedMs`, never
 * trusted from an in-memory interval count (see hooks/use-timer.ts). */
export interface TimerState {
  status: TimerStatus;
  /** Last hours/minutes/seconds chosen on the wheel picker — restored as the
   * default next time the timer is idle. */
  selection: TimerSelection;
  /** Total duration of the current/last run, derived from `selection` at
   * start time (so changing the picker while paused doesn't retroactively
   * change a run already in progress). */
  durationMs: number;
  /** Epoch ms when the current running segment began; null unless running. */
  startedAt: number | null;
  /** Elapsed ms banked from previous running segments (before the most
   * recent pause/resume) — added to `Date.now() - startedAt` while running. */
  accumulatedMs: number;
  vibrationEnabled: boolean;
}

export const DEFAULT_TIMER_STATE: TimerState = {
  status: 'idle',
  selection: { hours: 0, minutes: 5, seconds: 0 },
  durationMs: 5 * 60 * 1000,
  startedAt: null,
  accumulatedMs: 0,
  vibrationEnabled: true,
};

export async function getTimerState(): Promise<TimerState> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return DEFAULT_TIMER_STATE;
  try {
    return { ...DEFAULT_TIMER_STATE, ...(JSON.parse(raw) as Partial<TimerState>) };
  } catch {
    return DEFAULT_TIMER_STATE;
  }
}

export async function setTimerState(state: TimerState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}
