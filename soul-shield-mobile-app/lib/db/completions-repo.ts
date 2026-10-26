import { and, eq, gte, isNull, lte } from 'drizzle-orm';

import type { SyncSubTaskCompletion, SyncTaskCompletion } from '@/api/sync-types';
import type { TaskStatus } from '@/api/types';
import { getLocalDb } from '@/lib/db/client';
import { checkForConflict } from '@/lib/db/conflicts-repo';
import { subTaskCompletions, taskCompletions } from '@/lib/db/schema';
import { newUuid } from '@/lib/db/uuid';

/** Anti-revert guard for pulled completion rows (#counter performance): a
 * /sync pull whose server snapshot was taken BEFORE a just-made local
 * increment/toggle must not clobber the newer local row (it would visibly
 * reset the counter until the next push recovered it — the "count appears to
 * revert" bug). Rules, in order:
 *  - a dirty local row (syncedAt null → this device owes a push) is KEPT when
 *    the incoming row isn't strictly ahead of it: progress not greater AND
 *    not newly 'completed'. Counter progress is monotonic per day, so this
 *    is skew-proof (no clock comparison — local and server clocks can
 *    disagree);
 *  - an incoming row that IS ahead (another device's taps, a completion)
 *    still applies, so multi-device sums keep working;
 *  - synced (non-dirty) rows always apply (their syncedAt=null write path is
 *    reconcilePushResults, not a pull). */
function shouldApplyPulledCompletion(
  existing:
    | { uuid: string; syncedAt: string | null; status: string; progressCount: number }
    | undefined,
  incoming: { status: string; progress_count: number }
): boolean {
  if (!existing) return true;
  if (existing.syncedAt !== null) return true;
  if (incoming.progress_count > existing.progressCount) return true;
  if (incoming.status === 'completed' && existing.status !== 'completed') return true;
  return false;
}

/** See categories-repo.ts's upsertCategoryFromSync - identical shape,
 * including the conflict check. task_uuid is nullable (mirrors the
 * backend's historical nullable task_id - see lib/db/schema.ts's comment on
 * taskCompletions). */

/** When a skip happens during PUSH-RECONCILE (the server_row that answers OUR
 * accepted push), the server by definition already contains this device's
 * delta(s) — server total >= local is the proof — so the only correct action is
 * to clear the dirty flag (syncedAt) without touching data; leaving it dirty
 * would keep the row in every future safety-net sweep. On a PULL skip the row
 * stays dirty on purpose (see shouldApplyPulledCompletion). Drizzle requires a
 * concrete table type, hence the generic param. */
function applyPostPushSyncMark(
  origin: 'sync-pull' | 'push-reconcile',
  existing: { uuid: string; syncedAt: string | null; progressCount: number } | undefined,
  incomingProgressCount: number,
  markSynced: () => void
): void {
  if (origin !== 'push-reconcile' || !existing || existing.syncedAt !== null) return;
  if (incomingProgressCount < existing.progressCount) return;
  markSynced();
}

