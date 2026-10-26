import { Share } from 'react-native';

import { getLocalDb } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { listActiveCategories } from '@/lib/db/categories-repo';

/** Offline backup export (#14): serializes everything on this device —
 * including soft-deleted rows, so nothing is lost — into one JSON document
 * and hands it to the native share sheet. Uses the OS Share API (already
 * available in React Native) rather than adding expo-file-system/sharing
 * dependencies; for very large accounts the string can be long, but the
 * Android intent／iOS share sheet both handle text of this size. */

export async function buildExportPayload(): Promise<string> {
  const db = getLocalDb();
  if (!db) throw new Error('Offline database is not ready on this device yet.');

  const tasks = db.select().from(schema.tasks).all();
  const categories = db.select().from(schema.categories).all();
  const subTasks = db.select().from(schema.subTasks).all();
  const taskCompletions = db.select().from(schema.taskCompletions).all();
  const subTaskCompletions = db.select().from(schema.subTaskCompletions).all();
  const conflicts = db.select().from(schema.syncConflicts).all();
  const [cursor] = db.select().from(schema.syncState).all();

  return JSON.stringify(
    {
      app: 'soul-shield',
      kind: 'local-data-export',
      exportedAt: new Date().toISOString(),
      counts: {
        categories: categories.length,
        tasks: tasks.length,
        subTasks: subTasks.length,
        taskCompletions: taskCompletions.length,
        subTaskCompletions: subTaskCompletions.length,
        conflicts: conflicts.length,
      },
      // Active user-facing categories in their friendly position order, then
      // every raw local table (incl. tombstones) as the durable backup.
      summary: { activeCategories: listActiveCategories().length, totalTasks: tasks.length },
      data: {
        categories,
        tasks,
        subTasks,
        taskCompletions,
        subTaskCompletions,
        syncConflicts: conflicts,
        syncCursor: cursor ?? null,
      },
    },
    null,
    2
  );
}

export async function shareExport(): Promise<void> {
  const json = await buildExportPayload();
  const result = await Share.share({
    title: 'Soul Shield — data export',
    message: json,
  });
  if (result.action === Share.dismissedAction) {
    // Nothing to do — the user backed out of the share sheet.
  }
}
