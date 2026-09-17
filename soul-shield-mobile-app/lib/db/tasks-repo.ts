import { eq, isNull } from 'drizzle-orm';

import type { SyncTask } from '@/api/sync-types';
import type { TaskStatus } from '@/api/types';
import { listActiveCategories } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { listSubTaskCompletionsInRange, listTaskCompletionsInRange } from '@/lib/db/completions-repo';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { decodeIntArray, encodeIntArray } from '@/lib/db/json-array';
import { tasks } from '@/lib/db/schema';
import { listActiveSubTasksByParents } from '@/lib/db/sub-tasks-repo';
import { dateRange, todayISODate, weekdayIndex } from '@/lib/date';

/** Writes one pulled task row into the local store - see
 * categories-repo.ts's upsertCategoryFromSync for the shape/reasoning
 * (including the conflict check) and recurrence_days round-trips through
 * JSON (see lib/db/json-array.ts). */
export function upsertTaskFromSync(row: SyncTask): void {
  const db = getLocalDb();
  if (!db) return;

  const existing = db.select().from(tasks).where(eq(tasks.uuid, row.uuid)).get();
  checkForConflict('tasks', existing, row.updated_at, row);

  const now = new Date().toISOString();
  db.insert(tasks)
    .values({
      uuid: row.uuid,
      title: row.title,
      description: row.description ?? null,
      isGlobal: row.is_global,
      recurrenceType: row.recurrence_type,
      recurrenceDays: encodeIntArray(row.recurrence_days),
      isActive: row.is_active,
      categoryUuid: row.category_uuid ?? null,
      rewardText: row.reward_text ?? null,
      taskType: row.task_type,
      targetCount: row.target_count ?? null,
      durationSeconds: row.duration_seconds ?? null,
      reminderTime: row.reminder_time ?? null,
      sourceTaskUuid: row.source_task_uuid ?? null,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? null,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: tasks.uuid,
      set: {
        title: row.title,
        description: row.description ?? null,
        isGlobal: row.is_global,
        recurrenceType: row.recurrence_type,
        recurrenceDays: encodeIntArray(row.recurrence_days),
        isActive: row.is_active,
        categoryUuid: row.category_uuid ?? null,
        rewardText: row.reward_text ?? null,
        taskType: row.task_type,
        targetCount: row.target_count ?? null,
        durationSeconds: row.duration_seconds ?? null,
        reminderTime: row.reminder_time ?? null,
        sourceTaskUuid: row.source_task_uuid ?? null,
        position: row.position,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        syncedAt: now,
      },
    })
    .run();
}

export interface DerivedSubTask {
  subTaskUuid: string;
  title: string;
  taskType: string;
  targetCount: number | null;
  durationSeconds: number | null;
  progressCount: number;
  status: TaskStatus;
}

export interface DerivedTask {
  taskUuid: string;
  title: string;
  description: string | null;
  isGlobal: boolean;
  recurrenceType: string;
  date: string;
  status: TaskStatus;
  categoryUuid: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  rewardText: string | null;
  taskType: string;
  targetCount: number | null;
  durationSeconds: number | null;
  progressCount: number;
  reminderTime: string | null;
  position: number;
  subTasks?: DerivedSubTask[];
}

/** completed == every sub-task done, partially_completed == some done,
 * else the same missed-vs-pending-by-date default as everything else -
 * ported straight from soul-shield/rest/handlers/task/subtask_merge.go's
 * computeParentStatus. A sub-tasked parent's own status is *always*
 * derived this way, never read from its own completion row (which
 * shouldn't exist for one - the app never lets a sub-tasked parent be
 * completed directly). */
function computeParentStatus(subs: DerivedSubTask[], date: string, today: string): TaskStatus {
  const completed = subs.filter((s) => s.status === 'completed').length;
  if (completed === subs.length) return 'completed';
  if (completed > 0) return 'partially_completed';
  return date < today ? 'missed' : 'pending';
}

function defaultStatus(date: string, today: string): TaskStatus {
  return date < today ? 'missed' : 'pending';
}

