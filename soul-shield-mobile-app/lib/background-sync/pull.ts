import { getSyncChanges } from '@/api/sync';
import { upsertCategoryFromSync } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { upsertSubTaskCompletionFromSync, upsertTaskCompletionFromSync } from '@/lib/db/completions-repo';
import { getSyncCursor, setSyncCursor } from '@/lib/db/sync-cursor';
import { SYNC_REQUEST_TIMEOUT_MS, SYNC_RETRY } from '@/lib/background-sync/retry';
import { upsertSubTaskFromSync } from '@/lib/db/sub-tasks-repo';
import { upsertTaskFromSync } from '@/lib/db/tasks-repo';
import { tokenStore } from '@/lib/secure-store';

/** Delta-pulls GET /sync and upserts every row into the local-first SQLite
 * store (lib/db/*-repo.ts), advancing the stored cursor only after every
 * row from this pull has landed - so a failure partway through (app killed
 * mid-write, a thrown error) just means the next pull re-fetches the same
 * window and re-applies it, which is idempotent (every write here is an
 * upsert keyed by uuid).
 *
 * Called from lib/background-sync/sync.ts's runFullBackgroundSyncInner as
 * the critical operation the offline guarantee now depends on (every read
 * hook derives from this local store - see hooks/queries/use-tasks.ts) -
 * unlike fetchMe/prefetchDailyVerses, the caller does NOT swallow a failure
 * here. Still resolves to nothing rather than throwing on its own
 * "not ready yet" cases (no local DB, signed out) - those are silently
 * skip-and-retry-next-time, same as the rest of the sync system already
 * treats a skipped run.
 *
 * Retries through SYNC_RETRY (lib/background-sync/retry.ts) rather than
 * failing on the first timeout - the backend runs on Render's free tier,
 * which puts a sleeping instance's first request through a 30-50s (or
 * longer) cold start rather than refusing it outright, so a single 15s
 * attempt would routinely time out on an otherwise-healthy backend. */
export async function pullLocalDatabase(): Promise<void> {
  const db = getLocalDb();
  if (!db) return;

  const token = await tokenStore.getToken();
  if (!token) return;

  const cursor = getSyncCursor();
  const snapshot = await getSyncChanges(cursor, token, SYNC_REQUEST_TIMEOUT_MS, SYNC_RETRY);

  for (const row of snapshot.categories) upsertCategoryFromSync(row);
  for (const row of snapshot.tasks) upsertTaskFromSync(row);
  for (const row of snapshot.sub_tasks) upsertSubTaskFromSync(row);
  for (const row of snapshot.task_completions) upsertTaskCompletionFromSync(row);
  for (const row of snapshot.sub_task_completions) upsertSubTaskCompletionFromSync(row);

  setSyncCursor(snapshot.cursor);
}
