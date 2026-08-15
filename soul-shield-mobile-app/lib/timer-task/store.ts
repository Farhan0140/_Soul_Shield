import AsyncStorage from '@react-native-async-storage/async-storage';

export type TaskTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

const ACTIVE_KEYS_STORAGE_KEY = 'soulshield_timer_task_active_keys';

/** Everything needed to recompute a Timer Task's countdown from a fresh app
 * launch, and to know whether its completion has already been dispatched —
 * mirrors lib/timer/store.ts's timestamp-based approach (accumulatedMs/
 * startedAt, never a trusted in-memory tick count), but keyed per
 * taskId+date+subTaskId (not a single global instance) since a recurring
 * Timer Task's countdown must reset on a new date, exactly like a Counter
 * task's progress_count resets per date server-side. */
export interface TaskTimerState {
  status: TaskTimerStatus;
  /** Fixed at the first `start()` of this run from the task's configured
   * duration_seconds — never re-read from the task afterward, so this run
   * isn't retroactively changed if the task is edited mid-countdown. */
  durationMs: number;
  /** Epoch ms when the current running segment began; null unless running. */
  startedAt: number | null;
  /** Elapsed ms banked from previous running segments (before the most
   * recent pause/resume) — added to `Date.now() - startedAt` while running. */
  accumulatedMs: number;
  taskId: number;
  subTaskId: number | null;
  /** YYYY-MM-DD this run belongs to. */
  date: string;
  taskTitle: string;
  /** Set (and persisted) the instant completion is dispatched — i.e. the
   * completion mutation has been (or is about to be) called — BEFORE that
   * call resolves. This is the single guard that stops the completion
   * mutation from firing twice: once in-memory (see the shared Map in
   * hooks/use-task-timer.ts, for two simultaneously mounted instances) and
   * once persisted across an app restart or a background-sync wake-up
   * finding this same state again before the mutation's own confirmation
   * has cleared it. */
  completionDispatched: boolean;
}

export function taskTimerKey(taskId: number, date: string, subTaskId: number | null): string {
  return `soulshield_timer_task_${taskId}_${subTaskId ?? 'main'}_${date}`;
}

async function getActiveKeys(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ACTIVE_KEYS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function setActiveKeys(keys: string[]): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

async function registerActiveKey(key: string): Promise<void> {
  const keys = await getActiveKeys();
  if (!keys.includes(key)) await setActiveKeys([...keys, key]);
}

async function unregisterActiveKey(key: string): Promise<void> {
  const keys = await getActiveKeys();
  if (keys.includes(key)) await setActiveKeys(keys.filter((k) => k !== key));
}

/** Lists every currently-registered Timer Task run key — used by the
 * background-sync extension (lib/background-sync/timer-task.ts) to find
 * locally-running timers without any live React hook mounted. */
export async function getActiveTaskTimerKeys(): Promise<string[]> {
  return getActiveKeys();
}

export async function getTaskTimerState(key: string): Promise<TaskTimerState | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TaskTimerState;
  } catch {
    return null;
  }
}

/** Persists the run and keeps the active-keys registry in sync: registered
 * while running or paused (still needs to survive/resume/be found by
 * background-sync), unregistered once idle/completed-and-cleared. */
export async function setTaskTimerState(key: string, state: TaskTimerState): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(state));
  if (state.status === 'running' || state.status === 'paused') {
    await registerActiveKey(key);
  } else {
    await unregisterActiveKey(key);
  }
}

export async function clearTaskTimerState(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  await unregisterActiveKey(key);
}
