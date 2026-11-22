import AsyncStorage from '@react-native-async-storage/async-storage';

import { getGlobalSyncChanges } from '@/api/sync';
import { SYNC_REQUEST_TIMEOUT_MS, SYNC_RETRY } from '@/lib/background-sync/retry';
import { getLocalDb } from '@/lib/db/client';
import { getTaskByUuid, upsertTaskFromSync } from '@/lib/db/tasks-repo';
import { upsertSubTaskFromSync } from '@/lib/db/sub-tasks-repo';

/**
 * Fixed (admin-created) tasks for people using the app WITHOUT an account.
 *
 * Delta-pulls the public GET /sync/global (no token) into the same local
 * tables a signed-in pull writes, so every screen shows fixed tasks the same
 * way for guests. Signed-in devices never call this: their GET /sync already
 * includes fixed tasks.
 *
 * Its cursor is kept apart from the account cursor (lib/db/sync-cursor.ts),
 * so signing in still starts with a full account pull. Both keys below are
 * wiped together with the local database (lib/local-owner.ts), so a wiped
 * device re-pulls everything.
 */

const GLOBAL_CURSOR_KEY = 'soulshield_global_sync_cursor';
const GLOBAL_CATEGORIES_KEY = 'soulshield_global_categories';

export const GLOBAL_PULL_STORAGE_KEYS = [GLOBAL_CURSOR_KEY, GLOBAL_CATEGORIES_KEY] as const;

export interface GlobalCategoryRef {
  name: string;
  colorHex: string;
}

export async function pullGlobalTasks(): Promise<void> {
  const db = getLocalDb();
  if (!db) return;

  const cursor = await AsyncStorage.getItem(GLOBAL_CURSOR_KEY);
  const snapshot = await getGlobalSyncChanges(cursor, SYNC_REQUEST_TIMEOUT_MS, SYNC_RETRY);

  // Defensive: only ever store fixed tasks from a public pull.
  const globalTasks = snapshot.tasks.filter((t) => t.is_global);
  const globalUuids = new Set(globalTasks.map((t) => t.uuid));

  const client = (db as unknown as { $client: { withTransactionSync: (fn: () => void) => void } }).$client;
  client.withTransactionSync(() => {
    for (const row of globalTasks) upsertTaskFromSync(row);
    for (const row of snapshot.sub_tasks) {
      const parentIsGlobal = globalUuids.has(row.parent_task_uuid) || !!getTaskByUuid(row.parent_task_uuid)?.isGlobal;
      if (parentIsGlobal) upsertSubTaskFromSync(row);
    }
  });

  const refs: Record<string, GlobalCategoryRef> = {};
  for (const category of snapshot.global_categories) {
    refs[category.uuid] = { name: category.name, colorHex: category.color_hex };
  }
  await AsyncStorage.setItem(GLOBAL_CATEGORIES_KEY, JSON.stringify(refs));
  // Cursor last: a failure above just re-pulls the same window next time
  // (every write is an idempotent upsert).
  await AsyncStorage.setItem(GLOBAL_CURSOR_KEY, snapshot.cursor);
}

/** Every fixed-task category (uuid -> name/colour) as of the last public
 * pull. The admin's categories aren't in a user's own data, so this is where
 * the Fixed Tasks page gets the names it groups by. */
export async function getGlobalCategoryRefs(): Promise<Record<string, GlobalCategoryRef>> {
  try {
    const raw = await AsyncStorage.getItem(GLOBAL_CATEGORIES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GlobalCategoryRef>) : {};
  } catch {
    return {};
  }
}

/** Name and colour of a fixed task's category (as of the last public pull),
 * used when a guest copies a fixed task into their own tasks. */
export async function getGlobalCategoryRef(uuid: string | null | undefined): Promise<GlobalCategoryRef | null> {
  if (!uuid) return null;
  return (await getGlobalCategoryRefs())[uuid] ?? null;
}
