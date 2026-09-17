import type { SyncChange } from '@/api/sync-types';
import { decodeIntArray } from '@/lib/db/json-array';
import type { categories, subTaskCompletions, subTasks, taskCompletions, tasks } from '@/lib/db/schema';

/** Converts a local row into the SyncChange shape POST /sync expects (see
 * soul-shield/repo/sync_push.go's syncTaskInput/syncCategoryInput/
 * syncSubTaskInput/syncCompletionInput for the exact field names each op
 * reads) - one function per resource, used by every mutation's mutationFn
 * in hooks/queries/use-task-mutations.ts / use-category-mutations.ts. */

type TaskRow = typeof tasks.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type SubTaskRow = typeof subTasks.$inferSelect;
type TaskCompletionRow = typeof taskCompletions.$inferSelect;
type SubTaskCompletionRow = typeof subTaskCompletions.$inferSelect;

export function taskUpsertChange(row: TaskRow): SyncChange {
  return {
    resource: 'tasks',
    op: 'upsert',
    uuid: row.uuid,
    client_updated_at: row.updatedAt,
    data: {
      title: row.title,
      description: row.description,
      recurrence_type: row.recurrenceType,
      recurrence_days: decodeIntArray(row.recurrenceDays),
      is_active: row.isActive,
      category_uuid: row.categoryUuid,
      reward_text: row.rewardText,
      task_type: row.taskType,
      target_count: row.targetCount,
      duration_seconds: row.durationSeconds,
      reminder_time: row.reminderTime,
      source_task_uuid: row.sourceTaskUuid,
      position: row.position,
    },
  };
}

export function taskDeleteChange(uuid: string, updatedAt: string): SyncChange {
  return { resource: 'tasks', op: 'delete', uuid, client_updated_at: updatedAt, data: {} };
}

export function categoryUpsertChange(row: CategoryRow): SyncChange {
  return {
    resource: 'categories',
    op: 'upsert',
    uuid: row.uuid,
    client_updated_at: row.updatedAt,
    data: { name: row.name, color_hex: row.colorHex, position: row.position },
  };
}

export function categoryDeleteChange(uuid: string, updatedAt: string): SyncChange {
  return { resource: 'categories', op: 'delete', uuid, client_updated_at: updatedAt, data: {} };
}

export function subTaskUpsertChange(row: SubTaskRow): SyncChange {
  return {
    resource: 'sub_tasks',
    op: 'upsert',
    uuid: row.uuid,
    client_updated_at: row.updatedAt,
    data: {
      parent_task_uuid: row.parentTaskUuid,
      title: row.title,
      task_type: row.taskType,
      target_count: row.targetCount,
      duration_seconds: row.durationSeconds,
      position: row.position,
    },
  };
}

export function subTaskDeleteChange(uuid: string, updatedAt: string): SyncChange {
  return { resource: 'sub_tasks', op: 'delete', uuid, client_updated_at: updatedAt, data: {} };
}

export function taskCompletionUpsertChange(row: TaskCompletionRow): SyncChange {
  return {
    resource: 'task_completions',
    op: 'upsert',
    uuid: row.uuid,
    client_updated_at: row.updatedAt,
    data: { task_uuid: row.taskUuid, task_date: row.taskDate, status: row.status },
  };
}

export function taskCompletionIncrementChange(uuid: string, taskUuid: string, taskDate: string, amount: number): SyncChange {
  return {
    resource: 'task_completions',
    op: 'increment',
    uuid,
    client_updated_at: new Date().toISOString(),
    data: { task_uuid: taskUuid, task_date: taskDate, amount },
  };
}

export function subTaskCompletionUpsertChange(row: SubTaskCompletionRow): SyncChange {
  return {
    resource: 'sub_task_completions',
    op: 'upsert',
    uuid: row.uuid,
    client_updated_at: row.updatedAt,
    data: {
      sub_task_uuid: row.subTaskUuid,
      parent_task_uuid: row.parentTaskUuid,
      task_date: row.taskDate,
      status: row.status,
    },
  };
}

export function subTaskCompletionIncrementChange(
  uuid: string,
  subTaskUuid: string,
  parentTaskUuid: string,
  taskDate: string,
  amount: number
): SyncChange {
  return {
    resource: 'sub_task_completions',
    op: 'increment',
    uuid,
    client_updated_at: new Date().toISOString(),
    data: { sub_task_uuid: subTaskUuid, parent_task_uuid: parentTaskUuid, task_date: taskDate, amount },
  };
}
