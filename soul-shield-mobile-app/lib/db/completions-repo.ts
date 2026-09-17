import { and, gte, isNull, lte } from 'drizzle-orm';

import type { SyncSubTaskCompletion, SyncTaskCompletion } from '@/api/sync-types';
import { getLocalDb } from '@/lib/db/client';
import { subTaskCompletions, taskCompletions } from '@/lib/db/schema';

/** See categories-repo.ts's upsertCategoryFromSync - identical shape.
 * task_uuid is nullable (mirrors the backend's historical nullable
 * task_id - see lib/db/schema.ts's comment on taskCompletions). */
export function upsertTaskCompletionFromSync(row: SyncTaskCompletion): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.insert(taskCompletions)
    .values({
      uuid: row.uuid,
      taskUuid: row.task_uuid ?? null,
      taskDate: row.task_date,
      status: row.status,
      progressCount: row.progress_count,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: taskCompletions.uuid,
      set: {
        status: row.status,
        progressCount: row.progress_count,
        completedAt: row.completed_at ?? null,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        syncedAt: now,
      },
    })
    .run();
}

export function upsertSubTaskCompletionFromSync(row: SyncSubTaskCompletion): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.insert(subTaskCompletions)
    .values({
      uuid: row.uuid,
      subTaskUuid: row.sub_task_uuid ?? null,
      parentTaskUuid: row.parent_task_uuid,
      taskDate: row.task_date,
      status: row.status,
      progressCount: row.progress_count,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: subTaskCompletions.uuid,
      set: {
        status: row.status,
        progressCount: row.progress_count,
        completedAt: row.completed_at ?? null,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        syncedAt: now,
      },
    })
    .run();
}

/** Every (non-deleted) task_completions row whose task_date falls in
 * [fromDate, toDate] - deriveTasksForRange (lib/db/tasks-repo.ts) builds a
 * (taskUuid, date) -> completion lookup from this instead of querying per
 * task/day, mirroring the backend's own single-query-then-map approach in
 * ListForRange. */
export function listTaskCompletionsInRange(fromDate: string, toDate: string) {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(taskCompletions)
    .where(
      and(isNull(taskCompletions.deletedAt), gte(taskCompletions.taskDate, fromDate), lte(taskCompletions.taskDate, toDate))
    )
    .all();
}

export function listSubTaskCompletionsInRange(fromDate: string, toDate: string) {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(subTaskCompletions)
    .where(
      and(
        isNull(subTaskCompletions.deletedAt),
        gte(subTaskCompletions.taskDate, fromDate),
        lte(subTaskCompletions.taskDate, toDate)
      )
    )
    .all();
}