export function upsertTaskCompletionFromSync(
  row: SyncTaskCompletion,
  origin: 'sync-pull' | 'push-reconcile' = 'sync-pull'
): void {
  const db = getLocalDb();
  if (!db) return;

  const existing = db.select().from(taskCompletions).where(eq(taskCompletions.uuid, row.uuid)).get();
  checkForConflict('task_completions', existing, row.updated_at, row);
  if (!shouldApplyPulledCompletion(existing, row)) {
    applyPostPushSyncMark(origin, existing, row.progress_count, () => {
      const now = new Date().toISOString();
      db.update(taskCompletions).set({ syncedAt: now }).where(eq(taskCompletions.uuid, existing!.uuid)).run();
    });
    return;
  }

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

export function upsertSubTaskCompletionFromSync(
  row: SyncSubTaskCompletion,
  origin: 'sync-pull' | 'push-reconcile' = 'sync-pull'
): void {
  const db = getLocalDb();
  if (!db) return;

  const existing = db.select().from(subTaskCompletions).where(eq(subTaskCompletions.uuid, row.uuid)).get();
  checkForConflict('sub_task_completions', existing, row.updated_at, row);
  if (!shouldApplyPulledCompletion(existing, row)) {
    applyPostPushSyncMark(origin, existing, row.progress_count, () => {
      const now = new Date().toISOString();
      db.update(subTaskCompletions).set({ syncedAt: now }).where(eq(subTaskCompletions.uuid, existing!.uuid)).run();
    });
    return;
  }

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

/** Unsynced completions that carry no counter progress (a plain
 * complete/un-complete toggle) - see lib/background-sync/push-pending.ts.
 * Counter rows (progressCount > 0) are deliberately excluded: they sync as an
 * additive "increment" delta (see hooks/use-task-increment-buffer.ts), and
 * re-pushing one as a status-only upsert would let the server's row - which
 * has no idea about that progress - overwrite it on the next pull. */
export function listUnsyncedTaskCompletions() {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(taskCompletions)
    .where(and(isNull(taskCompletions.syncedAt), eq(taskCompletions.progressCount, 0)))
    .all();
}

export function listUnsyncedSubTaskCompletions() {
  const db = getLocalDb();
  if (!db) return [];
  return db
    .select()
    .from(subTaskCompletions)
    .where(and(isNull(subTaskCompletions.syncedAt), eq(subTaskCompletions.progressCount, 0)))
    .all();
}

/** Removes a local completion row by uuid - used only to drop the duplicate a
 * push leaves behind when the server merged it into an existing row for the
 * same (task, date) under a different uuid (see lib/mutation-defaults.ts's
 * dropMergedLocalCompletions). */
export function deleteTaskCompletionLocal(uuid: string): void {
  const db = getLocalDb();
  if (!db) return;
  db.delete(taskCompletions).where(eq(taskCompletions.uuid, uuid)).run();
}

export function deleteSubTaskCompletionLocal(uuid: string): void {
  const db = getLocalDb();
  if (!db) return;
  db.delete(subTaskCompletions).where(eq(subTaskCompletions.uuid, uuid)).run();
}

/** The single task_completions row for (taskUuid, date), if one exists yet -
 * used by the increment buffer's flush() (hooks/use-task-increment-buffer.ts)
 * to look up the uuid/date to push against without threading that state
 * through the buffer itself, since incrementTaskCompletionLocal (below)
 * always creates this row on the very first tap for a given date. */
export function getTaskCompletionForDate(taskUuid: string, date: string) {
  const db = getLocalDb();
  if (!db) return undefined;
  return db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskUuid, taskUuid), eq(taskCompletions.taskDate, date)))
    .get();
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

/** Everything ever stored (incl. tombstones) — the data export reads these
 * rather than the range-filtered views so a backup loses nothing. */
export function listAllTaskCompletionsLocal() {
  const db = getLocalDb();
  if (!db) return [];
  return db.select().from(taskCompletions).all();
}

export function listAllSubTaskCompletionsLocal() {
  const db = getLocalDb();
  if (!db) return [];
  return db.select().from(subTaskCompletions).all();
}

// ---- Local writes ----
//
// Unlike the backend's POST /tasks/{id}/complete (repo/task.go's Complete,
// which unconditionally sets status='completed' - there's no separate
// "uncomplete" endpoint), this genuinely toggles: TaskCard's checkbox stays
// tappable on an already-completed task specifically so tapping it again
// undoes it (see hooks/queries/use-task-mutations.ts's useCompleteTask doc
// comment, which already describes this as the intended behavior). That
// was previously just an optimistic local patch that the next real
// completion request would silently overwrite back to 'completed' - now
// that this device owns the authoritative local row, the toggle is real,
// and pushes the actual resulting status (op: "upsert") via POST /sync,
// whose pushTaskCompletion (repo/sync_push.go) honors whatever status is
// sent rather than hardcoding "completed".

