import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import { clearRejectedChanges } from '@/lib/background-sync/rejected';
import { clearActiveCounterTask } from '@/lib/bluetooth/counter-ble';
import { clearLocalDatabase, localDatabaseHasData } from '@/lib/db/client';
import { decideLocalDataAction, type LocalDataAction } from '@/lib/local-owner-decision';
import { clearOfflineCache } from '@/lib/persister';

/** Which account the on-device data belongs to (see lib/local-owner-decision.ts
 * for why this matters). Kept in AsyncStorage, not SQLite, so it stays
 * readable even on builds where the local database is unavailable. */
const LOCAL_OWNER_KEY = 'soulshield_local_owner_user_id';

/** AsyncStorage entries that hold one account's data or state (as opposed to
 * device preferences like theme, language, haptics, digest time, onboarding),
 * wiped whenever local data is wiped. */
const USER_SCOPED_KEYS = new Set([
  'soulshield_background_sync_state', // last sync outcome / daily-window bookkeeping
  'soulshield_ble_active_task', // the previous user's counter task uuid
  'soulshield_shown_streak_milestones',
  'soulshield_dismissed_sync_notifications',
  // Cross-device push registration belongs to the previous account; the new
  // user re-enables it from Profile (which re-registers the token to them).
  'soulshield_push_pref',
  'soulshield_push_token',
  'soulshield_push_platform',
]);
const USER_SCOPED_PREFIXES = [
  'soulshield_pending_increment_', // unflushed counter taps (hooks/use-task-increment-buffer.ts)
  'soulshield_timer_task_', // running Timer Task state + its notification ids
];

export async function getLocalOwnerId(): Promise<string | null> {
  return AsyncStorage.getItem(LOCAL_OWNER_KEY);
}

async function setLocalOwnerId(userId: number | string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_OWNER_KEY, String(userId));
}

/** Records the current owner only if none is recorded yet — for users who
 * were already signed in when ownership tracking shipped (their local data
 * is, by definition, theirs). */
export async function ensureLocalOwnerRecorded(userId: number | string): Promise<void> {
  if ((await getLocalOwnerId()) === null) await setLocalOwnerId(userId);
}

/** Removes every piece of on-device data that belongs to an account: the
 * SQLite store (incl. sync cursor + conflict log), the TanStack cache and its
 * persisted copy (incl. paused/queued mutations), scheduled task reminders,
 * the rejected-changes list, the BLE active task, and user-scoped
 * AsyncStorage entries. Device preferences are kept. */
export async function wipeAccountLocalData(queryClient: QueryClient): Promise<void> {
  clearLocalDatabase();
  clearRejectedChanges();
  await clearOfflineCache(queryClient);
  await clearActiveCounterTask().catch(() => {});

  const keys = await AsyncStorage.getAllKeys();
  const userScoped = keys.filter(
    (key) => USER_SCOPED_KEYS.has(key) || USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
  if (userScoped.length > 0) await AsyncStorage.multiRemove(userScoped);
  await AsyncStorage.removeItem(LOCAL_OWNER_KEY);
}

/** Call on every sign-in, BEFORE the new token is stored (so no sync can run
 * with the new token against the old data). Wipes local data unless it
 * belongs to `userId`, then records `userId` as the owner. */
export async function prepareLocalDataForUser(
  userId: number | string,
  queryClient: QueryClient
): Promise<LocalDataAction> {
  const action = decideLocalDataAction(await getLocalOwnerId(), String(userId), localDatabaseHasData());
  if (action === 'wipe') await wipeAccountLocalData(queryClient);
  await setLocalOwnerId(userId);
  return action;
}
