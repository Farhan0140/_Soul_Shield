import { eq, isNull, sql } from 'drizzle-orm';

import type { SyncTask } from '@/api/sync-types';
import type { ManageableTask, RecurrenceType, SubTask, Task, TaskStatus, TaskType } from '@/api/types';
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

export function getTaskByUuid(uuid: string) {
  const db = getLocalDb();
  if (!db) return undefined;
  return db.select().from(tasks).where(eq(tasks.uuid, uuid)).get();
}

/** completed == every sub-task done, partially_completed == some done,
 * else the same missed-vs-pending-by-date default as everything else -
 * ported straight from soul-shield/rest/handlers/task/subtask_merge.go's
 * computeParentStatus. A sub-tasked parent's own status is *always*
 * derived this way, never read from its own completion row (which
 * shouldn't exist for one - the app never lets a sub-tasked parent be
 * completed directly). */
function computeParentStatus(subs: SubTask[], date: string, today: string): TaskStatus {
  const completed = subs.filter((s) => s.status === 'completed').length;
  if (completed === subs.length) return 'completed';
  if (completed > 0) return 'partially_completed';
  return date < today ? 'missed' : 'pending';
}

function defaultStatus(date: string, today: string): TaskStatus {
  return date < today ? 'missed' : 'pending';
}

/** The on-device port of soul-shield/repo/task.go's ListForRange (+
 * subtask_merge.go's attachSubTasksForRange, + the `already_added` check
 * ListTasks's handler layer does for fixed tasks) - same recurrence-day
 * matching, same missed-vs-pending default, same reward-text gating on
 * completed status, same sub-tasked-parent status override. Returns the
 * exact same `Task` shape the app already reads everywhere (see
 * api/types.ts) so hooks/queries/use-tasks.ts's queryFn can return this
 * directly - works for any date range that's been synced locally (see
 * lib/background-sync/pull.ts), online or offline, instead of only
 * whatever the old fixed prefetch window happened to cover.
 *
 * Deliberately does everything in JS over a handful of flat queries rather
 * than a SQL join per day (no generate_series/array `= ANY` in SQLite) -
 * fine at this app's per-user data scale, same reasoning the plan gave for
 * this whole approach. */
