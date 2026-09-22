import { and, eq, inArray, isNull } from 'drizzle-orm';

import type { SyncSubTask } from '@/api/sync-types';
import type { SubTaskInput } from '@/api/types';
import { getLocalDb } from '@/lib/db/client';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { subTasks } from '@/lib/db/schema';
import { newUuid } from '@/lib/db/uuid';

/** Every sub-task with a local edit the server hasn't confirmed yet
 * (syncedAt null), soft-deleted ones included - see
 * lib/background-sync/push-pending.ts. */
export function listUnsyncedSubTasks() {
  const db = getLocalDb();
  if (!db) return [];
  return db.select().from(subTasks).where(isNull(subTasks.syncedAt)).all();
}

export function getSubTaskByUuid(uuid: string) {
  const db = getLocalDb();
  if (!db) return undefined;
  return db.select().from(subTasks).where(eq(subTasks.uuid, uuid)).get();
}

/** See categories-repo.ts's upsertCategoryFromSync - identical shape,
 * including the conflict check. */
export function upsertSubTaskFromSync(row: SyncSubTask): void {
  const db = getLocalDb();
  if (!db) return;

  const existing = db.select().from(subTasks).where(eq(subTasks.uuid, row.uuid)).get();
  checkForConflict('sub_tasks', existing, row.updated_at, row);

  const now = new Date().toISOString();
  db.insert(subTasks)
    .values({
      uuid: row.uuid,
      parentTaskUuid: row.parent_task_uuid,
      title: row.title,
      taskType: row.task_type,
      targetCount: row.target_count ?? null,
      durationSeconds: row.duration_seconds ?? null,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: subTasks.uuid,
      set: {
        parentTaskUuid: row.parent_task_uuid,
        title: row.title,
        taskType: row.task_type,
        targetCount: row.target_count ?? null,
        durationSeconds: row.duration_seconds ?? null,
        position: row.position,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        syncedAt: now,
      },
    })
    .run();
}

/** Active sub-tasks for a set of parent tasks, grouped by parent - the
 * on-device equivalent of the backend's SubTaskRepo.ListByParentIDs (see
 * soul-shield/repo/subtask.go), keyed by uuid instead of bigint id. */
export function listActiveSubTasksByParents(parentUuids: string[]): Map<string, (typeof subTasks.$inferSelect)[]> {
  const result = new Map<string, (typeof subTasks.$inferSelect)[]>();
  const db = getLocalDb();
  if (!db || parentUuids.length === 0) return result;

  const rows = db
    .select()
    .from(subTasks)
    .where(and(isNull(subTasks.deletedAt), inArray(subTasks.parentTaskUuid, parentUuids)))
    .all();
  for (const row of rows) {
    const list = result.get(row.parentTaskUuid);
    if (list) list.push(row);
    else result.set(row.parentTaskUuid, [row]);
  }
  for (const list of result.values()) {
    list.sort((a, b) => a.position - b.position);
  }
  return result;
}

export interface ReplaceSubTasksResult {
  orderedUuids: string[];
  deletedUuids: string[];
}

/** Local-write equivalent of repo/subtask.go's ReplaceForParent: entries
 * with an `id` (an existing sub-task's uuid) update that row, entries
 * without one are created (fresh uuid), and any existing sub-task under
 * this parent not present in `inputs` is soft-deleted. Returns both the new
 * ordered uuid list and whatever got deleted, so the caller
 * (hooks/queries/use-task-mutations.ts) can push an upsert for each kept
 * row and a delete for each removed one. syncedAt: null on every row
 * touched, same as every other local write in this file set. */
export function replaceSubTasksForParentLocal(parentUuid: string, inputs: SubTaskInput[]): ReplaceSubTasksResult {
  const db = getLocalDb();
  if (!db) return { orderedUuids: [], deletedUuids: [] };

  const now = new Date().toISOString();
  const existingUuids = new Set(
    db
      .select({ uuid: subTasks.uuid })
      .from(subTasks)
      .where(and(eq(subTasks.parentTaskUuid, parentUuid), isNull(subTasks.deletedAt)))
      .all()
      .map((r) => r.uuid)
  );

  const keep = new Set<string>();
  const orderedUuids: string[] = [];

  inputs.forEach((input, index) => {
    if (input.id && existingUuids.has(input.id)) {
      db.update(subTasks)
        .set({
          title: input.title,
          taskType: input.task_type,
          targetCount: input.target_count ?? null,
          durationSeconds: input.duration_seconds ?? null,
          position: index,
          updatedAt: now,
          syncedAt: null,
        })
        .where(eq(subTasks.uuid, input.id))
        .run();
      keep.add(input.id);
      orderedUuids.push(input.id);
    } else {
      const uuid = newUuid();
      db.insert(subTasks)
        .values({
          uuid,
          parentTaskUuid: parentUuid,
          title: input.title,
          taskType: input.task_type,
          targetCount: input.target_count ?? null,
          durationSeconds: input.duration_seconds ?? null,
          position: index,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncedAt: null,
        })
        .run();
      keep.add(uuid);
      orderedUuids.push(uuid);
    }
  });

  const deletedUuids: string[] = [];
  for (const uuid of existingUuids) {
    if (!keep.has(uuid)) {
      db.update(subTasks).set({ deletedAt: now, updatedAt: now, syncedAt: null }).where(eq(subTasks.uuid, uuid)).run();
      deletedUuids.push(uuid);
    }
  }

  return { orderedUuids, deletedUuids };
}

/** Every sub-task under `parentUuid` with a pending local edit
 * (syncedAt: null), split into still-active (needs an "upsert" push) and
 * soft-deleted (needs a "delete" push) - queried directly from local state
 * rather than threaded through mutation variables, since TanStack Query's
 * `mutationFn` only ever receives the original `.mutate()` variables, not
 * anything onMutate computed. This also makes a headless replay after an
 * app restart correct for free: it just re-pushes whatever is *still*
 * unsynced at replay time, which is idempotent either way. */
export function listUnsyncedSubTasksForParent(parentUuid: string): {
  upserts: (typeof subTasks.$inferSelect)[];
  deletedUuids: string[];
} {
  const db = getLocalDb();
  if (!db) return { upserts: [], deletedUuids: [] };

  const rows = db
    .select()
    .from(subTasks)
    .where(and(eq(subTasks.parentTaskUuid, parentUuid), isNull(subTasks.syncedAt)))
    .all();

  return {
    upserts: rows.filter((r) => !r.deletedAt),
    deletedUuids: rows.filter((r) => r.deletedAt).map((r) => r.uuid),
  };
}
