import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { runMigrations } from '@/lib/db/migrations';
import * as schema from '@/lib/db/schema';

const DB_NAME = 'soulshield_local.db';

let cached: ExpoSQLiteDatabase<typeof schema> | null | undefined;

/** Lazily opens (and migrates) the on-device local-first SQLite database.
 * Deliberately swallows failure and returns null instead of throwing: right
 * after this native module (expo-sqlite) is added, a device's already-
 * installed dev/production client binary won't have it until rebuilt (see
 * the local-first plan's Phase 3 rollout note) - `SQLite.openDatabaseSync`
 * would throw in that window. Every caller (lib/background-sync/pull.ts)
 * treats null the same as "sync unavailable this run" rather than crashing
 * the app - Phase 3 is meant to be entirely invisible if it isn't ready
 * yet, not a new way for the app to break. */
/** Empties every local-first table (and the sync cursor, so the next login
 * does a full pull). The store isn't scoped per user - rows carry no owner -
 * so without this, signing out and into a different account left the
 * previous account's tasks on screen (and pushable under the new account). */
export function clearLocalDatabase(): void {
  const db = getLocalDb();
  if (!db) return;
  db.delete(schema.subTaskCompletions).run();
  db.delete(schema.taskCompletions).run();
  db.delete(schema.subTasks).run();
  db.delete(schema.tasks).run();
  db.delete(schema.categories).run();
  db.delete(schema.syncConflicts).run();
  db.delete(schema.syncState).run();
}

export function getLocalDb(): ExpoSQLiteDatabase<typeof schema> | null {
  if (cached !== undefined) return cached;

  try {
    const expo = SQLite.openDatabaseSync(DB_NAME);
    runMigrations(expo);
    cached = drizzle(expo, { schema });
  } catch (error) {
    console.warn('[lib/db] local SQLite database unavailable:', error);
    cached = null;
  }

  return cached;
}
