import { desc } from 'drizzle-orm';

import { getLocalDb } from '@/lib/db/client';
import { syncConflicts } from '@/lib/db/schema';

/** Records a genuine concurrent edit instead of silently letting the
 * server's version clobber an unsynced local one - the server's version is
 * still what gets applied (see each *-repo.ts's upsertXFromSync, which
 * calls this immediately before overwriting), this just makes sure nothing
 * is lost without a trace, per the local-first plan's core complaint about
 * today's full-resync-silently-wins behavior. No in-app UI reads this yet
 * (Phase 4 is log-only, deliberately) - `listSyncConflicts` exists now so a
 * future screen has something to call without another schema change. */
export function logSyncConflict(resource: string, rowUuid: string, localData: unknown, serverData: unknown): void {
  const db = getLocalDb();
  if (!db) return;

  db.insert(syncConflicts)
    .values({
      resource,
      rowUuid,
      localData: JSON.stringify(localData),
      serverData: JSON.stringify(serverData),
      detectedAt: new Date().toISOString(),
    })
    .run();
}

export function listSyncConflicts() {
  const db = getLocalDb();
  if (!db) return [];
  return db.select().from(syncConflicts).orderBy(desc(syncConflicts.detectedAt)).all();
}

/** Shared by every *-repo.ts's upsertXFromSync (all five local tables share
 * uuid/syncedAt/updatedAt) - the actual "is this a genuine concurrent edit"
 * check. `existing.syncedAt === null` means this device has a local write
 * that hasn't been confirmed pushed yet (Phase 5 is what ever sets that);
 * comparing updatedAt against the incoming row rules out the case where the
 * incoming pull is simply confirming this device's own not-yet-marked-synced
 * write echoing back unchanged - only a genuine mismatch is a conflict. */
export function checkForConflict(
  resource: string,
  existing: { uuid: string; syncedAt: string | null; updatedAt: string } | undefined,
  incomingUpdatedAt: string,
  serverRow: unknown
): void {
  if (existing && existing.syncedAt === null && existing.updatedAt !== incomingUpdatedAt) {
    logSyncConflict(resource, existing.uuid, existing, serverRow);
  }
}
