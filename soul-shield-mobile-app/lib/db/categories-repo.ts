import { eq, isNull } from 'drizzle-orm';

import type { SyncCategory } from '@/api/sync-types';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { getLocalDb } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';

/** Writes one pulled category row into the local store (insert or update by
 * uuid) - called from lib/background-sync/pull.ts for every row a sync pull
 * returns, soft-deleted ones included (their deletedAt just gets set, same
 * as any other field). syncedAt is stamped "now" since this row, by
 * definition, just came from a successful server round-trip.
 *
 * Checks for a genuine concurrent edit first (see conflicts-repo.ts) -
 * the server's version still wins either way, this only decides whether it
 * gets logged before being applied. */
export function upsertCategoryFromSync(row: SyncCategory): void {
  const db = getLocalDb();
  if (!db) return;

  const existing = db.select().from(categories).where(eq(categories.uuid, row.uuid)).get();
  checkForConflict('categories', existing, row.updated_at, row);

  const now = new Date().toISOString();
  db.insert(categories)
    .values({
      uuid: row.uuid,
      name: row.name,
      colorHex: row.color_hex,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: categories.uuid,
      set: {
        name: row.name,
        colorHex: row.color_hex,
        position: row.position,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        syncedAt: now,
      },
    })
    .run();
}

/** Every non-deleted category, for the caller to build a uuid -> category
 * lookup (deriveTasksForDate/Range in lib/db/tasks-repo.ts join against
 * this in JS, not SQL, matching how the app already treats categories as a
 * small, fully-loaded list rather than something queried per task). */
export function listActiveCategories() {
  const db = getLocalDb();
  if (!db) return [];
  return db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(categories.position).all();
}