export function deriveTasksForRange(fromDate: string, toDate: string): Task[] {
  const db = getLocalDb();
  if (!db) return [];

  const activeTasks = db.select().from(tasks).where(isNull(tasks.deletedAt)).all().filter((t) => t.isActive);
  if (activeTasks.length === 0) return [];

  const categoryById = new Map(listActiveCategories().map((c) => [c.uuid, c]));
  const taskUuids = activeTasks.map((t) => t.uuid);
  const subTasksByParent = listActiveSubTasksByParents(taskUuids);

  // "already_added": a fixed (is_global) task counts as added once the
  // user has a personal task whose source_task_uuid points at it, or whose
  // title case-insensitively matches - same lineage-or-title dedupe as
  // repo/task.go's FindOwnedMatch.
  const ownedSourceUuids = new Set<string>();
  const ownedTitles = new Set<string>();
  for (const t of activeTasks) {
    if (t.isGlobal) continue;
    if (t.sourceTaskUuid) ownedSourceUuids.add(t.sourceTaskUuid);
    ownedTitles.add(t.title.trim().toLowerCase());
  }

  // (taskUuid, date) -> completion, built once for the whole range instead
  // of queried per task/day.
  const taskCompletionByKey = new Map(
    listTaskCompletionsInRange(fromDate, toDate).map((c) => [`${c.taskUuid}|${c.taskDate}`, c])
  );
  const subTaskCompletionByKey = new Map(
    listSubTaskCompletionsInRange(fromDate, toDate).map((c) => [`${c.subTaskUuid}|${c.taskDate}`, c])
  );

  const today = todayISODate();
  const results: Task[] = [];

  for (const date of dateRange(fromDate, toDate)) {
    const weekday = weekdayIndex(date);

    for (const task of activeTasks) {
      const recurrenceDays = decodeIntArray(task.recurrenceDays);
      if (!recurrenceDays.includes(weekday)) continue;

      const completion = taskCompletionByKey.get(`${task.uuid}|${date}`);
      const status: TaskStatus = (completion?.status as TaskStatus | undefined) ?? defaultStatus(date, today);
      const category = task.categoryUuid ? categoryById.get(task.categoryUuid) : undefined;

      const item: Task = {
        task_id: task.uuid,
        title: task.title,
        description: task.description,
        is_global: task.isGlobal,
        recurrence_type: task.recurrenceType as RecurrenceType,
        recurrence_days: recurrenceDays,
        date,
        status,
        category_id: task.categoryUuid,
        category_name: category?.name ?? null,
        category_color: category?.colorHex ?? null,
        reward_text: status === 'completed' ? task.rewardText : null,
        task_type: task.taskType as TaskType,
        target_count: task.targetCount,
        duration_seconds: task.durationSeconds,
        progress_count: completion?.progressCount ?? 0,
        is_active: task.isActive,
        reminder_time: task.reminderTime,
        position: task.position,
        already_added: task.isGlobal
          ? ownedSourceUuids.has(task.uuid) || ownedTitles.has(task.title.trim().toLowerCase())
          : undefined,
      };

      const rawSubTasks = subTasksByParent.get(task.uuid);
      if (rawSubTasks && rawSubTasks.length > 0) {
        const subs: SubTask[] = rawSubTasks.map((s) => {
          const subCompletion = subTaskCompletionByKey.get(`${s.uuid}|${date}`);
          return {
            sub_task_id: s.uuid,
            title: s.title,
            task_type: s.taskType as TaskType,
            target_count: s.targetCount,
            duration_seconds: s.durationSeconds,
            progress_count: subCompletion?.progressCount ?? 0,
            status: (subCompletion?.status as TaskStatus | undefined) ?? defaultStatus(date, today),
          };
        });
        item.sub_tasks = subs;
        item.status = computeParentStatus(subs, date, today);
        item.reward_text = item.status === 'completed' ? task.rewardText : null;
      }

      results.push(item);
    }
  }

  return results;
}

export function deriveTasksForDate(date: string): Task[] {
  return deriveTasksForRange(date, date);
}

/** Every personal (non-fixed) task, unfiltered by date/recurrence/is_active
 * - the on-device port of repo/task.go's ListAllOwnedFlat, for the Reorder
 * pages (app/reorder/*), which need the complete category/task set, not
 * just today's scheduled subset. */
export function listAllOwnedTasksFlat() {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .all()
    .filter((t) => !t.isGlobal)
    .sort((a, b) => a.position - b.position);
}

/** Every active task (global and personal alike) reshaped into the minimal
 * shape lib/notifications.ts's syncAllTaskReminders needs - reminders only
 * depend on a task's own config (reminder_time/recurrence_days), not any
 * date-scoped status, so this reads the raw local rows directly instead of
 * going through deriveTasksForRange. Used by lib/background-sync/sync.ts's
 * headless path in place of the old REST history fetch it used to
 * piggyback reminder-resyncing on. */
export function listAllActiveTasksForReminders() {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .all()
    .filter((t) => t.isActive)
    .map((t) => ({
      task_id: t.uuid,
      title: t.title,
      reminder_time: t.reminderTime,
      recurrence_days: decodeIntArray(t.recurrenceDays),
      is_active: t.isActive,
    }));
}

/** listAllOwnedTasksFlat reshaped into the ManageableTask[] wire shape (see
 * api/types.ts) the Reorder pages already consume - the on-device
 * equivalent of GET /tasks/mine, for hooks/queries/use-tasks.ts's
 * useMyTasksQuery. */
export function deriveManageableTasks(): ManageableTask[] {
  const ownedTasks = listAllOwnedTasksFlat();
  const subTasksByParent = listActiveSubTasksByParents(ownedTasks.map((t) => t.uuid));

  return ownedTasks.map((t) => ({
    id: t.uuid,
    title: t.title,
    category_id: t.categoryUuid ?? undefined,
    position: t.position,
    sub_tasks: subTasksByParent.get(t.uuid)?.map((s) => ({
      sub_task_id: s.uuid,
      title: s.title,
      task_type: s.taskType as TaskType,
      target_count: s.targetCount,
      duration_seconds: s.durationSeconds,
    })),
  }));
}