function upsertLocalCompletionRow(
  existing: { uuid: string } | undefined,
  values: {
    taskUuid?: string | null;
    taskDate: string;
    status: TaskStatus;
    progressCount: number;
    completedAt: string | null;
  },
  now: string
): string {
  const db = getLocalDb();
  if (!db) return existing?.uuid ?? newUuid();

  if (existing) {
    db.update(taskCompletions)
      .set({
        status: values.status,
        progressCount: values.progressCount,
        completedAt: values.completedAt,
        updatedAt: now,
        syncedAt: null,
      })
      .where(eq(taskCompletions.uuid, existing.uuid))
      .run();
    return existing.uuid;
  }

  const uuid = newUuid();
  db.insert(taskCompletions)
    .values({
      uuid,
      taskUuid: values.taskUuid ?? null,
      taskDate: values.taskDate,
      status: values.status,
      progressCount: values.progressCount,
      completedAt: values.completedAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncedAt: null,
    })
    .run();
  return uuid;
}

/** Idempotently marks a task completed for one date - unlike
 * toggleTaskCompletionLocal below, calling this again never un-completes
 * it. Used by lib/background-sync/timer-task.ts's headless timer-finished
 * completion, which may legitimately retry the same call (a process kill
 * between the local write and the push confirming) - a toggle there would
 * flip an already-completed row back to pending on retry. */
export function completeTaskLocal(taskUuid: string, date: string): { completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskUuid, taskUuid), eq(taskCompletions.taskDate, date)))
    .get();

  const completionUuid = upsertLocalCompletionRow(
    existing,
    {
      taskUuid,
      taskDate: date,
      status: 'completed',
      progressCount: existing?.progressCount ?? 0,
      completedAt: existing?.completedAt ?? now,
    },
    now
  );
  return { completionUuid };
}

/** Toggles a normal task's completion for one date - see the module
 * comment above. Returns the resulting status plus the completion row's
 * uuid (needed by the caller to build the push change). */
export function toggleTaskCompletionLocal(taskUuid: string, date: string): { status: TaskStatus; completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { status: 'pending', completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskUuid, taskUuid), eq(taskCompletions.taskDate, date)))
    .get();

  const nextStatus: TaskStatus = existing?.status === 'completed' ? 'pending' : 'completed';
  const completionUuid = upsertLocalCompletionRow(
    existing,
    {
      taskUuid,
      taskDate: date,
      status: nextStatus,
      progressCount: existing?.progressCount ?? 0,
      completedAt: nextStatus === 'completed' ? now : null,
    },
    now
  );
  return { status: nextStatus, completionUuid };
}

/** Adds `amount` to a counter task's progress for one date, auto-completing
 * once it reaches `targetCount` - mirrors repo/task.go's Increment. Pushed
 * as op: "increment" (a signed delta, not the resulting total) so two
 * devices incrementing offline both count instead of one clobbering the
 * other - see repo/sync_push.go's pushTaskCompletion. */
