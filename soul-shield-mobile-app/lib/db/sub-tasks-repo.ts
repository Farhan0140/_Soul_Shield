import { and, eq, inArray, isNull } from 'drizzle-orm';

import type { SyncSubTask } from '@/api/sync-types';
import { getLocalDb } from '@/lib/db/client';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { subTasks } from '@/lib/db/schema';

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
