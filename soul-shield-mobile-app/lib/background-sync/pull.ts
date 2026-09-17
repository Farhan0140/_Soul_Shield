import { getSyncChanges } from '@/api/sync';
import { upsertCategoryFromSync } from '@/lib/db/categories-repo';
import { getLocalDb } from '@/lib/db/client';
import { upsertSubTaskCompletionFromSync, upsertTaskCompletionFromSync } from '@/lib/db/completions-repo';
import { getSyncCursor, setSyncCursor } from '@/lib/db/sync-cursor';
import { upsertSubTaskFromSync } from '@/lib/db/sub-tasks-repo';
import { upsertTaskFromSync } from '@/lib/db/tasks-repo';
import { tokenStore } from '@/lib/secure-store';

const REQUEST_TIMEOUT_MS = 20_000;

/** Delta-pulls GET /sync and upserts every row into the local-first SQLite
 * store (lib/db/*-repo.ts), advancing the stored cursor only after every
 * row from this pull has landed - so a failure partway through (app killed
 * mid-write, a thrown error) just means the next pull re-fetches the same
 * window and re-applies it, which is idempotent (every write here is an
 * upsert keyed by uuid).
 *
 * Called from lib/background-sync/sync.ts's runFullBackgroundSyncInner
 * alongside the existing windowed REST fetch, not replacing it (see the
 * local-first plan's Phase 3) - the caller wraps this in its own
 * `.catch(() => null)`, matching how that function already isolates
 * fetchMe/prefetchDailyVerses, so a failure here can never touch the
 * critical categories/tasks/history write that today's offline guarantee
 * actually depends on. Resolves to nothing rather than throwing on its own
 * "not ready yet" cases (no local DB, signed out) - those are silently
 * skip-and-retry-next-time, same as the rest of the sync system already
 * treats a skipped run. */
export async function pullLocalDatabase(): Promise<void> {
  const db = getLocalDb();
  if (!db) return;

  const token = await tokenStore.getToken();
  if (!token) return;

  const cursor = getSyncCursor();
  const snapshot = await getSyncChanges(cursor, token, REQUEST_TIMEOUT_MS);

  for (const row of snapshot.categories) upsertCategoryFromSync(row);
  for (const row of snapshot.tasks) upsertTaskFromSync(row);
  for (const row of snapshot.sub_tasks) upsertSubTaskFromSync(row);
  for (const row of snapshot.task_completions) upsertTaskCompletionFromSync(row);
  for (const row of snapshot.sub_task_completions) upsertSubTaskCompletionFromSync(row);

  setSyncCursor(snapshot.cursor);
}