export function incrementTaskCompletionLocal(
  taskUuid: string,
  date: string,
  amount: number,
  targetCount: number
): { status: TaskStatus; progressCount: number; completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { status: 'pending', progressCount: 0, completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(taskCompletions)
    .where(and(eq(taskCompletions.taskUuid, taskUuid), eq(taskCompletions.taskDate, date)))
    .get();

  const progressCount = (existing?.progressCount ?? 0) + amount;
  const status: TaskStatus = progressCount >= targetCount ? 'completed' : (existing?.status as TaskStatus) ?? 'pending';
  const completionUuid = upsertLocalCompletionRow(
    existing,
    {
      taskUuid,
      taskDate: date,
      status,
      progressCount,
      completedAt: status === 'completed' ? (existing?.completedAt ?? now) : null,
    },
    now
  );
  return { status, progressCount, completionUuid };
}

function upsertLocalSubTaskCompletionRow(
  existing: { uuid: string } | undefined,
  values: {
    subTaskUuid?: string | null;
    parentTaskUuid: string;
    taskDate: string;
    status: TaskStatus;
    progressCount: number;
    completedAt: string | null;
  },
  now: string
): string {
  const db = getLocalDb();
  if (!db) return existing?.uuid ?? newUuid();

  if (existing) {
    db.update(subTaskCompletions)
      .set({
        status: values.status,
        progressCount: values.progressCount,
        completedAt: values.completedAt,
        updatedAt: now,
        syncedAt: null,
      })
      .where(eq(subTaskCompletions.uuid, existing.uuid))
      .run();
    return existing.uuid;
  }

  const uuid = newUuid();
  db.insert(subTaskCompletions)
    .values({
      uuid,
      subTaskUuid: values.subTaskUuid ?? null,
      parentTaskUuid: values.parentTaskUuid,
      taskDate: values.taskDate,
      status: values.status,
      progressCount: values.progressCount,
      completedAt: values.completedAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncedAt: null,
    })
    .run();
  return uuid;
}

/** See completeTaskLocal above - same idempotent-not-toggle reasoning, for
 * lib/background-sync/timer-task.ts's headless sub-task timer completion. */
export function completeSubTaskLocal(subTaskUuid: string, parentTaskUuid: string, date: string): { completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(subTaskCompletions)
    .where(and(eq(subTaskCompletions.subTaskUuid, subTaskUuid), eq(subTaskCompletions.taskDate, date)))
    .get();

  const completionUuid = upsertLocalSubTaskCompletionRow(
    existing,
    {
      subTaskUuid,
      parentTaskUuid,
      taskDate: date,
      status: 'completed',
      progressCount: existing?.progressCount ?? 0,
      completedAt: existing?.completedAt ?? now,
    },
    now
  );
  return { completionUuid };
}

export function toggleSubTaskCompletionLocal(
  subTaskUuid: string,
  parentTaskUuid: string,
  date: string
): { status: TaskStatus; completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { status: 'pending', completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(subTaskCompletions)
    .where(and(eq(subTaskCompletions.subTaskUuid, subTaskUuid), eq(subTaskCompletions.taskDate, date)))
    .get();

  const nextStatus: TaskStatus = existing?.status === 'completed' ? 'pending' : 'completed';
  const completionUuid = upsertLocalSubTaskCompletionRow(
    existing,
    {
      subTaskUuid,
      parentTaskUuid,
      taskDate: date,
      status: nextStatus,
      progressCount: existing?.progressCount ?? 0,
      completedAt: nextStatus === 'completed' ? now : null,
    },
    now
  );
  return { status: nextStatus, completionUuid };
}

export function incrementSubTaskCompletionLocal(
  subTaskUuid: string,
  parentTaskUuid: string,
  date: string,
  amount: number,
  targetCount: number
): { status: TaskStatus; progressCount: number; completionUuid: string } {
  const db = getLocalDb();
  if (!db) return { status: 'pending', progressCount: 0, completionUuid: '' };

  const now = new Date().toISOString();
  const existing = db
    .select()
    .from(subTaskCompletions)
    .where(and(eq(subTaskCompletions.subTaskUuid, subTaskUuid), eq(subTaskCompletions.taskDate, date)))
    .get();

  const progressCount = (existing?.progressCount ?? 0) + amount;
  const status: TaskStatus = progressCount >= targetCount ? 'completed' : (existing?.status as TaskStatus) ?? 'pending';
  const completionUuid = upsertLocalSubTaskCompletionRow(
    existing,
    {
      subTaskUuid,
      parentTaskUuid,
      taskDate: date,
      status,
      progressCount,
      completedAt: status === 'completed' ? (existing?.completedAt ?? now) : null,
    },
    now
  );
  return { status, progressCount, completionUuid };
}