// ---- Local writes: see categories-repo.ts's equivalent section comment -
// every function here is for a change made on this device, setting
// syncedAt: null and this device's own clock as updatedAt. ----

export interface CreateTaskLocalInput {
  title: string;
  description?: string | null;
  recurrenceType: string;
  recurrenceDays: number[];
  categoryUuid?: string | null;
  rewardText?: string | null;
  taskType: string;
  targetCount?: number | null;
  durationSeconds?: number | null;
  reminderTime?: string | null;
  sourceTaskUuid?: string | null;
}

/** `uuid` is generated by the caller (hooks/queries/use-task-mutations.ts,
 * via lib/db/uuid.ts) rather than here, so the same identity is used both
 * for this local write and for the sync push mutationFn builds from the
 * same mutation variables - see that file's useCreateTask. */
export function createTaskLocal(uuid: string, input: CreateTaskLocalInput) {
  const db = getLocalDb();
  if (!db) return null;

  const now = new Date().toISOString();
  const maxPosition =
    db
      .select({ max: sql<number | null>`max(${tasks.position})` })
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .get()?.max ?? -1;

  const row = {
    uuid,
    title: input.title,
    description: input.description ?? null,
    isGlobal: false,
    recurrenceType: input.recurrenceType,
    recurrenceDays: encodeIntArray(input.recurrenceDays),
    isActive: true,
    categoryUuid: input.categoryUuid ?? null,
    rewardText: input.rewardText ?? null,
    taskType: input.taskType,
    targetCount: input.targetCount ?? null,
    durationSeconds: input.durationSeconds ?? null,
    reminderTime: input.reminderTime ?? null,
    sourceTaskUuid: input.sourceTaskUuid ?? null,
    position: maxPosition + 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncedAt: null,
  };
  db.insert(tasks).values(row).run();
  return row;
}

export interface UpdateTaskLocalInput {
  title?: string;
  description?: string | null;
  recurrenceType?: string;
  recurrenceDays?: number[];
  isActive?: boolean;
  categoryUuid?: string | null;
  rewardText?: string | null;
  targetCount?: number | null;
  durationSeconds?: number | null;
  reminderTime?: string | null;
}

export function updateTaskLocal(uuid: string, input: UpdateTaskLocalInput): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.update(tasks)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.recurrenceType !== undefined ? { recurrenceType: input.recurrenceType } : {}),
      ...(input.recurrenceDays !== undefined ? { recurrenceDays: encodeIntArray(input.recurrenceDays) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.categoryUuid !== undefined ? { categoryUuid: input.categoryUuid } : {}),
      ...(input.rewardText !== undefined ? { rewardText: input.rewardText } : {}),
      ...(input.targetCount !== undefined ? { targetCount: input.targetCount } : {}),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
      ...(input.reminderTime !== undefined ? { reminderTime: input.reminderTime } : {}),
      updatedAt: now,
      syncedAt: null,
    })
    .where(eq(tasks.uuid, uuid))
    .run();
}

/** Soft-deletes locally and cascades to its sub-tasks, matching
 * repo/task.go's Delete (see categories-repo.ts's softDeleteCategoryLocal
 * for the same reasoning re: no automatic ON DELETE CASCADE here). */
export function softDeleteTaskLocal(uuid: string): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  db.update(tasks).set({ deletedAt: now, updatedAt: now, syncedAt: null }).where(eq(tasks.uuid, uuid)).run();
}

/** Sets position = index for each uuid in the new order, scoped to one
 * (owner, category) group - see categories-repo.ts's reorderCategoriesLocal
 * for why this doesn't replicate the backend's atomic exact-set-match
 * validation. */
export function reorderTasksLocal(orderedUuids: string[]): void {
  const db = getLocalDb();
  if (!db) return;

  const now = new Date().toISOString();
  orderedUuids.forEach((uuid, index) => {
    db.update(tasks).set({ position: index, updatedAt: now, syncedAt: null }).where(eq(tasks.uuid, uuid)).run();
  });
}
