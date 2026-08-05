import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentDhakaDateString } from '@/lib/background-sync/time';

const STATE_KEY = 'soulshield_background_sync_state';

export type SyncOutcome = 'success' | 'failed' | 'skipped-offline' | 'skipped-signed-out';

export interface BackgroundSyncState {
  lastAttemptAt: number;
  lastOutcome: SyncOutcome;
  lastErrorMessage?: string;
  /** Asia/Dhaka YYYY-MM-DD the last *successful* full sync ran on — this, not
   * a timestamp diff, is what task.ts gates on, since "once per Dhaka day" is
   * the actual requirement rather than "every 24h from an arbitrary instant". */
  lastSuccessDhakaDate?: string;
  lastSuccessAt?: number;
}

export async function getBackgroundSyncState(): Promise<BackgroundSyncState | null> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BackgroundSyncState;
  } catch {
    return null;
  }
}

export async function recordSyncOutcome(
  outcome: SyncOutcome,
  errorMessage?: string
): Promise<void> {
  const previous = await getBackgroundSyncState();
  const now = Date.now();
  const next: BackgroundSyncState = {
    lastAttemptAt: now,
    lastOutcome: outcome,
    lastErrorMessage: outcome === 'failed' ? errorMessage : undefined,
    lastSuccessDhakaDate:
      outcome === 'success' ? currentDhakaDateString() : previous?.lastSuccessDhakaDate,
    lastSuccessAt: outcome === 'success' ? now : previous?.lastSuccessAt,
  };
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
}
