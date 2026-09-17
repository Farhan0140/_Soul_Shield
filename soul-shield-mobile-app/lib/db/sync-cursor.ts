import { eq } from 'drizzle-orm';

import { getLocalDb } from '@/lib/db/client';
import { syncState } from '@/lib/db/schema';

const ROW_ID = 1;

/** Last successful GET /sync cursor - null means "never synced, pull
 * everything" (see lib/background-sync/pull.ts). */
export function getSyncCursor(): string | null {
  const db = getLocalDb();
  if (!db) return null;
  const row = db.select().from(syncState).where(eq(syncState.id, ROW_ID)).get();
  return row?.cursor ?? null;
}

export function setSyncCursor(cursor: string): void {
  const db = getLocalDb();
  if (!db) return;
  db.insert(syncState)
    .values({ id: ROW_ID, cursor })
    .onConflictDoUpdate({ target: syncState.id, set: { cursor } })
    .run();
}
