import { eq, isNull, sql } from 'drizzle-orm';

import type { SyncCategory } from '@/api/sync-types';
import type { Category } from '@/api/types';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { getLocalDb } from '@/lib/db/client';
import { categories, tasks } from '@/lib/db/schema';

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

/** listActiveCategories reshaped into the Category[] wire shape (see
 * api/types.ts) for hooks/queries/use-categories.ts's useCategoriesQuery -
 * same reasoning as tasks-repo.ts's deriveManageableTasks. */
export function deriveCategories(): Category[] {
  return listActiveCategories().map((c) => ({
    id: c.uuid,
    name: c.name,
    color_hex: c.colorHex,
    position: c.position,
  }));
}

export function getCategoryByUuid(uuid: string) {
  const db = getLocalDb();
  if (!db) return undefined;
  return db.select().from(categories).where(eq(categories.uuid, uuid)).get();
}

// ---- Local writes: every function below is for a change *made on this
// device* (not a pulled row - see upsertCategoryFromSync above) - each sets
// syncedAt: null to mark the row as pending push, and updatedAt to this
// device's own clock (the server stamps its own updated_at once the push
// is confirmed - see lib/background-sync/pull.ts, which re-upserts with
// the authoritative row and sets syncedAt back to non-null). The caller
// (hooks/queries/use-category-mutations.ts) is responsible for actually
// pushing the change; these functions only touch the local table. ----

/** `uuid` is caller-generated - see tasks-repo.ts's createTaskLocal for why. */
export function createCategoryLocal(uuid: string, input: { name: string; colorHex: string }) {
  const db = getLocalDb();
  if (!db) return null;

  const now = new Date().toISOString();
  const maxPosition =
    db
      .select({ max: sql<number | null>`max(${categories.position})` })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .get()?.max ?? -1;

  const row = {
    uuid,
    name: input.name,
    colorHex: input.colorHex,
    position: maxPosition + 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncedAt: null,
  };
  db.insert(categories).values(row).run();
  return row;
}

export function updateCategoryLocal(uuid: string, input: { name?: string; colorHex?: string }) {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.update(categories)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.colorHex !== undefined ? { colorHex: input.colorHex } : {}),
      updatedAt: now,
      syncedAt: null,
    })
    .where(eq(categories.uuid, uuid))
    .run();
}

/** Soft-deletes locally and, matching the backend's own cascade (see
 * repo/category.go's Delete), clears category_uuid on any local task that
 * pointed at it - Postgres's ON DELETE SET NULL doesn't apply here (this
 * isn't even talking to Postgres), so it's done explicitly, same reasoning
 * as the backend's own explicit cascade after switching to soft delete. */
export function softDeleteCategoryLocal(uuid: string): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.update(categories).set({ deletedAt: now, updatedAt: now, syncedAt: null }).where(eq(categories.uuid, uuid)).run();
  db.update(tasks).set({ categoryUuid: null, updatedAt: now, syncedAt: null }).where(eq(tasks.categoryUuid, uuid)).run();
}

/** Sets position = index for each uuid in the new order - syncedAt: null
 * on every row touched, each pushed as its own "upsert" change (see
 * hooks/queries/use-category-mutations.ts) rather than replicating the
 * backend's atomic exact-set-match Reorder validation, which doesn't fit
 * the sync protocol's per-row model. Position doesn't need to be perfectly
 * contiguous for ORDER BY to work, so this is a safe simplification. */
export function reorderCategoriesLocal(orderedUuids: string[]): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  orderedUuids.forEach((uuid, index) => {
    db.update(categories).set({ position: index, updatedAt: now, syncedAt: null }).where(eq(categories.uuid, uuid)).run();
  });
}