/** The on-device port of soul-shield/repo/task.go's ListForRange (+
 * subtask_merge.go's attachSubTasksForRange folded in) - same recurrence-day
 * matching, same missed-vs-pending default, same reward-text gating on
 * completed status, same sub-tasked-parent status override. Works for any
 * date range that's been synced locally (see lib/background-sync/pull.ts),
 * online or offline, instead of only whatever the old fixed prefetch window
 * happened to cover - see the local-first plan's Phase 3/5 context.
 *
 * Deliberately does everything in JS over a handful of flat queries rather
 * than a SQL join per day (no generate_series/array `= ANY` in SQLite) -
 * fine at this app's per-user data scale, same reasoning the plan gave for
 * this whole approach. */
export function deriveTasksForRange(fromDate: string, toDate: string): DerivedTask[] {
  const db = getLocalDb();
  if (!db) return [];

  const activeTasks = db.select().from(tasks).where(isNull(tasks.deletedAt)).all().filter((t) => t.isActive);
  if (activeTasks.length === 0) return [];

  const categoryById = new Map(listActiveCategories().map((c) => [c.uuid, c]));
  const taskUuids = activeTasks.map((t) => t.uuid);
  const subTasksByParent = listActiveSubTasksByParents(taskUuids);

  // (taskUuid, date) -> completion, built once for the whole range instead
  // of queried per task/day.
  const taskCompletionByKey = new Map(
    listTaskCompletionsInRange(fromDate, toDate).map((c) => [`${c.taskUuid}|${c.taskDate}`, c])
  );
  const subTaskCompletionByKey = new Map(
    listSubTaskCompletionsInRange(fromDate, toDate).map((c) => [`${c.subTaskUuid}|${c.taskDate}`, c])
  );

  const today = todayISODate();
  const results: DerivedTask[] = [];

  for (const date of dateRange(fromDate, toDate)) {
    const weekday = weekdayIndex(date);

    for (const task of activeTasks) {
      const recurrenceDays = decodeIntArray(task.recurrenceDays);
      if (!recurrenceDays.includes(weekday)) continue;

      const completion = taskCompletionByKey.get(`${task.uuid}|${date}`);
      const status: TaskStatus = (completion?.status as TaskStatus | undefined) ?? defaultStatus(date, today);
      const category = task.categoryUuid ? categoryById.get(task.categoryUuid) : undefined;

      const item: DerivedTask = {
        taskUuid: task.uuid,
        title: task.title,
        description: task.description,
        isGlobal: task.isGlobal,
        recurrenceType: task.recurrenceType,
        date,
        status,
        categoryUuid: task.categoryUuid,
        categoryName: category?.name ?? null,
        categoryColor: category?.colorHex ?? null,
        rewardText: status === 'completed' ? task.rewardText : null,
        taskType: task.taskType,
        targetCount: task.targetCount,
        durationSeconds: task.durationSeconds,
        progressCount: completion?.progressCount ?? 0,
        reminderTime: task.reminderTime,
        position: task.position,
      };

      const rawSubTasks = subTasksByParent.get(task.uuid);
      if (rawSubTasks && rawSubTasks.length > 0) {
        const subs: DerivedSubTask[] = rawSubTasks.map((s) => {
          const subCompletion = subTaskCompletionByKey.get(`${s.uuid}|${date}`);
          return {
            subTaskUuid: s.uuid,
            title: s.title,
            taskType: s.taskType,
            targetCount: s.targetCount,
            durationSeconds: s.durationSeconds,
            progressCount: subCompletion?.progressCount ?? 0,
            status: (subCompletion?.status as TaskStatus | undefined) ?? defaultStatus(date, today),
          };
        });
        item.subTasks = subs;
        item.status = computeParentStatus(subs, date, today);
        item.rewardText = item.status === 'completed' ? task.rewardText : null;
      }

      results.push(item);
    }
  }

  return results;
}

export function deriveTasksForDate(date: string): DerivedTask[] {
  return deriveTasksForRange(date, date);
}
