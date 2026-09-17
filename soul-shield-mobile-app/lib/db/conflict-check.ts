import { eq } from 'drizzle-orm';

import { getLocalDb } from '@/lib/db/client';
import { listSyncConflicts } from '@/lib/db/conflicts-repo';
import { syncConflicts, tasks } from '@/lib/db/schema';
import { upsertTaskFromSync } from '@/lib/db/tasks-repo';

const TEST_UUID = '00000000-0000-0000-0000-000000000001';

/** Dev-only, self-contained verification for Phase 4's conflict detection
 * (see lib/db/conflicts-repo.ts). The real trigger for this - a genuine
 * unsynced local edit (syncedAt = null) meeting an incoming pull for the
 * same row - can't be produced through normal use yet, since nothing
 * writes local-only edits until Phase 5's mutation cutover exists. This
 * exercises the same primitive directly instead: seeds a fake "unsynced
 * local edit" row, feeds upsertTaskFromSync a synthetic server row for the
 * same uuid with a different title/updated_at, and confirms a conflict
 * landed in sync_conflicts with both versions - then cleans up everything
 * it created (the fake task and the conflict row) so it leaves no trace.
 *
 * Does NOT cover the backend's increment-delta-summation behavior (see
 * soul-shield/repo/sync_push.go's pushTaskCompletion/pushSubTaskCompletion)
 * - that's server-side logic from Phase 2, verified via curl against the
 * live endpoint, not something this on-device check can exercise. */
export function checkConflictDetection(): string {
  const db = getLocalDb();
  if (!db) return 'Local database unavailable.';

  const now = new Date().toISOString();

  // Clean slate in case a previous run left something behind.
  db.delete(syncConflicts).where(eq(syncConflicts.rowUuid, TEST_UUID)).run();
  db.delete(tasks).where(eq(tasks.uuid, TEST_UUID)).run();

  // Seed a fake unsynced local edit - syncedAt: null is exactly what marks
  // a row as "written on this device, not yet confirmed pushed."
  db.insert(tasks)
    .values({
      uuid: TEST_UUID,
      title: 'Local edit (unsynced)',
      recurrenceType: 'daily',
      recurrenceDays: '[0,1,2,3,4,5,6]',
      taskType: 'normal',
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    })
    .run();

  try {
    // A different device's version of the same row, with a later
    // updated_at - this is what a pull would return.
    upsertTaskFromSync({
      uuid: TEST_UUID,
      title: 'Server edit (from another device)',
      is_global: false,
      recurrence_type: 'daily',
      recurrence_days: [0, 1, 2, 3, 4, 5, 6],
      is_active: true,
      task_type: 'normal',
      position: 0,
      created_at: now,
      updated_at: new Date(Date.now() + 1000).toISOString(),
    });

    const logged = listSyncConflicts().filter((c) => c.rowUuid === TEST_UUID);
    const applied = db.select().from(tasks).where(eq(tasks.uuid, TEST_UUID)).get();

    if (logged.length === 0) {
      return 'FAILED: no conflict was logged for the seeded unsynced edit.';
    }
    if (applied?.title !== 'Server edit (from another device)') {
      return 'FAILED: conflict was logged, but the server version was not applied.';
    }
    return `OK: conflict logged (local="${JSON.parse(logged[0].localData).title}", server="${JSON.parse(logged[0].serverData).title}") and the server version was applied.`;
  } finally {
    db.delete(syncConflicts).where(eq(syncConflicts.rowUuid, TEST_UUID)).run();
    db.delete(tasks).where(eq(tasks.uuid, TEST_UUID)).run();
  }
}
